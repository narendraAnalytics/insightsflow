from types import SimpleNamespace

import pytest
from googleapiclient.errors import HttpError

from app.integrations.google import sheets as gs


def _info(*titles: str) -> gs.SpreadsheetInfo:
    return gs.SpreadsheetInfo(
        name="Book", tabs=[gs.SheetTab(id=i, title=t) for i, t in enumerate(titles)]
    )


def test_a1_quotes_and_escapes_tab_titles():
    assert gs._a1("Sales") == "'Sales'"
    assert gs._a1("Bob's data", "!1:26") == "'Bob''s data'!1:26"


def test_resolve_tab_by_title():
    assert gs._resolve_tab(_info("A", "B"), "B").title == "B"


@pytest.mark.parametrize("empty", [None, ""])
def test_resolve_tab_empty_means_first_tab(empty):
    assert gs._resolve_tab(_info("A", "B"), empty).title == "A"


def test_resolve_tab_unknown_raises():
    with pytest.raises(gs.SheetTabNotFound):
        gs._resolve_tab(_info("A"), "Nope")


def test_resolve_tab_no_tabs_raises():
    with pytest.raises(gs.SheetTabNotFound):
        gs._resolve_tab(_info(), None)


def test_clean_headers_drops_trailing_blanks_only():
    assert gs._clean_headers(["a", "", "c", " ", ""]) == ["a", "", "c"]


def test_row_has_data():
    assert gs._row_has_data(["", " ", "x"])
    assert not gs._row_has_data(["", "  "])


class _Req:
    def __init__(self, status: int | None = None):
        self.status = status

    def execute(self):
        if self.status is None:
            return {"ok": True}
        raise HttpError(SimpleNamespace(status=self.status, reason="x"), b"{}")


def test_execute_passes_through_success():
    assert gs._execute(_Req()) == {"ok": True}


@pytest.mark.parametrize(
    ("status", "error"),
    [
        (404, gs.SheetNotAccessible),
        (403, gs.SheetNotAccessible),
        (429, gs.GoogleRateLimited),
        (500, gs.GoogleApiError),
    ],
)
def test_execute_maps_http_errors(status, error):
    with pytest.raises(error):
        gs._execute(_Req(status))
