"""Thin Sarvam Document Intelligence client: schema-based Extract on one uploaded file.

Extract takes a JSON schema and returns the matching values plus a per-field
confidence. We only keep `result` and flatten it into a table (see
`flatten_result`) so the rest of the app — pandas, the agent's vetted tools — treats
a document like any sheet. Sarvam reads at most 10 pages per job and allows ~10 jobs
a minute.

Blocking SDK calls: run via `asyncio.to_thread` from the service layer, like the
Google clients. No FastAPI/DB imports here.
"""

import json
import re
import time
from dataclasses import dataclass
from typing import Any

from sarvamai import SarvamAI

from app.core.config import get_settings
from app.core.errors import AppError

MAX_PAGES = 10
MAX_ROWS = 5000
POLL_SECONDS = 3.0
JOB_TIMEOUT = 150.0  # seconds to wait for Sarvam before giving up
_TERMINAL = {"completed", "partially_completed", "failed", "rejected"}


class SarvamNotConfigured(AppError):
    status_code = 503
    code = "llm_not_configured"


class DocumentRejected(AppError):
    """Sarvam could not read the file (bad schema, unreadable scan, too many pages)."""

    status_code = 422
    code = "document_unreadable"


def _field(type_: str, description: str) -> dict[str, str]:
    return {"type": type_, "description": description}


def _table_schema(
    scalars: dict[str, dict], list_name: str, list_description: str, columns: dict[str, dict]
) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            **scalars,
            list_name: {
                "type": "array",
                "description": list_description,
                "items": {"type": "object", "description": "One row", "properties": columns},
            },
        },
    }


# Ready-made schemas. Each has one array of rows; the top-level single values
# (invoice number, merchant…) repeat on every row so questions can group by them.
TEMPLATES: dict[str, dict[str, Any]] = {
    "invoice": _table_schema(
        {
            "invoice_number": _field("string", "Invoice number"),
            "invoice_date": _field("string", "Invoice date"),
            "vendor": _field("string", "Seller / vendor name"),
            "customer": _field("string", "Buyer / customer name"),
        },
        "line_items",
        "One entry per line item on the invoice",
        {
            "item": _field("string", "Item or service description"),
            "quantity": _field("number", "Quantity"),
            "rate": _field("number", "Unit price"),
            "amount": _field("number", "Line total"),
        },
    ),
    "bank_statement": _table_schema(
        {
            "account_holder": _field("string", "Account holder name"),
            "account_number": _field("string", "Account number"),
        },
        "transactions",
        "One entry per transaction row",
        {
            "date": _field("string", "Transaction date"),
            "description": _field("string", "Narration / description"),
            "debit": _field("number", "Amount withdrawn (empty if a credit)"),
            "credit": _field("number", "Amount deposited (empty if a debit)"),
            "balance": _field("number", "Running balance"),
        },
    ),
    "receipt": _table_schema(
        {
            "merchant": _field("string", "Shop or merchant name"),
            "receipt_date": _field("string", "Date of purchase"),
        },
        "items",
        "One entry per purchased item",
        {
            "item": _field("string", "Item name"),
            "quantity": _field("number", "Quantity"),
            "amount": _field("number", "Item total"),
        },
    ),
}


def validate_schema(schema: Any) -> dict[str, Any]:
    """Sarvam rejects loose schemas: root must be an object with properties, every
    field needs a type AND a description (array items too), nesting <= 4 deep."""
    if not isinstance(schema, dict) or schema.get("type") != "object":
        raise DocumentRejected("The extraction plan must be a JSON object")
    props = schema.get("properties")
    if not isinstance(props, dict) or not props:
        raise DocumentRejected("The extraction plan has no fields")

    def check(node: Any, name: str, depth: int) -> None:
        if depth > 4 or not isinstance(node, dict):
            raise DocumentRejected(f"Field '{name}' is nested too deeply")
        if not node.get("type") or not str(node.get("description", "")).strip():
            raise DocumentRejected(f"Field '{name}' needs a type and a description")
        if node["type"] == "array":
            check(node.get("items"), f"{name}[]", depth + 1)
        if node["type"] == "object":
            for k, v in (node.get("properties") or {}).items():
                check(v, k, depth + 1)

    for key, node in props.items():
        check(node, key, 1)
    return schema


