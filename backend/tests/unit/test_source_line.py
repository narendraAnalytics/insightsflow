import json

import pandas as pd

from app.agent.tools import TableSet, build_tools, with_source

ORDERS = pd.DataFrame(
    {"Customer": ["a", "b", "c"], "Region": ["N", "S", "N"], "Revenue": [10, 20, 30]}
)
CUSTOMERS = pd.DataFrame({"Customer": ["a", "b", "c"], "Tier": ["gold", "silver", "gold"]})
OTHER = pd.DataFrame({"Region": ["X", "Y"], "Revenue": [1, 2]})
CHANNEL = {"id": "C0123ABCD", "name": "management"}
PAGE = {"id": "0123456789abcdef0123456789abcdef", "title": "Reports"}


def _tools(**tables):
    ts = TableSet(tables)
    built = build_tools(ts, can_draft_email=True, slack_channel=CHANNEL, notion_page=PAGE)
    return ts, {t.name: t for t in built}


def _call(tools, name, **args):
    return json.loads(tools[name].invoke(args))


def _drafts(tools):
    email = _call(tools, "draft_email", subject="S", body="Hello\n\nWest leads.")["draft"]["body"]
    slack = _call(tools, "draft_slack_message", text="West leads")["draft"]["text"]
    notion = _call(tools, "draft_notion_page", title="T", body="- West")["draft"]["body"]
    return email, slack, notion


def test_the_sheet_that_was_read_is_named_in_every_draft():
    _, tools = _tools(Orders=ORDERS, Other=OTHER)
    _call(tools, "group_by", group_column="Region", value_column="Revenue", table="Orders")
    for body in _drafts(tools):
        assert body.endswith("Source: Orders")
        assert "Other" not in body  # selected but never used


def test_describing_a_sheet_does_not_count_as_using_it():
    _, tools = _tools(Orders=ORDERS, Other=OTHER)
    _call(tools, "describe_sheet")  # looks at every table
    _call(tools, "aggregate", column="Revenue", op="sum", table="Orders")
    assert all(b.endswith("Source: Orders") for b in _drafts(tools))


def test_a_join_credits_both_sheets_even_when_analysed_through_the_joined_table():
    ts, tools = _tools(Orders=ORDERS, Customers=CUSTOMERS, Other=OTHER)
    joined = _call(
        tools,
        "join_tables",
        left="Orders",
        right="Customers",
        left_on="Customer",
        right_on="Customer",
    )["joined_table"]
    assert ts.sources() == []  # joining alone isn't reading numbers
    _call(tools, "group_by", group_column="Tier", value_column="Revenue", table=joined)
    assert ts.sources() == ["Orders", "Customers"]
    assert all(b.endswith("Source: Orders, Customers") for b in _drafts(tools))


def test_two_sheets_used_are_both_listed_in_first_use_order():
    _, tools = _tools(Orders=ORDERS, Other=OTHER)
    _call(tools, "aggregate", column="Revenue", op="sum", table="Other")
    _call(tools, "aggregate", column="Revenue", op="sum", table="Orders")
    assert all(b.endswith("Source: Other, Orders") for b in _drafts(tools))


def test_no_analysis_means_no_source_line():
    _, tools = _tools(Orders=ORDERS)
    email, slack, notion = _drafts(tools)
    assert "Source" not in email + slack + notion


def test_a_source_line_written_by_the_model_is_not_duplicated():
    _, tools = _tools(Orders=ORDERS)
    _call(tools, "aggregate", column="Revenue", op="sum")
    body = _call(tools, "draft_notion_page", title="T", body="Total 60\nSource: Orders")["draft"][
        "body"
    ]
    assert body.count("Source") == 1


def test_the_line_always_fits_inside_the_limit():
    out = with_source("x" * 500, ["Sheet"], limit=100)
    assert len(out) <= 100 and out.endswith("Source: Sheet")
    assert with_source("hello", [], limit=100) == "hello"
