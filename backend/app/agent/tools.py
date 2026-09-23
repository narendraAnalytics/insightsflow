"""Vetted, read-only analysis tools over one sheet. The LLM chooses a tool and
its arguments; every number is computed here with pandas — the model never does
arithmetic. Tools return JSON strings: {"summary", "table"?, ...values}.
"""

import json
import re
from typing import Any, Literal

import pandas as pd
from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel

from app.agent.numbers import number_to_words

MAX_ROWS_RETURNED = 20
Op = Literal["sum", "mean", "median", "min", "max", "count"]
FilterOp = Literal["=", "!=", ">", ">=", "<", "<=", "contains"]


class Filter(BaseModel):
    column: str
    op: FilterOp
    value: str | float | int


class _NoArgs(BaseModel):
    pass


def _dedupe_headers(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out: list[str] = []
    for i, raw in enumerate(headers):
        name = str(raw).strip() or f"Column {i + 1}"
        seen[name] = seen.get(name, 0) + 1
        out.append(name if seen[name] == 1 else f"{name} ({seen[name]})")
    return out


def _to_number(value: Any) -> float | None:
    """Parses '₹1,20,000', '$3.5', '12%', '(45)' style strings."""
    if isinstance(value, int | float):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    negative = text.startswith("(") and text.endswith(")")
    cleaned = re.sub(r"[^\d.\-]", "", text)
    if cleaned in {"", "-", ".", "-."}:
        return None
    try:
        number = float(cleaned)
    except ValueError:
        return None
    return -abs(number) if negative else number


def build_frame(headers: list[str], rows: list[list[str]]) -> pd.DataFrame:
    """Raw string cells -> DataFrame; columns that are mostly numeric are coerced."""
    names = _dedupe_headers(headers)
    df = pd.DataFrame(rows, columns=names).replace("", None)
    for col in names:
        non_empty = df[col].dropna()
        if non_empty.empty:
            continue
        if non_empty.map(_to_number).notna().mean() >= 0.8:
            df[col] = pd.to_numeric(df[col].map(lambda v: None if pd.isna(v) else _to_number(v)))
    return df


def describe_schema(df: pd.DataFrame) -> list[dict[str, str]]:
    return [
        {"column": str(c), "type": "number" if pd.api.types.is_numeric_dtype(df[c]) else "text"}
        for c in df.columns
    ]


def _ok(summary: str, table: dict | None = None, **values: Any) -> str:
    payload: dict[str, Any] = {"summary": summary, **values}
    if table is not None:
        payload["table"] = table
    return json.dumps(payload, default=str, ensure_ascii=False)


def _headline(value: float | int | None, label: str | None = None) -> dict[str, Any] | None:
    """The key figure of a result, with its words. Skipped for small numbers,
    where spelling them out adds noise."""
    if value is None or abs(value) < 1000:
        return None
    return {"label": label, "value": value, "words": number_to_words(value)}


def _err(message: str) -> str:
    return json.dumps({"error": message})


def _fmt(n: float) -> float | int:
    return int(n) if float(n).is_integer() else round(float(n), 4)


class _ColumnError(Exception):
    pass


def _resolve(df: pd.DataFrame, name: str) -> str:
    wanted = name.strip().lower()
    for col in df.columns:
        if str(col).lower() == wanted:
            return str(col)
    available = ", ".join(map(str, df.columns))
    raise _ColumnError(f"No column named '{name}'. Available columns: {available}")


def _apply_filters(df: pd.DataFrame, filters: list[Filter] | None) -> pd.DataFrame:
    for f in filters or []:
        col = _resolve(df, f.column)
        series = df[col]
        if f.op == "contains":
            mask = series.astype(str).str.contains(str(f.value), case=False, na=False, regex=False)
        elif pd.api.types.is_numeric_dtype(series):
            num = _to_number(f.value)
            if num is None:
                raise _ColumnError(f"Column '{col}' is numeric but filter value '{f.value}' is not")
            mask = {
                "=": series == num,
                "!=": series != num,
                ">": series > num,
                ">=": series >= num,
                "<": series < num,
                "<=": series <= num,
            }[f.op]
        else:
            text = series.astype(str).str.strip().str.lower()
            target = str(f.value).strip().lower()
            if f.op == "=":
                mask = text == target
            elif f.op == "!=":
                mask = text != target
            else:
                raise _ColumnError(
                    f"Operator '{f.op}' only works on numeric columns; '{col}' is text"
                )
        df = df[mask.fillna(False)]
    return df


def _table(df: pd.DataFrame, cols: list[str]) -> dict:
    rows = [
        [None if pd.isna(v) else (_fmt(v) if isinstance(v, float) else v) for v in row]
        for row in df[cols].head(MAX_ROWS_RETURNED).itertuples(index=False, name=None)
    ]
    return {"columns": cols, "rows": rows}


def _numeric_only(series: pd.Series) -> None:
    if not pd.api.types.is_numeric_dtype(series):
        raise _ColumnError(f"'{series.name}' is a text column — only 'count' works on it")


def build_tools(df: pd.DataFrame) -> list[BaseTool]:
    """Tools closed over one request's DataFrame."""

    def describe_sheet() -> str:
        head = df.head(3)
        sample = head.astype(object).where(head.notna(), None).to_dict(orient="records")
        return _ok(
            f"Sheet has {len(df)} rows and {len(df.columns)} columns",
            row_count=len(df),
            columns=describe_schema(df),
            sample_rows=sample,
        )

    def aggregate(column: str, op: Op, filters: list[Filter] | None = None) -> str:
        try:
            col = _resolve(df, column)
            sub = _apply_filters(df, filters)
            if op == "count":
                value: float | int = int(sub[col].notna().sum())
            else:
                _numeric_only(sub[col])
                value = _fmt(getattr(sub[col], op)())
        except _ColumnError as e:
            return _err(str(e))
        return _ok(
            f"{op} of {col} = {value} (over {len(sub)} rows)",
            column=col,
            op=op,
            value=value,
            rows_used=len(sub),
            headline=None if op == "count" else _headline(value),
        )

    def group_by(
        group_column: str,
        value_column: str,
        op: Op = "sum",
        filters: list[Filter] | None = None,
    ) -> str:
        try:
            g = _resolve(df, group_column)
            v = _resolve(df, value_column)
            sub = _apply_filters(df, filters)
            if op != "count":
                _numeric_only(sub[v])
            grouped = sub.groupby(g, dropna=True)[v]
            result = (grouped.count() if op == "count" else getattr(grouped, op)()).sort_values(
                ascending=False
            )
        except _ColumnError as e:
            return _err(str(e))
        out = result.reset_index()
        out.columns = [g, f"{op} of {v}"]
        return _ok(
            f"{op} of {v} by {g} across {len(out)} groups",
            table=_table(out, list(out.columns)),
            groups=len(out),
            rows_used=len(sub),
            headline=None
            if op == "count" or out.empty
            else _headline(_fmt(out.iloc[0, 1]), str(out.iloc[0, 0])),
        )

    def top_n(
        column: str,
        n: int = 5,
        order: Literal["desc", "asc"] = "desc",
        filters: list[Filter] | None = None,
    ) -> str:
        try:
            col = _resolve(df, column)
            sub = _apply_filters(df, filters)
            if not pd.api.types.is_numeric_dtype(sub[col]):
                raise _ColumnError(f"'{col}' is a text column — rank by a numeric column")
        except _ColumnError as e:
            return _err(str(e))
        n = max(1, min(n, MAX_ROWS_RETURNED))
        top = sub.dropna(subset=[col]).sort_values(col, ascending=order == "asc").head(n)
        return _ok(
            f"{'Lowest' if order == 'asc' else 'Highest'} {len(top)} rows by {col}",
            table=_table(top, [str(c) for c in df.columns]),
            rows_used=len(sub),
            headline=None if top.empty else _headline(_fmt(top.iloc[0][col]), col),
        )

    def filter_rows(filters: list[Filter], limit: int = 10) -> str:
        try:
            sub = _apply_filters(df, filters)
        except _ColumnError as e:
            return _err(str(e))
        limit = max(1, min(limit, MAX_ROWS_RETURNED))
        return _ok(
            f"{len(sub)} rows match (showing {min(len(sub), limit)})",
            table=_table(sub, [str(c) for c in df.columns]),
            matching_rows=len(sub),
        )

    return [
        StructuredTool.from_function(
            describe_sheet,
            name="describe_sheet",
            description="Columns, types, row count and sample rows of the sheet.",
            args_schema=_NoArgs,
        ),
        StructuredTool.from_function(
            aggregate,
            name="aggregate",
            description=(
                "One number: sum/mean/median/min/max/count of a column, optionally over "
                "filtered rows. Use for totals, averages, counts."
            ),
        ),
        StructuredTool.from_function(
            group_by,
            name="group_by",
            description=(
                "Aggregate a value column split by a category column (e.g. revenue per "
                "region). Sorted highest first. Use for 'which X has the most Y'."
            ),
        ),
        StructuredTool.from_function(
            top_n,
            name="top_n",
            description="The top or bottom N rows ranked by a numeric column.",
        ),
        StructuredTool.from_function(
            filter_rows,
            name="filter_rows",
            description="Rows matching conditions (max 20 returned) plus the matching count.",
        ),
    ]


def tool_label(name: str, args: dict[str, Any]) -> str:
    """Human-readable step label for the UI."""
    if name == "describe_sheet":
        return "Reading the sheet structure"
    if name == "aggregate":
        return f"Calculating {args.get('op', 'sum')} of {args.get('column', '')}"
    if name == "group_by":
        return f"Grouping {args.get('value_column', '')} by {args.get('group_column', '')}"
    if name == "top_n":
        word = "lowest" if args.get("order") == "asc" else "highest"
        return f"Finding the {word} {args.get('n', 5)} by {args.get('column', '')}"
    if name == "filter_rows":
        return "Filtering rows"
    return name
