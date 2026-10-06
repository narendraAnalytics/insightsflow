from app.services import search_service as svc


def test_short_or_empty_queries_search_nothing():
    assert svc.parse_query(None) == []
    assert svc.parse_query("") == []
    assert svc.parse_query(" a ") == []


def test_query_is_lowercased_split_and_capped():
    assert svc.parse_query("  Sales  Q3 ") == ["sales", "q3"]
    assert len(svc.parse_query("a1 b2 c3 d4 e5 f6 g7")) == svc.MAX_WORDS
    assert len(" ".join(svc.parse_query("x" * 500))) == svc.MAX_QUERY


def test_like_wildcards_are_escaped():
    assert svc.like_pattern("50%") == "%50\\%%"
    assert svc.like_pattern("a_b") == "%a\\_b%"
    assert svc.like_pattern("c:\\x") == "%c:\\\\x%"


def test_snippet_centres_on_the_match_and_collapses_whitespace():
    text = "intro " * 30 + "Total revenue was  42 lakh\n in March " + "tail " * 30
    snippet = svc.make_snippet(text, ["revenue"])
    assert "revenue" in snippet.lower()
    assert "\n" not in snippet and "  " not in snippet
    assert snippet.startswith("…") and snippet.endswith("…")
    assert len(snippet) <= svc.SNIPPET_CHARS + 2


def test_short_text_snippet_has_no_ellipsis():
    assert svc.make_snippet("Revenue by region", ["region"]) == "Revenue by region"


async def test_endpoint_requires_auth(client):
    r = await client.get("/api/v1/search?q=sales")
    assert r.status_code in (401, 403)
