import json

import pytest

from app.agent.graph import TableInfo, build_system_prompt, shared_columns
from app.agent.tools import TableSet, build_frame, build_tools, tool_label
from app.services.insights_service import SheetContext, _table_names, suggest_questions

ORDERS = build_frame(
    ["Order ID", "Customer", "Region", "Total"],
    [
        ["O1", "Rahul Sharma", "South", "110000"],
        ["O2", "priya reddy ", "South", "54000"],
        ["O3", "Rahul Sharma", "South", "20000"],
        ["O4", "Ghost Buyer", "North", "5000"],
    ],
)
CUSTOMERS = build_frame(
    ["Customer ID", "Customer", "Region", "Customer Type"],
    [
        ["C1", "Rahul Sharma", "South", "Premium"],
        ["C2", "Priya Reddy", "South", "Regular"],
        ["C3", "No Orders Yet", "West", "Regular"],
    ],
)


@pytest.fixture
def tools():
    tables = TableSet({"Orders": ORDERS, "Customers": CUSTOMERS})
    return {t.name: t for t in build_tools(tables)}


def call(tools, name, **args):
    return json.loads(tools[name].invoke(args))


def join(tools, **kw):
    args = {"left": "Orders", "right": "Customers", "left_on": "Customer", "right_on": "Customer"}
    return call(tools, "join_tables", **{**args, **kw})


def test_inner_join_matches_case_and_whitespace_insensitively(tools):
    res = join(tools)
    assert res["row_count"] == 3  # O1, O2 (case/space-insensitive), O3
    assert res["left_matched"] == 3
    assert res["left_unmatched"] == 1  # Ghost Buyer
    assert res["right_unmatched"] == 1  # No Orders Yet
    assert res["right_key_unique"] is True
    assert res["joined_table"] == "Orders_Customers"


def test_left_join_keeps_unmatched_left_rows(tools):
    assert join(tools, how="left")["row_count"] == 4


def test_clashing_columns_are_renamed_with_table_suffix(tools):
    res = join(tools)
    assert res["renamed_columns"] == {
        "Customer": "Customer (Customers)",
        "Region": "Region (Customers)",
    }
    names = [c["column"] for c in res["columns"]]
    assert "Customer Type" in names and "Region (Customers)" in names


def test_joined_table_is_usable_by_other_tools_and_numbers_are_right(tools):
    joined = join(tools)["joined_table"]
    res = call(tools, "group_by", group_column="Customer Type", value_column="Total", table=joined)
    # Premium: 110000 + 20000, Regular: 54000 — the unmatched 5000 order is excluded.
    assert res["table"]["rows"] == [["Premium", 130000], ["Regular", 54000]]
    assert res["source_table"] == joined


def test_repeated_joins_get_unique_names(tools):
    first = join(tools)["joined_table"]
    second = join(tools)["joined_table"]
    assert first != second


def test_multiple_tables_require_a_table_name(tools):
    res = call(tools, "aggregate", column="Total", op="sum")
    assert "table" in res["error"] and "Orders" in res["error"]


def test_unknown_table_lists_available(tools):
    res = call(tools, "aggregate", column="Total", op="sum", table="Nope")
    assert "Orders" in res["error"] and "Customers" in res["error"]


def test_table_names_resolve_case_insensitively(tools):
    assert call(tools, "aggregate", column="Total", op="sum", table="orders")["value"] == 189000


def test_join_rejects_same_table_and_bad_columns(tools):
    assert "different" in join(tools, right="Orders")["error"]
    assert "Available columns" in join(tools, left_on="Nope")["error"]


def test_join_rejects_number_vs_text_keys(tools):
    res = join(tools, left_on="Total", right_on="Customer")
    assert "different types" in res["error"]


def test_join_refuses_many_to_many_explosion():
    many = build_frame(["K", "V"], [["a", str(i)] for i in range(300)])
    tools = {
        t.name: t
        for t in build_tools(TableSet({"Left": many, "Right": many.rename(columns={"V": "W"})}))
    }
    res = json.loads(
        tools["join_tables"].invoke(
            {"left": "Left", "right": "Right", "left_on": "K", "right_on": "K"}
        )
    )
    assert "would create" in res["error"] and "unique" in res["error"]


def test_single_table_needs_no_table_argument():
    tools = {t.name: t for t in build_tools(ORDERS)}
    assert call(tools, "aggregate", column="Total", op="sum")["value"] == 189000


def test_shared_columns_and_prompt_mention_join_keys():
    infos = [
        TableInfo(
            "Orders",
            4,
            [{"column": "Customer", "type": "text"}, {"column": "Total", "type": "number"}],
        ),
        TableInfo("Customers", 3, [{"column": "customer", "type": "text"}]),
    ]
    assert shared_columns(infos) == {"Customer": ["Orders", "Customers"]}
    prompt = build_system_prompt(infos, truncated=False)
    assert '"Orders" — 4 rows' in prompt and "likely join keys" in prompt


def test_table_names_are_unique():
    class S:  # minimal stand-in for DataSource
        def __init__(self, name, tab):
            self.name, self.tab_title = name, tab

    assert _table_names([S("Book", "Q1"), S("Book", "Q2")]) == ["Q1", "Q2"]
    assert _table_names([S("A", "Sheet1"), S("B", "Sheet1")]) == ["A / Sheet1", "B / Sheet1"]


def test_cross_sheet_suggestion_leads_with_a_join_question():
    ctx = SheetContext(tables={"Orders": ORDERS, "Customers": CUSTOMERS}, truncated=False)
    questions = suggest_questions(ctx)
    assert questions[0] == "Which Customer Type has the highest Total?"
    assert len(questions) <= 4


def test_join_label():
    assert (
        tool_label("join_tables", {"left": "Orders", "right": "Customers", "left_on": "Customer"})
        == "Joining Orders with Customers on Customer"
    )
