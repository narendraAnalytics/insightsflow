import json
from types import SimpleNamespace

import pytest

from app.agent.graph import TextInfo, build_system_prompt
from app.agent.texts import TextError, TextSet
from app.agent.tools import TableSet, build_tools, tool_label
from app.integrations.sarvam import documents as sd
from app.services.insights_service import SheetContext, _text_passages, suggest_questions


def block(i, text, tag="paragraph"):
    return {"block_id": f"b{i}", "text": text, "layout_tag": tag, "reading_order": i}


# The shape Sarvam's Digitise JSON really returns (captured from a 2-page contract).
DIGITISED = [
    {
        "pages": [
            {
                "page_num": 1,
                "blocks": [
                    block(2, "This agreement is made on 1 October 2026 between Acme and Zenith."),
                    block(1, "SERVICE AGREEMENT", "section-title"),
                    block(3, "1. Payment Terms", "section-title"),
                    block(4, "The Client shall pay all invoices within 30 days of receipt."),
                    block(5, "Late payments attract interest at 1.5 percent per month."),
                    block(6, "1", "page-number"),
                ],
            },
            {
                "page_num": 2,
                "blocks": [
                    block(
                        1, "Either party may terminate this agreement with 60 days written notice."
                    ),
                    block(2, "3. Liability", "section-title"),
                    block(
                        3, "The Vendor's total liability shall not exceed Rs 5,00,000 in any year."
                    ),
                ],
            },
        ]
    }
]


@pytest.fixture
def passages():
    return sd.blocks_to_passages(DIGITISED)


def test_blocks_become_page_exact_passages_in_reading_order(passages):
    # a heading opens a passage and keeps the text under it (better for retrieval)
    assert [p["page"] for p in passages] == [1, 1, 2, 2]
    first = passages[0]
    assert first["section"] == "SERVICE AGREEMENT"
    assert first["text"].startswith("SERVICE AGREEMENT This agreement is made")
    payment = passages[1]
    assert payment["section"] == "1. Payment Terms"
    assert "30 days" in payment["text"] and "1.5 percent" in payment["text"]
    assert all(p["text"] != "1" for p in passages)  # the page-number block is dropped


def test_section_carries_across_a_page_break(passages):
    # page 2 opens with text that still belongs to "1. Payment Terms"
    assert passages[2]["page"] == 2 and passages[2]["section"] == "1. Payment Terms"
    assert "60 days" in passages[2]["text"]
    assert passages[3]["section"] == "3. Liability"


def test_long_text_is_split_and_never_spans_pages():
    long = [block(i, "word " * 60) for i in range(1, 8)]
    out = sd.blocks_to_passages([{"pages": [{"page_num": 3, "blocks": long}]}])
    assert len(out) > 1
    assert all(p["page"] == 3 and len(p["text"]) <= sd.MAX_PASSAGE_CHARS + 400 for p in out)


def test_empty_and_malformed_documents_give_no_passages():
    assert sd.blocks_to_passages([]) == []
    assert sd.blocks_to_passages([{"pages": [{"page_num": 1, "blocks": [block(1, "  ")]}]}]) == []
    assert sd.blocks_to_passages([{}]) == []


def test_search_ranks_the_matching_passage_first(passages):
    texts = TextSet({"Agreement": passages})
    hit = texts.search("payment terms")[0]
    assert hit["page"] == 1 and hit["section"] == "1. Payment Terms"
    assert texts.search("liability limit")[0]["page"] == 2
    assert texts.search("terminate notice")[0]["page"] == 2
    assert texts.search("elephants") == []
    assert texts.sources() == ["Agreement"]  # recorded once, in first-use order


def test_search_needs_keywords_and_a_known_document(passages):
    texts = TextSet({"Agreement": passages})
    with pytest.raises(TextError):
        texts.search("the of and")
    with pytest.raises(TextError):
        texts.search("payment", document="Missing")
    assert TextSet({"A": passages}).sources() == []  # nothing read yet


