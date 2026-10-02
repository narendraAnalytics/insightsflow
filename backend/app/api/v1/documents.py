"""Uploaded documents — Sarvam Extract turns a PDF/image into a table that AI Insights
can query like a sheet. Business logic lives in app/services/document_service.py."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal, get_current_principal
from app.db.models.document import Document
from app.db.session import get_db
from app.services import document_service

router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentOut(BaseModel):
    id: uuid.UUID
    filename: str
    template: str
    status: str  # processing | ready | failed
    error: str | None
    page_count: int
    headers: list[str]
    row_count: int
    created_at: datetime

    @classmethod
    def from_model(cls, d: Document) -> "DocumentOut":
        return cls(
            id=d.id,
            filename=d.filename,
            template=d.template,
            status=d.status,
            error=d.error,
            page_count=d.page_count,
            headers=list(d.headers),
            row_count=d.row_count,
            created_at=d.created_at,
        )


class DocumentPreview(BaseModel):
    filename: str
    headers: list[str]
    rows: list[list]
    row_count: int


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[DocumentOut]:
    docs = await document_service.list_documents(db, principal.user_id)
    return [DocumentOut.from_model(d) for d in docs]


@router.post("", response_model=DocumentOut, status_code=202)
async def upload_document(
    file: Annotated[UploadFile, File()],
    template: Annotated[str, Form()],
    prompt: Annotated[str | None, Form()] = None,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> DocumentOut:
    # Read one byte past the cap so an oversized file is refused, not truncated.
    content = await file.read(document_service.MAX_FILE_BYTES + 1)
    doc = await document_service.create_document(
        db,
        principal.user_id,
        file.filename or "document",
        content,
        file.content_type or "",
        template,
        prompt,
    )
    return DocumentOut.from_model(doc)


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> DocumentOut:
    doc = await document_service.get_document(db, principal.user_id, document_id)
    return DocumentOut.from_model(doc)


@router.get("/{document_id}/preview", response_model=DocumentPreview)
async def preview_document(
    document_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> DocumentPreview:
    doc = await document_service.get_document(db, principal.user_id, document_id)
    headers, rows = document_service.preview(doc)
    return DocumentPreview(
        filename=doc.filename, headers=headers, rows=rows, row_count=doc.row_count
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> None:
    await document_service.delete_document(db, principal.user_id, document_id)
