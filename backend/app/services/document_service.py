"""Business logic for uploaded documents — no FastAPI imports. Every read/write is
scoped to the requesting user; an id from another user behaves like one that doesn't
exist.

An upload creates a `processing` row and returns at once; `process_document` runs in
the background (own DB session — the request's is closed by then), asks Sarvam to
extract the rows, and flips the row to `ready` or `failed`. The original file is only
ever held in memory for that job."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.llm import build_llm
from app.core.errors import AppError, NotFoundError
from app.db.models.document import Document
from app.db.session import get_sessionmaker
from app.integrations.sarvam import documents as sarvam_documents
from app.services.connection_service import get_or_create_user

logger = structlog.get_logger(__name__)

MAX_DOCUMENTS_PER_USER = 20
MAX_PROCESSING_PER_USER = 2  # Sarvam allows ~10 jobs a minute across everyone
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_PROMPT = 500
STALE_AFTER = timedelta(minutes=5)  # a job older than this died with a restart
ALLOWED_TYPES = {
    "application/pdf": b"%PDF",
    "image/png": b"\x89PNG",
    "image/jpeg": b"\xff\xd8\xff",
}
TEMPLATES = {*sarvam_documents.TEMPLATES, "custom"}

_background: set[asyncio.Task] = set()  # strong refs so a running job isn't garbage collected


class InvalidDocument(AppError):
    status_code = 400
    code = "invalid_document"


class TooManyDocuments(AppError):
    status_code = 409
    code = "too_many_documents"


class DocumentBusy(AppError):
    status_code = 429
    code = "document_busy"


def _fail_if_stale(doc: Document) -> bool:
    if doc.status == "processing" and doc.updated_at < datetime.now(UTC) - STALE_AFTER:
        doc.status = "failed"
        doc.error = "Reading this document was interrupted. Please upload it again."
        return True
    return False


async def list_documents(session: AsyncSession, clerk_user_id: str) -> list[Document]:
    user = await get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc())
    )
    docs = list(result.scalars())
    if any([_fail_if_stale(d) for d in docs]):
        await session.commit()
    return docs


async def get_document(
    session: AsyncSession, clerk_user_id: str, document_id: uuid.UUID
) -> Document:
    user = await get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise NotFoundError("Document not found")
    return doc


async def get_ready_documents(
    session: AsyncSession, clerk_user_id: str, ids: list[uuid.UUID]
) -> list[Document]:
    """The user's documents among `ids` that are ready to query, in `ids` order.
    Unknown ids are skipped (they may be sheet ids)."""
    if not ids:
        return []
    user = await get_or_create_user(session, clerk_user_id)
    result = await session.execute(
        select(Document).where(
            Document.id.in_(ids), Document.user_id == user.id, Document.status == "ready"
        )
    )
    by_id = {d.id: d for d in result.scalars()}
    return [by_id[i] for i in ids if i in by_id]


async def delete_document(
    session: AsyncSession, clerk_user_id: str, document_id: uuid.UUID
) -> None:
    doc = await get_document(session, clerk_user_id, document_id)
    await session.delete(doc)  # chats keep their transcript; the link row cascades
    await session.commit()


def validate_upload(filename: str, content: bytes, mime: str) -> None:
    magic = ALLOWED_TYPES.get(mime)
    if magic is None:
        raise InvalidDocument("Upload a PDF, PNG or JPG file")
    if not content:
        raise InvalidDocument("That file is empty")
    if len(content) > MAX_FILE_BYTES:
        raise InvalidDocument(f"Files can be up to {MAX_FILE_BYTES // (1024 * 1024)} MB")
    if not content.startswith(magic):  # the browser's content-type is only a claim
        raise InvalidDocument("That file doesn't look like a real PDF, PNG or JPG")


async def create_document(
    session: AsyncSession,
    clerk_user_id: str,
    filename: str,
    content: bytes,
    mime: str,
    template: str,
    prompt: str | None,
) -> Document:
    """Validates, records a `processing` row and starts the background job."""
    validate_upload(filename, content, mime)
    if template not in TEMPLATES:
        raise InvalidDocument("Choose what to extract: invoice, bank statement, receipt or custom")
    prompt = (prompt or "").strip() or None
    if template == "custom" and not prompt:
        raise InvalidDocument("Describe what to extract from this document")
    if prompt and len(prompt) > MAX_PROMPT:
        raise InvalidDocument(f"Keep the description under {MAX_PROMPT} characters")

    user = await get_or_create_user(session, clerk_user_id)
    total = await session.scalar(
        select(func.count()).select_from(Document).where(Document.user_id == user.id)
    )
    if (total or 0) >= MAX_DOCUMENTS_PER_USER:
        raise TooManyDocuments(f"You can keep up to {MAX_DOCUMENTS_PER_USER} documents")
    busy = await session.scalar(
        select(func.count())
        .select_from(Document)
        .where(
            Document.user_id == user.id,
            Document.status == "processing",
            Document.updated_at >= datetime.now(UTC) - STALE_AFTER,
        )
    )
    if (busy or 0) >= MAX_PROCESSING_PER_USER:
        raise DocumentBusy("Two documents are already being read. Wait for one to finish.")

    doc = Document(
        user_id=user.id,
        filename=filename[:255] or "document",
        template=template,
        prompt=prompt if template == "custom" else None,
        status="processing",
    )
    session.add(doc)
    await session.commit()

    task = asyncio.create_task(_process(doc.id, filename, content, mime, template, prompt))
    _background.add(task)
    task.add_done_callback(_background.discard)
    return doc


async def draft_schema(prompt: str) -> dict:
    """Turns "invoice number, date and every line item with its amount" into the strict
    schema Sarvam wants. The LLM only drafts the plan; Sarvam reads the document."""
    llm = build_llm()
    system = (
        "Write a JSON schema for extracting data from a document. Reply with ONLY the JSON.\n"
        'Root: {"type":"object","properties":{...}}. Every property needs "type" '
        '(string|number|array|object) and a short "description". If the user wants '
        'repeating rows (line items, transactions), make ONE property of type "array" whose '
        '"items" is {"type":"object","description":"One row","properties":{...}} — every '
        "column inside needs type and description. Put single values (invoice number, "
        "customer) as top-level properties. Use snake_case names. Amounts are type number."
    )
    reply = await asyncio.to_thread(
        llm.invoke, [("system", system), ("human", f"Extract: {prompt}")]
    )
    return sarvam_documents.extract_schema_json(str(reply.content))


async def _process(
    document_id: uuid.UUID,
    filename: str,
    content: bytes,
    mime: str,
    template: str,
    prompt: str | None,
) -> None:
    status, error, pages = "ready", None, 0
    headers: list[str] = []
    rows: list[list] = []
    try:
        schema = (
            await draft_schema(prompt or "")
            if template == "custom"
            else sarvam_documents.TEMPLATES[template]
        )
        extraction = await asyncio.to_thread(
            sarvam_documents.extract, filename, content, mime, schema
        )
        headers, rows = sarvam_documents.flatten_result(extraction.result)
        pages = extraction.pages
        if not rows or not any(any(c not in (None, "") for c in r) for r in rows):
            status, error = "failed", "No data was found. Try a different document type."
    except AppError as exc:
        status, error = "failed", exc.message
    except Exception:
        logger.exception("document_processing_failed", document_id=str(document_id))
        status, error = "failed", "Something went wrong reading this document."

    async with get_sessionmaker()() as session:
        doc = await session.get(Document, document_id)
        if doc is None:  # deleted while it was being read
            return
        doc.status, doc.error, doc.page_count = status, error, pages
        if status == "ready":
            doc.headers, doc.rows, doc.row_count = headers, rows, len(rows)
        await session.commit()


def preview(doc: Document, max_rows: int = 25) -> tuple[list[str], list[list]]:
    return list(doc.headers), [list(r) for r in doc.rows[:max_rows]]
