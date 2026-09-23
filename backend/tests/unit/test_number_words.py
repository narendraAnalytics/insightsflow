import pytest

from app.agent.numbers import number_to_words


@pytest.mark.parametrize(
    ("value", "words"),
    [
        (0, "Zero"),
        (7, "Seven"),
        (21, "Twenty-one"),
        (312600, "Three lakh twelve thousand six hundred"),
        (88800, "Eighty-eight thousand eight hundred"),
        (100000, "One lakh"),
        (12345678, "One crore twenty-three lakh forty-five thousand six hundred seventy-eight"),
        (1500000000, "One hundred fifty crore"),
        (-2500, "Minus two thousand five hundred"),
        (1234.5, "One thousand two hundred thirty-four point five zero"),
    ],
)
def test_number_to_words(value, words):
    assert number_to_words(value) == words
