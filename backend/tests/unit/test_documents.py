import pytest

from app.agent.tools import build_frame
from app.core.errors import AppError
from app.integrations.sarvam import documents as sd
from app.services import document_service
from app.services.insights_service import _NamedTable, _table_names


def test_flatten_repeats_single_values_on_each_row():
    result = {
        "invoice_number": "INV-1",
        "line_items": [
            {"item": "Rice", "quantity": 10, "rate": 1450, "amount": 14500},
            {"item": "Oil", "quantity": 20, "rate": 980, "amount": 19600},
        ],
    }
    headers, rows = sd.flatten_result(result)
    assert headers == ["Invoice Number", "Item", "Quantity", "Rate", "Amount"]
    assert rows == [["INV-1", "Rice", 10, 1450, 14500], ["INV-1", "Oil", 20, 980, 19600]]


def test_flatten_without_an_array_is_one_row():
    headers, rows = sd.flatten_result({"merchant": "Shop", "total": 99.5})
    assert headers == ["Merchant", "Total"]
    assert rows == [["Shop", 99.5]]


def test_flatten_item_key_wins_over_a_clashing_single_value():
    headers, rows = sd.flatten_result({"date": "2026-01-01", "rows": [{"date": "x", "n": 1}]})
    assert headers == ["Date", "N"]
    assert rows == [["x", 1]]


def test_flatten_handles_missing_cells_and_nested_values():
    headers, rows = sd.flatten_result(
        {"tx": [{"a": 1}, {"a": 2, "b": {"x": 1}}], "buyer": {"name": "Z"}}
    )
    assert headers == ["Buyer Name", "A", "B"]
    assert rows[0] == ["Z", 1, None]
    assert rows[1][2] == '{"x": 1}'


def test_flattened_rows_become_a_numeric_table():
    headers, rows = sd.flatten_result(
        {"v": "A", "items": [{"amount": 14500}, {"amount": 19600}, {"amount": None}]}
    )
    df = build_frame(headers, rows)
    assert df["Amount"].sum() == 34100


def test_flatten_caps_rows():
    items = [{"n": i} for i in range(sd.MAX_ROWS + 50)]
    _, rows = sd.flatten_result({"items": items})
    assert len(rows) == sd.MAX_ROWS


@pytest.mark.parametrize("name", list(sd.TEMPLATES))
def test_every_template_passes_sarvams_schema_rules(name):
    assert sd.validate_schema(sd.TEMPLATES[name])


@pytest.mark.parametrize(
    "schema",
    [
        None,
        {"type": "array"},
        {"type": "object", "properties": {}},
        {"type": "object", "properties": {"a": {"type": "string"}}},  # no description
        {
            "type": "object",
            "properties": {"a": {"type": "array", "description": "d", "items": {"type": "object"}}},
        },  # array items need a description too
    ],
)
def test_loose_schemas_are_refused_before_calling_sarvam(schema):
    with pytest.raises(sd.DocumentRejected):
        sd.validate_schema(schema)


def test_schema_is_pulled_out_of_a_fenced_llm_reply():
    schema = '{"type":"object","properties":{"a":{"type":"string","description":"A"}}}'
    reply = f"Here you go:\n```json\n{schema}\n```"
    assert sd.extract_schema_json(reply)["properties"]["a"]["type"] == "string"
    with pytest.raises(sd.DocumentRejected):
        sd.extract_schema_json("sorry, I can't")
    with pytest.raises(sd.DocumentRejected):
        sd.extract_schema_json("{not json}")


PDF = b"%PDF-1.4 hello"


def test_upload_validation():
    document_service.validate_upload("a.pdf", PDF, "application/pdf")
    document_service.validate_upload("a.png", b"\x89PNG\r\n", "image/png")
    for args in [
        ("a.txt", b"hello", "text/plain"),  # wrong type
        ("a.pdf", b"", "application/pdf"),  # empty
        ("a.pdf", b"<html>", "application/pdf"),  # claims PDF, isn't
        ("a.pdf", PDF + b"x" * document_service.MAX_FILE_BYTES, "application/pdf"),  # too big
    ]:
        with pytest.raises(AppError):
            document_service.validate_upload(*args)


def test_document_tables_get_readable_unique_names():
    assert _table_names([_NamedTable("invoice"), _NamedTable("invoice")]) == [
        "invoice",
        "invoice (2)",
    ]


# --- route wiring: multipart parsing and auth, with the service stubbed out -----------------
import uuid  # noqa: E402
from datetime import UTC, datetime  # noqa: E402
from types import SimpleNamespace  # noqa: E402

from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core.security import Principal, get_current_principal  # noqa: E402
from app.main import create_app  # noqa: E402


def _fake_doc(**over):
    base = dict(
        id=uuid.uuid4(), filename="a.pdf", template="invoice", kind="table",
        status="processing", error=None,
        page_count=0, headers=[], rows=[], row_count=0, created_at=datetime.now(UTC),
    )  # fmt: skip
    return SimpleNamespace(**{**base, **over})


async def test_upload_route_parses_multipart_and_returns_202(monkeypatch):
    seen = {}

    async def fake_create(db, user, filename, content, mime, template, prompt):
        seen.update(
            user=user,
            filename=filename,
            content=content,
            mime=mime,
            template=template,
            prompt=prompt,
        )
        return _fake_doc(filename=filename)

    monkeypatch.setattr(document_service, "create_document", fake_create)
    app = create_app()
    app.dependency_overrides[get_current_principal] = lambda: Principal("user_1", None, None, None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.post(
            "/api/v1/documents",
            files={"file": ("inv.pdf", PDF, "application/pdf")},
            data={"template": "custom", "prompt": "every line item"},
        )
    assert res.status_code == 202, res.text
    assert res.json()["status"] == "processing"
    assert seen == dict(
        user="user_1", filename="inv.pdf", content=PDF, mime="application/pdf",
        template="custom", prompt="every line item",
    )  # fmt: skip


async def test_upload_route_requires_sign_in(client):
    res = await client.post(
        "/api/v1/documents",
        files={"file": ("a.pdf", PDF, "application/pdf")},
        data={"template": "invoice"},
    )
    assert res.status_code in (401, 403)
