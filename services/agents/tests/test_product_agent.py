"""Product Agent tested ALONE — no broker, no payment agent."""
from datetime import datetime, timedelta, timezone

import pytest

from pixelium_agents.product_agent import build_product_agent
from pixelium_agents.shared import create_mandate


@pytest.fixture()
def agent():
    return build_product_agent()


@pytest.fixture()
def intent():
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    payload = {
        "flowMode": "realtime",
        "userId": "test-user",
        "naturalLanguageIntent": "test",
        "conditions": {"maxPriceCents": 20000, "validUntil": expires},
    }
    return create_mandate("intent", "user", payload, expires)


def test_search_finds_headphones(agent):
    result = agent.invoke({"action": "search", "query": "headphones"})
    assert result["ranked_sku"] == "HEADPHONES-NC"
    assert any(p["sku"] == "HEADPHONES-NC" for p in result["products"])


def test_search_ranks_by_relevance(agent):
    result = agent.invoke({"action": "search", "query": "red sneakers"})
    assert result["ranked_sku"] == "SHOE-RED-HIGH"


def test_search_no_match(agent):
    result = agent.invoke({"action": "search", "query": "zzzznotfound"})
    assert result["ranked_sku"] == ""
    assert result["products"] == []


def test_build_cart_signs_mandate(agent, intent):
    result = agent.invoke({
        "action": "build_cart",
        "items": [{"sku": "HEADPHONES-NC", "quantity": 1}],
        "intent_mandate": intent,
    })
    cart = result["cart_mandate"]
    assert cart["type"] == "cart"
    assert cart["signerId"] == "merchant"
    assert cart["parentMandateId"] == intent["id"]
    # 12999 + 8% tax
    assert cart["payload"]["subtotalCents"] == 12999
    assert cart["payload"]["taxCents"] == round(12999 * 0.08)
    assert cart["payload"]["totalCents"] == 12999 + round(12999 * 0.08)


def test_build_cart_multi_items(agent, intent):
    result = agent.invoke({
        "action": "build_cart",
        "items": [
            {"sku": "BOOK-AI-AGENTS", "quantity": 2},
            {"sku": "SHOE-RED-HIGH", "quantity": 1},
        ],
        "intent_mandate": intent,
    })
    payload = result["cart_mandate"]["payload"]
    assert len(payload["items"]) == 2
    assert payload["subtotalCents"] == 2 * 3499 + 12999


def test_build_cart_unknown_sku(agent, intent):
    result = agent.invoke({
        "action": "build_cart",
        "items": [{"sku": "DOES-NOT-EXIST", "quantity": 1}],
        "intent_mandate": intent,
    })
    assert "Unknown SKU" in result["error"]


def test_build_cart_insufficient_stock(agent, intent):
    result = agent.invoke({
        "action": "build_cart",
        "items": [{"sku": "PHONE-17-PRO", "quantity": 999}],
        "intent_mandate": intent,
    })
    assert "Insufficient stock" in result["error"]


def test_build_cart_requires_intent(agent):
    result = agent.invoke({
        "action": "build_cart",
        "items": [{"sku": "HEADPHONES-NC", "quantity": 1}],
    })
    assert result["error"] == "intent_mandate required"
