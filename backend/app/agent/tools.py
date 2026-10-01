"""Vetted, read-only analysis tools over one sheet. The LLM chooses a tool and
its arguments; every number is computed here with pandas — the model never does
arithmetic. Tools return JSON strings: {"summary", "table"?, ...values}.
"""

import json
import re
from collections.abc import Callable
from datetime import UTC
from email.utils import parseaddr, parsedate_to_datetime
from html import unescape
from typing import Any, Literal

import pandas as pd
from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel

from app.agent.numbers import number_to_words
from app.core.errors import AppError
from app.integrations.google.gmail import clean_body, clean_subject, parse_recipient

MAX_ROWS_RETURNED = 20
Op = Literal["sum", "mean", "median", "min", "max", "count"]
FilterOp = Literal["=", "!=", ">", ">=", "<", "<=", "contains"]


class Filter(BaseModel):
    column: str
    op: FilterOp
    value: str | float | int


def _dedupe_headers(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out: list[str] = []
    for i, raw in enumerate(headers):
        name = str(raw).strip() or f"Column {i + 1}"
        seen[name] = seen.get(name, 0) + 1
        out.append(name if seen[name] == 1 else f"{name} ({seen[name]})")
    return out


_NUMBER = re.compile(r"-?\d+(?:\.\d+)?")
_DECORATION = re.compile(r"[₹$€£¥,\s%]")


def _to_number(value: Any) -> float | None:
    """Parses '₹1,20,000', '$3.5', '12%', '(45)'. Anything else — 'ORD-1001',
    '2026-09-01', 'Rs 5' — is text, not a number (IDs and dates must stay text)."""
    if isinstance(value, int | float):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1]
    text = _DECORATION.sub("", text)
    if not _NUMBER.fullmatch(text):
        return None
    number = float(text)
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


class _ToolError(Exception):
    pass


def _resolve(df: pd.DataFrame, name: str) -> str:
    wanted = name.strip().lower()
    for col in df.columns:
        if str(col).lower() == wanted:
            return str(col)
    available = ", ".join(map(str, df.columns))
    raise _ToolError(f"No column named '{name}'. Available columns: {available}")


