"""Deterministic analytics over ONE connected sheet tab — no LLM. The sheet is read
through the same Google path and `build_frame` the AI agent uses, then everything
(column profile, totals, breakdown, monthly trend) is computed with pandas. Amounts
are also spelled in Indian words (lakh/crore) by code, like the agent does.

`profile_frame` is pure (DataFrame in, dataclasses out) so it is unit-tested without
Google or a database; `get_profile` does the I/O.
"""

import asyncio
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.numbers import number_to_words
from app.agent.tools import build_frame
from app.core.errors import AppError
from app.integrations.google import sheets as google_sheets
from app.services import connection_service, data_source_service

MAX_ROWS = 5000  # same cap as the AI agent
MAX_BREAKDOWN = 10
MAX_TREND_POINTS = 24  # months
MAX_DIMENSION_DISTINCT = 50
TOP_VALUES = 5
CACHE_TTL = 60.0  # seconds; a changed measure/grouping must not re-read Google every time
CACHE_MAX = 32

Agg = Literal["sum", "mean", "count"]
_ID_LIKE = re.compile(r"(^|[\s_\-])(id|no|number|phone|mobile|pin|zip|code)($|[\s_\-])", re.I)
_DATE_HINT = re.compile(r"\D")  # a date cell contains a separator or a month name


class BadSelection(AppError):
    status_code = 400
    code = "bad_selection"


@dataclass
class ColumnProfile:
    name: str
    type: str  # number | text | date
    missing: int
    distinct: int
    sum: float | None = None
    mean: float | None = None
    min: float | None = None
    max: float | None = None
    top: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Point:
    label: str
    value: float


@dataclass
class Selection:
    measure: str | None
    agg: str
    group_by: str | None
    date_column: str | None


@dataclass
class Profile:
    rows: int
    columns: int
    missing_pct: float
    duplicate_rows: int
    column_profiles: list[ColumnProfile]
    measures: list[str]
    dimensions: list[str]
    dates: list[str]
    selected: Selection
    total: float | None  # the selected measure aggregated over every row
    total_words: str | None
    breakdown: list[Point]
    trend: list[Point]


def _num(x: Any) -> float:
    return round(float(x), 2)


def detect_dates(df: pd.DataFrame) -> dict[str, pd.Series]:
    """Text columns whose values are mostly dates ('2026-09-01', '05/09/2026', '5 Sep 2026').
    Pure digit strings (IDs, years) are never treated as dates. Day-first, like Indian sheets."""
    found: dict[str, pd.Series] = {}
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            continue
        values = df[col].dropna().astype(str)
        if values.empty or not values.map(lambda v: bool(_DATE_HINT.search(v))).mean() >= 0.8:
            continue
        parsed = pd.to_datetime(df[col], errors="coerce", dayfirst=True, format="mixed")
        if parsed.notna().sum() / len(values) >= 0.8:
            found[str(col)] = parsed
    return found


def _profile_column(df: pd.DataFrame, col: str, is_date: bool) -> ColumnProfile:
    series = df[col]
    name, missing, distinct = col, int(series.isna().sum()), int(series.nunique())
    if pd.api.types.is_numeric_dtype(series) and not is_date:
        clean = series.dropna()
        return ColumnProfile(
            type="number",
            sum=_num(clean.sum()) if len(clean) else None,
            mean=_num(clean.mean()) if len(clean) else None,
            min=_num(clean.min()) if len(clean) else None,
            max=_num(clean.max()) if len(clean) else None,
            name=name,
            missing=missing,
            distinct=distinct,
        )
    top = [
        {"value": str(v), "count": int(n)}
        for v, n in series.value_counts().head(TOP_VALUES).items()
    ]
    return ColumnProfile(
        name=name,
        type="date" if is_date else "text",
        missing=missing,
        distinct=distinct,
        top=top,
    )


def _default_measure(numeric: list[str]) -> str | None:
    preferred = [c for c in numeric if not _ID_LIKE.search(c)]
    pool = preferred or numeric
    return pool[0] if pool else None


def _default_dimension(df: pd.DataFrame, dims: list[str]) -> str | None:
    for col in dims:
        # Needs some repetition: a column of all-unique values (names, ids) groups nothing.
        if 2 <= df[col].nunique() <= MAX_DIMENSION_DISTINCT and df[col].nunique() < len(df):
            return col
    return None


def _aggregate(grouped: Any, agg: str) -> pd.Series:
    return grouped.size() if agg == "count" else getattr(grouped, agg)()


