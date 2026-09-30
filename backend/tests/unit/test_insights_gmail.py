import pandas as pd

from app.agent.graph import build_system_prompt
from app.agent.tools import TableSet, build_tools
from app.services.insights_service import SheetContext, suggest_questions

SHEET = pd.DataFrame({"Region": ["N", "S"], "Revenue": [10.0, 20.0]})


def test_gmail_only_chat_has_only_the_email_tool():
    tools = build_tools(TableSet({}), lambda n: [])
    assert [t.name for t in tools] == ["recent_emails"]


def test_gmail_only_suggestions_are_email_questions():
    ctx = SheetContext(tables={}, truncated=False, gmail_token="tok")
    qs = suggest_questions(ctx)
    assert qs[0] == "Show me my 5 most recent emails"
    assert ctx.label == "Gmail"


def test_no_sheets_and_no_gmail_suggests_nothing():
    assert suggest_questions(SheetContext(tables={}, truncated=False)) == []


def test_sheet_chat_with_gmail_keeps_one_email_starter():
    ctx = SheetContext(tables={"Sales": SHEET}, truncated=False, gmail_token="tok")
    qs = suggest_questions(ctx)
    assert len(qs) <= 4 and qs[-1] == "Show me my 5 most recent emails"
    assert ctx.label == "Sales + Gmail"


def test_sheet_chat_without_gmail_has_no_email_starter():
    ctx = SheetContext(tables={"Sales": SHEET}, truncated=False)
    assert "Show me my 5 most recent emails" not in suggest_questions(ctx)


def test_prompt_with_no_tables_says_email_only():
    assert "only email questions" in build_system_prompt([], False, mail=True)
