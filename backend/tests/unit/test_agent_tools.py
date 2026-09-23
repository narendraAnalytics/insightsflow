import json

import pytest

from app.agent.tools import build_frame, build_tools, tool_label

HEADERS = ["Product", "Region", "Revenue", "Units", ""]
ROWS = [
    ["Laptop", "North", "₹1,20,000", "10", ""],
    ["Phone", "South", "₹80,000", "20", ""],
    ["Laptop", "South", "₹60,000", "5", ""],
    ["Phone", "North", "₹90,000", "", ""],
]


@pytest.fixture
def tools():
    frame = build_frame(HEADERS, ROWS)
    return {t.name: t for t in build_tools(frame)}


def call(tools, name, **args):
    return json.loads(tools[name].invoke(args))


def test_frame_coerces_currency_and_names_blank_header():
    frame = build_frame(HEADERS, ROWS)
    assert frame["Revenue"].sum() == 350000
    assert "Column 5" in frame.columns


def test_aggregate_sum_and_count(tools):
    assert call(tools, "aggregate", column="Revenue", op="sum")["value"] == 350000
    # Units has one blank -> count ignores it
    assert call(tools, "aggregate", column="units", op="count")["value"] == 3


def test_aggregate_with_filter(tools):
    res = call(
        tools,
        "aggregate",
        column="Revenue",
        op="sum",
        filters=[{"column": "Region", "op": "=", "value": "north"}],
    )
    assert res["value"] == 210000
    assert res["rows_used"] == 2


def test_group_by_sorted_desc(tools):
    res = call(tools, "group_by", group_column="Product", value_column="Revenue", op="sum")
    assert res["table"]["rows"] == [["Laptop", 180000], ["Phone", 170000]]


def test_top_n(tools):
    res = call(tools, "top_n", column="Revenue", n=2)
    assert [r[0] for r in res["table"]["rows"]] == ["Laptop", "Phone"]


def test_filter_rows_numeric(tools):
    res = call(tools, "filter_rows", filters=[{"column": "Revenue", "op": ">", "value": 85000}])
    assert res["matching_rows"] == 2


def test_unknown_column_lists_available(tools):
    res = call(tools, "aggregate", column="Profit", op="sum")
    assert "error" in res and "Revenue" in res["error"]


def test_sum_on_text_column_is_rejected(tools):
    assert "error" in call(tools, "aggregate", column="Product", op="sum")


def test_tool_label():
    assert tool_label("group_by", {"value_column": "Revenue", "group_column": "Region"}) == (
        "Grouping Revenue by Region"
    )


def test_group_by_headline_has_words(tools):
    res = call(tools, "group_by", group_column="Product", value_column="Revenue", op="sum")
    assert res["headline"] == {
        "label": "Laptop",
        "value": 180000,
        "words": "One lakh eighty thousand",
    }


def test_small_values_and_counts_have_no_headline(tools):
    assert call(tools, "aggregate", column="Units", op="sum")["headline"] is None
    assert call(tools, "aggregate", column="Revenue", op="count")["headline"] is None
