"""Text documents for the agent (Sarvam Digitise): passages the model can search and read,
with page numbers so answers can cite them. No embeddings and no new dependency — a small
BM25-style keyword ranker over passages of a few paragraphs, plus a page reader so the model
can navigate when keywords miss (e.g. "cancel" vs "terminate"). Documents are at most 10 pages.

Per-request state, like TableSet: `used` records which documents actually fed the answer, so
the "Source:" line on a draft is built from what was read, never from the model."""

import math
import re
from typing import Any

MAX_RESULTS = 5
MAX_READ_CHARS = 6000
_WORD = re.compile(r"\w+", re.UNICODE)
_STOP = frozenset(
    "a an and are as at be by for from has have in is it its of on or that the this to was "
    "were will with shall may any all not no".split()
)
K1, B = 1.5, 0.75


class TextError(Exception):
    """A problem the model can fix by changing its arguments (shown to it as a tool error)."""


def _stem(word: str) -> str:
    for suffix in ("ing", "ed", "es", "s"):
        if len(word) > len(suffix) + 3 and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def tokens(text: str) -> list[str]:
    return [_stem(w) for w in _WORD.findall(text.lower()) if w not in _STOP]


class TextSet:
    """The named text documents one chat can search. `docs` maps a table-like name to its
    passages: [{"page": int, "section": str, "text": str}, ...] in reading order."""

    def __init__(self, docs: dict[str, list[dict[str, Any]]] | None = None):
        self.docs = dict(docs or {})
        self._used: list[str] = []

    def __bool__(self) -> bool:
        return bool(self.docs)

    def sources(self) -> list[str]:
        return list(self._used)

    def _mark(self, name: str) -> None:
        if name not in self._used:
            self._used.append(name)

    def _find(self, name: str | None) -> list[str]:
        if name is None or not name.strip():
            return list(self.docs)
        wanted = name.strip().lower()
        for key in self.docs:
            if key.lower() == wanted:
                return [key]
        raise TextError(f"No document named '{name}'. Documents: {', '.join(self.docs)}")

    def search(
        self, query: str, document: str | None = None, limit: int = MAX_RESULTS
    ) -> list[dict]:
        """Top passages for `query`, best first. A heading match counts extra."""
        wanted = tokens(query)
        if not wanted:
            raise TextError("Give a few keywords to search for")
        entries = [(key, p) for key in self._find(document) for p in self.docs[key]]
        indexed = [tokens(p["text"]) + tokens(p.get("section", "")) * 2 for _, p in entries]
        total = max(len(entries), 1)
        average = sum(len(t) for t in indexed) / total or 1.0
        df = {w: sum(1 for t in indexed if w in t) for w in set(wanted)}

        scored: list[tuple[float, int]] = []
        for i, doc_tokens in enumerate(indexed):
            score = 0.0
            for w in set(wanted):
                tf = doc_tokens.count(w)
                if not tf:
                    continue
                idf = math.log(1 + (total - df[w] + 0.5) / (df[w] + 0.5))
                score += idf * tf * (K1 + 1) / (tf + K1 * (1 - B + B * len(doc_tokens) / average))
            if score > 0:
                scored.append((score, i))
        scored.sort(key=lambda s: (-s[0], s[1]))
        hits = []
        for _, i in scored[:limit]:
            key, passage = entries[i]
            self._mark(key)
            hits.append({"document": key, **passage})
        return hits

    def read(self, document: str | None = None, page: int | None = None) -> dict[str, Any]:
        """A page's passages, or (no page) an outline of the document's sections."""
        names = self._find(document)
        if len(names) > 1:
            raise TextError(
                f"Several documents are available — pass document=<name>: {', '.join(names)}"
            )
        key = names[0]
        passages = self.docs[key]
        self._mark(key)
        pages = sorted({p["page"] for p in passages})
        if page is None:
            outline, seen = [], set()
            for p in passages:
                marker = (p["page"], p.get("section", ""))
                if p.get("section") and marker not in seen:
                    seen.add(marker)
                    outline.append({"page": p["page"], "section": p["section"]})
            return {"document": key, "pages": pages, "outline": outline[:60]}
        if page not in pages:
            raise TextError(f"'{key}' has no page {page}. Pages: {pages[0]}-{pages[-1]}")
        chosen, size = [], 0
        for p in passages:
            if p["page"] == page:
                size += len(p["text"])
                if size > MAX_READ_CHARS:
                    break
                chosen.append(p)
        return {"document": key, "page": page, "passages": chosen, "pages": pages}