def test_read_gives_an_outline_then_a_page(passages):
    texts = TextSet({"Agreement": passages})
    outline = texts.read()
    assert outline["pages"] == [1, 2]
    assert [o["section"] for o in outline["outline"]][:2] == [
        "SERVICE AGREEMENT",
        "1. Payment Terms",
    ]
    page = texts.read(page=2)
    assert {p["page"] for p in page["passages"]} == {2}
    with pytest.raises(TextError):
        texts.read(page=9)
    with pytest.raises(TextError):
        TextSet({"A": passages, "B": passages}).read()  # which one?


def tools_for(passages, tables=None):
    texts = TextSet({"Agreement": passages})
    tools = build_tools(TableSet(tables or {}), texts=texts)
    return texts, {t.name: t for t in tools}


def test_document_tools_exist_even_without_any_sheet(passages):
    _, tools = tools_for(passages)
    assert {"search_document", "read_document"} <= set(tools)
    assert "aggregate" not in tools  # no tables, so no analysis tools


def test_search_tool_returns_a_table_with_pages(passages):
    texts, tools = tools_for(passages)
    out = json.loads(tools["search_document"].invoke({"query": "payment terms"}))
    assert out["table"]["columns"] == ["Document", "Page", "Section", "Passage"]
    assert out["table"]["rows"][0][:3] == ["Agreement", 1, "1. Payment Terms"]
    miss = json.loads(tools["search_document"].invoke({"query": "elephants"}))
    assert miss["matches"] == 0 and "table" not in miss
    bad = json.loads(tools["search_document"].invoke({"query": "x", "document": "Nope"}))
    assert "error" in bad
    assert texts.sources() == ["Agreement"]


def test_read_tool_outline_and_page(passages):
    _, tools = tools_for(passages)
    outline = json.loads(tools["read_document"].invoke({}))
    assert outline["table"]["columns"] == ["Page", "Section"]
    page = json.loads(tools["read_document"].invoke({"page": 2}))
    assert all(r[1] == 2 for r in page["table"]["rows"])
    assert "error" in json.loads(tools["read_document"].invoke({"page": 99}))


def test_drafts_cite_the_documents_that_were_read(passages):
    texts = TextSet({"Agreement": passages})
    tools = {
        t.name: t
        for t in build_tools(
            TableSet({}), texts=texts, slack_channel={"id": "C1", "name": "general"}
        )
    }
    tools["search_document"].invoke({"query": "payment terms"})
    draft = json.loads(tools["draft_slack_message"].invoke({"text": "Pay within 30 days"}))
    assert draft["draft"]["text"].endswith("Source: Agreement")


def test_tool_labels_are_readable():
    assert "payment" in tool_label("search_document", {"query": "payment"})
    assert tool_label("read_document", {"page": 2}) == "Reading page 2 of the document"
    assert tool_label("read_document", {}) == "Reading the document outline"


def test_system_prompt_lists_documents_and_the_citation_rule():
    prompt = build_system_prompt([], False, documents=[TextInfo("Agreement", 2, 5)])
    assert '"Agreement" — 2 pages, 5 passages' in prompt
    assert "cite the page" in prompt and "no sheets" in prompt
    plain = build_system_prompt([], False)
    assert "cite the page" not in plain and "Text documents" not in plain


def test_text_documents_load_with_unique_names_and_a_label():
    rows = [[1, "Intro", "Hello there"], [2, "Terms", "Pay in 30 days"]]
    doc = lambda name: SimpleNamespace(filename=name, rows=rows)  # noqa: E731
    out = _text_passages([doc("a.pdf"), doc("a.png")], taken={"b"})
    assert list(out) == ["a", "a (2)"]
    assert out["a"][1] == {"page": 2, "section": "Terms", "text": "Pay in 30 days"}
    ctx = SheetContext(tables={}, truncated=False, texts=out)
    assert ctx.label == "a + a (2)"
    assert "Summarise this document in a few lines" in suggest_questions(ctx)