def extract_schema_json(text: str) -> dict[str, Any]:
    """Pulls the JSON object out of an LLM reply (it may wrap it in a code fence)."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise DocumentRejected("Couldn't turn that description into an extraction plan")
    try:
        return validate_schema(json.loads(match.group(0)))
    except json.JSONDecodeError as exc:
        raise DocumentRejected("Couldn't turn that description into an extraction plan") from exc


@dataclass
class Extraction:
    result: dict[str, Any]
    pages: int


def _client() -> SarvamAI:
    key = get_settings().sarvam_api_key
    if not key:
        raise SarvamNotConfigured("SARVAM_API_KEY is not set")
    return SarvamAI(api_subscription_key=key)


def extract(filename: str, content: bytes, mime: str, schema: dict[str, Any]) -> Extraction:
    """Submit -> poll -> fetch. Blocking; the caller runs it in a thread."""
    client = _client()
    try:
        job = client.doc_ai.extract(
            file=[(filename, content, mime)],
            schema=json.dumps(validate_schema(schema)),
            language="en-IN",
            output_format="json",
        )
        deadline = time.monotonic() + JOB_TIMEOUT
        while True:
            status = client.doc_ai.get_status(job_id=job.job_id)
            state = status.status.lower()
            if state in _TERMINAL:
                break
            if time.monotonic() > deadline:
                raise DocumentRejected("Reading the document took too long. Please try again.")
            time.sleep(POLL_SECONDS)
        if state in {"failed", "rejected"}:
            raise DocumentRejected("The document couldn't be read. Try a clearer scan or PDF.")
        results = client.doc_ai.get_results(job_id=job.job_id)
    except AppError:
        raise
    except Exception as exc:  # SDK errors carry request headers — never surface them raw
        detail = getattr(exc, "body", None)
        message = detail.get("message") if isinstance(detail, dict) else None
        raise DocumentRejected(message or "Sarvam couldn't process this document") from exc

    usage = getattr(results, "usage", None)
    pages = int(getattr(usage, "pages_processed", 0) or 0)
    return Extraction(result=dict(results.result or {}), pages=pages)


def _label(key: str) -> str:
    return " ".join(str(key).replace("_", " ").split()).title()


def _scalar(value: Any) -> Any:
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, int | float | str) or value is None:
        return value
    return json.dumps(value, ensure_ascii=False)


def flatten_result(result: dict[str, Any]) -> tuple[list[str], list[list[Any]]]:
    """Extract result -> (headers, rows). The first array of objects supplies the rows;
    single top-level values (invoice number, vendor…) are repeated on each row. With no
    array, the document is one row."""
    scalars = {k: v for k, v in result.items() if not isinstance(v, list | dict)}
    for key, value in result.items():  # one level of nested objects -> "Parent Child"
        if isinstance(value, dict):
            scalars.update(
                {f"{key} {k}": v for k, v in value.items() if not isinstance(v, list | dict)}
            )
    table_key = next(
        (
            k
            for k, v in result.items()
            if isinstance(v, list) and v and all(isinstance(i, dict) for i in v)
        ),
        None,
    )
    items: list[dict[str, Any]] = result[table_key] if table_key else [{}]

    item_keys: list[str] = []
    for item in items:
        for k in item:
            if k not in item_keys:
                item_keys.append(k)
    scalar_keys = [k for k in scalars if k not in item_keys]
    columns = [*scalar_keys, *item_keys]

    rows = [
        [_scalar(scalars.get(k)) if k in scalar_keys else _scalar(item.get(k)) for k in columns]
        for item in items[:MAX_ROWS]
    ]
    return [_label(c) for c in columns], rows
