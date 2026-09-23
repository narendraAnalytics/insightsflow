"""Deterministic number -> words in the Indian numbering system (lakh/crore).
Done in code, not by the LLM, so the words always match the computed value."""

_ONES = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
]  # fmt: skip
_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]


def _below_100(n: int) -> str:
    if n < 20:
        return _ONES[n]
    tens, ones = divmod(n, 10)
    return _TENS[tens] + (f"-{_ONES[ones]}" if ones else "")


def _below_1000(n: int) -> str:
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds:
        parts.append(f"{_ONES[hundreds]} hundred")
    if rest:
        parts.append(_below_100(rest))
    return " ".join(parts)


def _int_words(n: int) -> str:
    if n == 0:
        return "zero"
    crore, rest = divmod(n, 10_000_000)
    lakh, rest = divmod(rest, 100_000)
    thousand, rest = divmod(rest, 1_000)
    parts = []
    if crore:
        parts.append(f"{_int_words(crore)} crore")
    if lakh:
        parts.append(f"{_below_100(lakh)} lakh")
    if thousand:
        parts.append(f"{_below_100(thousand)} thousand")
    if rest:
        parts.append(_below_1000(rest))
    return " ".join(parts)


def number_to_words(value: float | int) -> str:
    """312600 -> 'Three lakh twelve thousand six hundred'. Keeps up to 2 decimals."""
    negative = value < 0
    rounded = round(abs(float(value)), 2)
    whole = int(rounded)
    cents = round((rounded - whole) * 100)
    text = _int_words(whole)
    if cents:
        text += " point " + " ".join(_ONES[int(d)] for d in f"{cents:02d}")
    if negative:
        text = "minus " + text
    return text[0].upper() + text[1:]
