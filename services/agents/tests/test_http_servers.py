"""HTTP server contract tests (camelCase keys for Node broker)."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from pixelium_agents.shared.mandates import create_mandate
from pixelium_agents.servers.product_server import app as product_app
from pixelium_agents.servers.payment_server import app as payment_app


def _intent():
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    payload = {
        "flowMode": "realtime",
        "userId": "demo-user",
        "naturalLanguageIntent": "test",
        "conditions": {"maxPriceCents": 20000, "validUntil": expires},
    }
    return create_mandate("intent", "user", payload, expires)


def test_product_root_and_health():
    client = TestClient(product_app)
    root = client.get("/")
    assert root.status_code == 200
    assert root.json()["status"] == "ok"
    assert "docs" in root.json()["endpoints"]
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["port"] == 4001


def test_payment_root_and_health():
    client = TestClient(payment_app)
    root = client.get("/")
    assert root.status_code == 200
    assert root.json()["status"] == "ok"
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["port"] == 4002


def test_product_invoke_returns_cart_mandate_camelcase():
    client = TestClient(product_app)
    intent = _intent()
    res = client.post("/invoke", json={
        "action": "build_cart",
        "intentMandate": intent,
        "items": [{"sku": "HEADPHONES-NC", "quantity": 1}],
    })
    assert res.status_code == 200
    body = res.json()
    assert "cartMandate" in body
    assert body["cartMandate"]["type"] == "cart"


def test_payment_invoke_returns_camelcase_result():
    client = TestClient(payment_app)
    intent = _intent()
    product_client = TestClient(product_app)
    cart_res = product_client.post("/invoke", json={
        "action": "build_cart",
        "intentMandate": intent,
        "items": [{"sku": "HEADPHONES-NC", "quantity": 1}],
    })
    cart = cart_res.json()["cartMandate"]
    pay_payload = {
        "paymentId": "pay-test-001",
        "cartMandateId": cart["id"],
        "intentMandateId": intent["id"],
        "amountCents": cart["payload"]["totalCents"],
        "currency": "USD",
        "paymentMethod": "mock_card",
        "last4": "4242",
    }
    payment = create_mandate("payment", "user", pay_payload, intent["expiresAt"], cart["id"])
    res = client.post("/invoke", json={
        "action": "process_payment",
        "mandateChain": {"intent": intent, "cart": cart, "payment": payment},
    })
    body = res.json()
    assert body["success"] is True
    assert body["transactionId"].startswith("txn_")