def _apply_filters(df: pd.DataFrame, filters: list[Filter] | None) -> pd.DataFrame:
    for f in filters or []:
        col = _resolve(df, f.column)
        series = df[col]
        if f.op == "contains":
            mask = series.astype(str).str.contains(str(f.value), case=False, na=False, regex=False)
        elif pd.api.types.is_numeric_dtype(series):
            num = _to_number(f.value)
            if num is None:
                raise _ToolError(f"Column '{col}' is numeric but filter value '{f.value}' is not")
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
                raise _ToolError(
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
        raise _ToolError(f"'{series.name}' is a text column — only 'count' works on it")


MAX_JOIN_ROWS = 100_000
MAX_JOIN_FANOUT = 20  # a join may not grow rows beyond this multiple of the larger input


class TableSet:
    """The named tables one chat can query, plus any joins made along the way.
    Per-request state: joins register a new table that later tool calls can use."""

    def __init__(self, tables: dict[str, pd.DataFrame]):
        self.tables = dict(tables)

    def resolve(self, name: str | None) -> tuple[str, pd.DataFrame]:
        if name is None or not name.strip():
            if len(self.tables) == 1:
                return next(iter(self.tables.items()))
            raise _ToolError(
                "Several tables are available — pass table=<name>. "
                f"Tables: {', '.join(self.tables)}"
            )
        wanted = name.strip().lower()
        for key, frame in self.tables.items():
            if key.lower() == wanted:
                return key, frame
        raise _ToolError(f"No table named '{name}'. Tables: {', '.join(self.tables)}")

    def register(self, wanted: str, frame: pd.DataFrame) -> str:
        name, n = wanted, 2
        while name in self.tables:
            name, n = f"{wanted}_{n}", n + 1
        self.tables[name] = frame
        return name


def _norm_key(series: pd.Series) -> pd.Series:
    """Join keys compare case- and whitespace-insensitively for text; numbers as-is."""
    if pd.api.types.is_numeric_dtype(series):
        return series.astype("float64")
    text = series.astype("string").str.strip().str.lower()
    return text.where(text != "")


def _join(
    tables: TableSet, left: str, right: str, left_on: str, right_on: str, how: str
) -> tuple[str, pd.DataFrame, dict[str, Any]]:
    lname, ldf = tables.resolve(left)
    rname, rdf = tables.resolve(right)
    if lname == rname:
        raise _ToolError("Pick two different tables to join")
    lcol, rcol = _resolve(ldf, left_on), _resolve(rdf, right_on)
    if pd.api.types.is_numeric_dtype(ldf[lcol]) != pd.api.types.is_numeric_dtype(rdf[rcol]):
        raise _ToolError(
            f"'{lcol}' and '{rcol}' have different types (number vs text) — can't join"
        )

    lkey, rkey = _norm_key(ldf[lcol]), _norm_key(rdf[rcol])

    # Refuse joins that would explode (many-to-many on a non-unique key) BEFORE building them.
    lcount, rcount = lkey.value_counts(), rkey.value_counts()
    matched_pairs = int((lcount * rcount.reindex(lcount.index).fillna(0)).sum())
    estimated = matched_pairs + (int((~lkey.isin(rkey)).sum()) if how == "left" else 0)
    limit = min(MAX_JOIN_ROWS, MAX_JOIN_FANOUT * max(len(ldf), len(rdf), 1))
    if estimated > limit:
        raise _ToolError(
            f"Joining on '{lcol}' = '{rcol}' would create ~{estimated:,} rows because the key "
            "repeats in both tables. Choose a column that is unique in at least one table."
        )

    # Right-hand columns that clash with the left get the table name as a suffix.
    clash = {c: f"{c} ({rname})" for c in rdf.columns if c in ldf.columns}
    merged = (
        ldf.assign(__key=lkey)
        .merge(rdf.rename(columns=clash).assign(__key=rkey), on="__key", how=how)
        .drop(columns="__key")
        .reset_index(drop=True)
    )
    stats = {
        "left_rows": len(ldf),
        "right_rows": len(rdf),
        "left_matched": int(lkey.isin(rkey).sum()),
        "left_unmatched": int((~lkey.isin(rkey)).sum()),
        "right_unmatched": int((~rkey.isin(lkey)).sum()),
        "right_key_unique": bool(not rkey.dropna().duplicated().any()),
        "renamed_columns": clash,
    }
    return f"{lname}_{rname}", merged, stats


def _email_card(raw: dict[str, Any]) -> dict[str, Any]:
    """One inbox message as UI-ready fields: the sender's display name and address
    split apart, and the Date header as an ISO-8601 UTC string (None if unparseable)."""
    name, address = parseaddr(raw.get("sender", ""))
    try:
        when = parsedate_to_datetime(raw.get("date", ""))
        if when.tzinfo is None:
            when = when.replace(tzinfo=UTC)
        iso: str | None = when.astimezone(UTC).isoformat()
    except (TypeError, ValueError):
        iso = None
    return {
        "name": name or address or "Unknown sender",
        "address": address,
        "subject": raw.get("subject", "").strip() or "(no subject)",
        "date": iso,
        # Gmail's own short preview (HTML-escaped); the full body is never fetched.
        "snippet": unescape(raw.get("snippet", "")).strip()[:160],
        "unread": bool(raw.get("unread", False)),
    }


def build_tools(
    tables: TableSet | pd.DataFrame,
    fetch_emails: Callable[[int], list[dict[str, Any]]] | None = None,
    can_draft_email: bool = False,
) -> list[BaseTool]:
    """Tools closed over one request's tables. A bare DataFrame is accepted for
    the single-sheet case and becomes a one-table set named 'sheet'.
    `fetch_emails(count)` (rows of sender/subject/date) enables `recent_emails`
    — it is only passed when the user's Gmail connection may read mail.
    `can_draft_email` enables `draft_email`, which never sends: it only returns a
    draft for the user to review and send from the UI."""
    if isinstance(tables, pd.DataFrame):
        tables = TableSet({"sheet": tables})

    def draft_email(subject: str, body: str, to: str = "") -> str:
        # Sarvam once trailed a body with runaway HTML (`</span></div>…`). Emails here are
        # plain text, so anything from the first tag-like sequence on is dropped.
        body = re.split(r"<[a-zA-Z/!]", body, maxsplit=1)[0]
        subject, body = clean_subject(subject), clean_body(body)
        if not subject or not body:
            return _err("A draft needs both a subject and a message body")
        # An address that isn't one valid recipient is dropped: the user types it on the card.
        recipient = parse_recipient(to) if to else None
        return _ok(
            "Email draft prepared and shown to the user to review. It has NOT been sent.",
            draft={"to": recipient or "", "subject": subject, "body": body, "status": "draft"},
        )

    def recent_emails(count: int = 5) -> str:
        assert fetch_emails is not None
        try:
            rows = fetch_emails(max(1, min(count, 10)))
        except Exception as e:  # network / Gmail failure — let the model explain it
            return _err(str(e) if isinstance(e, AppError) else "Could not read Gmail right now.")
        # Structured `emails` (not a table): the UI renders them as readable cards,
        # so the model only needs to add a short sentence, not repeat the list.
        return _ok(
            f"{len(rows)} most recent inbox email(s)",
            emails=[_email_card(r) for r in rows],
        )

    def describe_sheet(table: str | None = None) -> str:
        try:
            names = [table] if table else list(tables.tables)
            described = []
            for n in names:
                name, df = tables.resolve(n)
                head = df.head(3)
                described.append(
                    {
                        "table": name,
                        "row_count": len(df),
                        "columns": describe_schema(df),
                        "sample_rows": head.astype(object)
                        .where(head.notna(), None)
                        .to_dict(orient="records"),
                    }
                )
        except _ToolError as e:
            return _err(str(e))
        return _ok(f"{len(described)} table(s) described", tables=described)

    def join_tables(
        left: str,
        right: str,
        left_on: str,
        right_on: str,
        how: Literal["inner", "left"] = "inner",
    ) -> str:
        try:
            wanted, merged, stats = _join(tables, left, right, left_on, right_on, how)
        except _ToolError as e:
            return _err(str(e))
        name = tables.register(wanted, merged)
        note = "" if stats["right_key_unique"] else " (right key repeats — rows may multiply)"
        return _ok(
            f"Joined {left} with {right} on {left_on} = {right_on}: {len(merged)} rows; "
            f"{stats['left_matched']}/{stats['left_rows']} left rows matched, "
            f"{stats['left_unmatched']} left and {stats['right_unmatched']} right rows "
            f"had no match{note}. Use table='{name}' for the joined data.",
            joined_table=name,
            row_count=len(merged),
            columns=describe_schema(merged),
            **stats,
        )

    def aggregate(
        column: str, op: Op, table: str | None = None, filters: list[Filter] | None = None
    ) -> str:
        try:
            tname, df = tables.resolve(table)
            col = _resolve(df, column)
            sub = _apply_filters(df, filters)
            if op == "count":
                value: float | int = int(sub[col].notna().sum())
            else:
                _numeric_only(sub[col])
                value = _fmt(getattr(sub[col], op)())
        except _ToolError as e:
            return _err(str(e))
        return _ok(
            f"{op} of {col} = {value} (over {len(sub)} rows of {tname})",
            source_table=tname,
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
        table: str | None = None,
        filters: list[Filter] | None = None,
    ) -> str:
        try:
            tname, df = tables.resolve(table)
            g = _resolve(df, group_column)
            v = _resolve(df, value_column)
            sub = _apply_filters(df, filters)
            if op != "count":
                _numeric_only(sub[v])
            grouped = sub.groupby(g, dropna=True)[v]
            result = (grouped.count() if op == "count" else getattr(grouped, op)()).sort_values(
                ascending=False
            )
        except _ToolError as e:
            return _err(str(e))
        out = result.reset_index()
        out.columns = [g, f"{op} of {v}"]
        return _ok(
            f"{op} of {v} by {g} across {len(out)} groups (in {tname})",
            table=_table(out, list(out.columns)),
            source_table=tname,
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
        table: str | None = None,
        filters: list[Filter] | None = None,
    ) -> str:
        try:
            tname, df = tables.resolve(table)
            col = _resolve(df, column)
            sub = _apply_filters(df, filters)
            if not pd.api.types.is_numeric_dtype(sub[col]):
                raise _ToolError(f"'{col}' is a text column — rank by a numeric column")
        except _ToolError as e:
            return _err(str(e))
        n = max(1, min(n, MAX_ROWS_RETURNED))
        top = sub.dropna(subset=[col]).sort_values(col, ascending=order == "asc").head(n)
        return _ok(
            f"{'Lowest' if order == 'asc' else 'Highest'} {len(top)} rows by {col} (in {tname})",
            table=_table(top, [str(c) for c in df.columns]),
            source_table=tname,
            rows_used=len(sub),
            headline=None if top.empty else _headline(_fmt(top.iloc[0][col]), col),
        )

    def filter_rows(filters: list[Filter], limit: int = 10, table: str | None = None) -> str:
        try:
            tname, df = tables.resolve(table)
            sub = _apply_filters(df, filters)
        except _ToolError as e:
            return _err(str(e))
        limit = max(1, min(limit, MAX_ROWS_RETURNED))
        return _ok(
            f"{len(sub)} rows match in {tname} (showing {min(len(sub), limit)})",
            table=_table(sub.head(limit), [str(c) for c in df.columns]),
            source_table=tname,
            matching_rows=len(sub),
        )

    mail_tools: list[BaseTool] = (
        [
            StructuredTool.from_function(
                recent_emails,
                name="recent_emails",
                description=(
                    "The sender, subject and date of the user's most recent inbox emails "
                    "(default 5, max 10). Use for 'show my latest emails'. "
                    "Bodies are not available."
                ),
            )
        ]
        if fetch_emails
        else []
    )
    if can_draft_email:
        mail_tools.append(
            StructuredTool.from_function(
                draft_email,
                name="draft_email",
                description=(
                    "Prepare an email for the user to review and send themselves; this does "
                    "NOT send anything. Write a clear subject and a short, friendly body "
                    "(greeting, the key findings using only numbers from earlier tool "
                    "results, a sign-off). Set `to` ONLY if the user gave that address "
                    "in their message, otherwise leave it empty."
                ),
            )
        )

    if not tables.tables:  # an email-only chat has no sheet tools to offer
        return mail_tools

    return [
        *mail_tools,
        StructuredTool.from_function(
            describe_sheet,
            name="describe_sheet",
            description=(
                "Columns, types, row counts and sample rows. Omit `table` to describe every "
                "available table."
            ),
        ),
        StructuredTool.from_function(
            join_tables,
            name="join_tables",
            description=(
                "Combine two tables on a shared key column (e.g. orders.Customer = "
                "customers.Customer) so a question can use columns from both. Returns a NEW "
                "table name; pass it as `table` to aggregate, group_by, top_n or filter_rows. "
                "Use how='left' to keep every row of the left table."
            ),
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
    where = f" in {args['table']}" if args.get("table") else ""
    if name == "recent_emails":
        return f"Reading your {args.get('count', 5)} latest emails"
    if name == "draft_email":
        return "Drafting your email"
    if name == "describe_sheet":
        return "Reading the sheet structure"
    if name == "join_tables":
        left, right, key = args.get("left", ""), args.get("right", ""), args.get("left_on", "")
        return f"Joining {left} with {right} on {key}"
    if name == "aggregate":
        return f"Calculating {args.get('op', 'sum')} of {args.get('column', '')}{where}"
    if name == "group_by":
        return f"Grouping {args.get('value_column', '')} by {args.get('group_column', '')}{where}"
    if name == "top_n":
        word = "lowest" if args.get("order") == "asc" else "highest"
        return f"Finding the {word} {args.get('n', 5)} by {args.get('column', '')}{where}"
    if name == "filter_rows":
        return f"Filtering rows{where}"
    return name
