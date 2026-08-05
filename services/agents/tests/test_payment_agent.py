"""Payment Agent tested ALONE — chains are built manually, no broker."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from pixelium_agents.payment_agent import build_payment_agent
from pixelium_agents.payment_agent.nodes import processed_payments
from pixelium_agents.shared import create_mandate


def make_chain(
    max_price_cents: int = 20000,
    cart_total_cents: int = 14039,
    payment_amount_cents: int | None = None,
    tamper_cart: bool = False,
    allowed_skus: list[str] | None = None,
) -> dict:
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    conditions: dict = {"maxPriceCents": max_price_cents, "validUntil": expires}
    if allowed_skus is not None:
        conditions["allowedSkus"] = allowed_skus
    intent = create_mandate("intent", "user", {
        "flowMode": "realtime",
        "userId": "test-user",
        "naturalLanguageIntent": "buy headphones",
        "conditions": conditions,
    }, expires)

    cart = create_mandate("cart", "merchant", {
        "cartId": str(uuid.uuid4()),
        "merchantId": "pixelium-merchant",
        "merchantName": "Pixelium Store",
        "items": [{"sku": "HEADPHONES-NC", "name": "Noise-Canceling Headphones",
                   "quantity": 1, "unitPriceCents": 12999}],
        "subtotalCents": 12999,
        "taxCents": cart_total_cents - 12999,
        "totalCents": cart_total_cents,
        "currency": "USD",
        "intentMandateId": intent["id"],
    }, expires, intent["id"])

    if tamper_cart:
        # modify after signing -> signature must fail
        cart["payload"]["totalCents"] = 1

    payment = create_mandate("payment", "user", {
        "paymentId": str(uuid.uuid4()),
        "cartMandateId": cart["id"],
        "intentMandateId": intent["id"],
        "amountCents": payment_amount_cents if payment_amount_cents is not None else cart_total_cents,
        "currency": "USD",
        "paymentMethod": "mock_card",
        "last4": "4242",
    }, expires, cart["id"])

    return {"intent": intent, "cart": cart, "payment": payment}


@pytest.fixture()
def agent():
    processed_payments.clear()
    return build_payment_agent()


def test_valid_chain_charges_autonomously(agent):
    result = agent.invoke({"mandate_chain": make_chain()})
    assert result["success"] is True
    assert result["transaction_id"].startswith("txn_")
    assert "APPROVED" in result["explanation"]


def test_blocks_over_budget(agent):
    chain = make_chain(max_price_cents=1000)  # cart 14039 > max 1000
    result = agent.invoke({"mandate_chain": chain})
    assert not result.get("success")
    assert any("exceeds intent max" in e for e in result["proof_errors"])


def test_blocks_forged_signature(agent):
    chain = make_chain(tamper_cart=True)
    result = agent.invoke({"mandate_chain": chain})
    assert not result.get("success")
    assert any("Invalid signature" in e for e in result["proof_errors"])


def test_blocks_amount_mismatch(agent):
    chain = make_chain(payment_amount_cents=99999)  # payment != cart total
    result = agent.invoke({"mandate_chain": chain})
    assert not result.get("success")
    assert any("!=" in e or "does not match" in e.lower() for e in result["proof_errors"])


def test_blocks_replay(agent):
    chain = make_chain()
    first = agent.invoke({"mandate_chain": chain})
    assert first["success"] is True

    second = agent.invoke({"mandate_chain": chain})
    assert not second.get("success")
    assert any("replay" in e.lower() for e in second["proof_errors"])


def test_blocks_sku_not_allowed(agent):
    chain = make_chain(allowed_skus=["BOOK-AI-AGENTS"])
    result = agent.invoke({"mandate_chain": chain})
    assert not result.get("success")
    assert any("not in allowed list" in e for e in result["proof_errors"])


def test_blocks_broken_chain_link(agent):
    chain = make_chain()
    chain["cart"]["parentMandateId"] = str(uuid.uuid4())  # break link (also breaks sig)
    result = agent.invoke({"mandate_chain": chain})
    assert not result.get("success")


def test_blocked_explanation_lists_reasons(agent):
    chain = make_chain(max_price_cents=1000)
    result = agent.invoke({"mandate_chain": chain})
    assert result["explanation"].startswith("BLOCKED")
