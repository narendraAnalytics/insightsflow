import hashlib
import hmac
from types import SimpleNamespace

import pytest
from httpx import AsyncClient

from app.services import credit_service


def _sign(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


@pytest.fixture
def razorpay_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        credit_service,
        "get_settings",
        lambda: SimpleNamespace(
            razorpay_key_id="rzp_test_abc",
            razorpay_key_secret="key-secret",
            razorpay_webhook_secret="hook-secret",
        ),
    )


def test_checkout_signature_accepts_only_the_real_hmac(razorpay_settings: None):
    good = _sign("key-secret", b"order_1|pay_1")
    assert credit_service.verify_checkout_signature("order_1", "pay_1", good)
    # Wrong secret, swapped ids and garbage are all refused.
    assert not credit_service.verify_checkout_signature(
        "order_1", "pay_1", _sign("x", b"order_1|pay_1")
    )
    assert not credit_service.verify_checkout_signature("order_2", "pay_1", good)
    assert not credit_service.verify_checkout_signature("order_1", "pay_1", "")


def test_webhook_signature_is_over_the_raw_body(razorpay_settings: None):
    body = b'{"event":"order.paid"}'
    assert credit_service.verify_webhook_signature(body, _sign("hook-secret", body))
    assert not credit_service.verify_webhook_signature(body + b" ", _sign("hook-secret", body))
    assert not credit_service.verify_webhook_signature(body, "")


def test_webhook_signature_fails_closed_without_a_secret(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        credit_service, "get_settings", lambda: SimpleNamespace(razorpay_webhook_secret=None)
    )
    assert not credit_service.verify_webhook_signature(b"{}", _sign("", b"{}"))


def test_missing_keys_raise_billing_not_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        credit_service,
        "get_settings",
        lambda: SimpleNamespace(razorpay_key_id=None, razorpay_key_secret=None),
    )
    with pytest.raises(credit_service.BillingNotConfigured):
        credit_service.verify_checkout_signature("o", "p", "s")


def test_prices_and_limits():
    assert credit_service.CONNECT_COST == 50
    assert credit_service.QUESTION_COST == 2
    assert credit_service.AUTOMATION_COST == 5
    assert credit_service.MIN_TOPUP < credit_service.MAX_TOPUP


async def test_webhook_rejects_a_bad_signature_before_touching_the_db(
    client: AsyncClient, razorpay_settings: None
):
    resp = await client.post(
        "/api/v1/webhooks/razorpay",
        content=b'{"event":"order.paid"}',
        headers={"X-Razorpay-Signature": "nope"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "webhook_verification_failed"


async def test_billing_endpoints_require_auth(client: AsyncClient):
    assert (await client.get("/api/v1/billing/balance")).status_code in (401, 403)
    resp = await client.post("/api/v1/billing/orders", json={"amount": 100})
    assert resp.status_code in (401, 403)