def profile_frame(
    df: pd.DataFrame,
    measure: str | None = None,
    agg: str = "sum",
    group_by: str | None = None,
    date_column: str | None = None,
) -> Profile:
    if agg not in ("sum", "mean", "count"):
        raise BadSelection("Aggregate must be sum, mean or count.")
    dates = detect_dates(df)
    numeric = [str(c) for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    dims = [str(c) for c in df.columns if str(c) not in numeric and str(c) not in dates]
    dims = [c for c in dims if 1 <= df[c].nunique() <= MAX_DIMENSION_DISTINCT]

    for label, picked, allowed in (
        ("measure", measure, numeric),
        ("group column", group_by, dims),
        ("date column", date_column, list(dates)),
    ):
        if picked is not None and picked not in allowed:
            raise BadSelection(f"'{picked}' isn't a usable {label} for this sheet.")

    measure = measure or _default_measure(numeric)
    group_by = group_by or _default_dimension(df, dims)
    date_column = date_column or next(iter(dates), None)
    if measure is None:
        agg = "count"  # no numeric column: counting rows is the only honest number
    selected = Selection(measure, agg, group_by, date_column)

    cells = df.shape[0] * df.shape[1]
    missing_pct = round(float(df.isna().sum().sum()) / cells * 100, 1) if cells else 0.0

    total: float | None = None
    if agg == "count":
        total = float(len(df))
    elif measure is not None and df[measure].notna().any():
        total = float(df[measure].sum() if agg == "sum" else df[measure].mean())

    breakdown: list[Point] = []
    if group_by is not None:
        frame = df[[group_by] + ([measure] if measure and agg != "count" else [])].dropna(
            subset=[group_by]
        )
        grouped = frame.groupby(group_by)[measure] if agg != "count" and measure else None
        values = _aggregate(grouped, agg) if grouped is not None else frame.groupby(group_by).size()
        top = values.sort_values(ascending=False).head(MAX_BREAKDOWN)
        breakdown = [Point(str(k), _num(v)) for k, v in top.items()]

    trend: list[Point] = []
    if date_column is not None:
        when = dates[date_column]
        frame = pd.DataFrame({"when": when})
        if measure and agg != "count":
            frame["value"] = df[measure]
        frame = frame.dropna(subset=["when"])
        periods = frame["when"].dt.to_period("M")
        values = (
            frame.groupby(periods).size()
            if agg == "count" or "value" not in frame
            else _aggregate(frame.groupby(periods)["value"], agg)
        )
        recent = values.sort_index().tail(MAX_TREND_POINTS)
        trend = [Point(str(p), _num(v)) for p, v in recent.items()]

    return Profile(
        rows=len(df),
        columns=df.shape[1],
        missing_pct=missing_pct,
        duplicate_rows=int(df.duplicated().sum()),
        column_profiles=[_profile_column(df, str(c), str(c) in dates) for c in df.columns],
        measures=numeric,
        dimensions=dims,
        dates=list(dates),
        selected=selected,
        total=_num(total) if total is not None else None,
        total_words=number_to_words(total) if total is not None and abs(total) >= 1000 else None,
        breakdown=breakdown,
        trend=trend,
    )


# --- I/O -----------------------------------------------------------------------------

_cache: dict[tuple[uuid.UUID, uuid.UUID], tuple[float, pd.DataFrame, bool]] = {}


def _cache_get(key: tuple[uuid.UUID, uuid.UUID]) -> tuple[pd.DataFrame, bool] | None:
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL:
        return hit[1], hit[2]
    _cache.pop(key, None)
    return None


def _cache_put(key: tuple[uuid.UUID, uuid.UUID], df: pd.DataFrame, truncated: bool) -> None:
    if len(_cache) >= CACHE_MAX:
        _cache.pop(next(iter(_cache)))  # oldest insertion
    _cache[key] = (time.monotonic(), df, truncated)


async def load_frame(
    session: AsyncSession, clerk_user_id: str, source_id: uuid.UUID
) -> tuple[Any, pd.DataFrame, bool]:
    """(source, DataFrame, truncated) for one of the user's sheet tabs."""
    source = await data_source_service.get_source(session, clerk_user_id, source_id)
    key = (source.user_id, source.id)
    cached = _cache_get(key)
    if cached:
        return source, cached[0], cached[1]
    connection = await connection_service.get_connection(
        session, clerk_user_id, "google_sheets", source.connection_id
    )
    token = await connection_service.get_valid_access_token(session, connection)
    preview = await asyncio.to_thread(
        google_sheets.fetch_sheet_preview,
        token,
        source.external_id,
        source.tab_title or None,
        MAX_ROWS,
    )
    df = build_frame(preview.headers, preview.rows)
    truncated = len(df) >= MAX_ROWS
    _cache_put(key, df, truncated)
    return source, df, truncated


async def get_profile(
    session: AsyncSession,
    clerk_user_id: str,
    source_id: uuid.UUID,
    measure: str | None,
    agg: str,
    group_by: str | None,
    date_column: str | None,
) -> tuple[Any, Profile, bool]:
    source, df, truncated = await load_frame(session, clerk_user_id, source_id)
    if df.empty:
        raise BadSelection("This sheet tab has no data rows to analyse.")
    profile = await asyncio.to_thread(profile_frame, df, measure, agg, group_by, date_column)
    return source, profile, truncated
