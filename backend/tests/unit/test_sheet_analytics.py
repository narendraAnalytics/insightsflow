import pandas as pd
import pytest

from app.agent.tools import build_frame
from app.services import sheet_analytics_service as svc


def frame() -> pd.DataFrame:
    headers = ["Order ID", "Date", "Region", "Amount", "Qty"]
    rows = [
        ["1001", "05/09/2026", "North", "₹1,20,000", "2"],
        ["1002", "20/09/2026", "South", "₹80,000", "1"],
        ["1003", "03/10/2026", "North", "₹50,000", "5"],
        ["1004", "11/10/2026", "East", "", "3"],
    ]
    return build_frame(headers, rows)


def test_defaults_pick_measure_group_and_date():
    p = svc.profile_frame(frame())
    # "Order ID" is numeric but ID-like, so the real amount is the default measure.
    assert p.selected.measure == "Amount"
    assert p.selected.group_by == "Region"
    assert p.selected.date_column == "Date"
    assert p.total == 250000.0
    assert p.total_words and "lakh" in p.total_words


def test_breakdown_is_sorted_and_sums_per_group():
    p = svc.profile_frame(frame())
    assert [(b.label, b.value) for b in p.breakdown] == [
        ("North", 170000.0),
        ("South", 80000.0),
        ("East", 0.0),
    ]


def test_trend_is_monthly_and_dayfirst():
    p = svc.profile_frame(frame())
    # 05/09 and 20/09 are September (day-first), not May/20th-month.
    assert [(t.label, t.value) for t in p.trend] == [("2026-09", 200000.0), ("2026-10", 50000.0)]


def test_count_and_mean_aggregates():
    df = frame()
    assert svc.profile_frame(df, agg="count").total == 4.0
    assert svc.profile_frame(df, measure="Qty", agg="mean").total == 2.75


def test_quality_numbers():
    p = svc.profile_frame(frame())
    assert p.rows == 4 and p.columns == 5
    assert p.duplicate_rows == 0
    assert p.missing_pct == 5.0  # 1 of 20 cells
    amount = next(c for c in p.column_profiles if c.name == "Amount")
    assert amount.type == "number" and amount.missing == 1 and amount.max == 120000.0


def test_ids_are_not_dates_or_dimensions_of_numbers():
    p = svc.profile_frame(frame())
    assert p.dates == ["Date"]
    assert "Order ID" in p.measures  # numeric, selectable; just never the default


def test_unknown_columns_are_rejected():
    with pytest.raises(svc.BadSelection):
        svc.profile_frame(frame(), measure="Nope")
    with pytest.raises(svc.BadSelection):
        svc.profile_frame(frame(), group_by="Amount")  # numbers aren't a grouping column


def test_text_only_sheet_falls_back_to_row_counts():
    df = build_frame(["Name", "City"], [["a", "x"], ["b", "x"], ["c", "y"]])
    p = svc.profile_frame(df)
    assert p.selected.measure is None and p.selected.agg == "count"
    assert p.total == 3.0
    assert [(b.label, b.value) for b in p.breakdown] == [("x", 2.0), ("y", 1.0)]
