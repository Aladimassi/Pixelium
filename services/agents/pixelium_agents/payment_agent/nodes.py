"""Payment Agent sub-agents. Proof pipeline is 100% deterministic (no LLM).

The Explainer is the only LLM-pluggable node and runs AFTER the decision.
"""
from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor

from ..shared import is_expired, verify_signature
from .state import PaymentState

# Replay guard store (in-memory, like the Node payment agent)
processed_payments: set[str] = set()


def sub_verify_signatures(state: PaymentState) -> dict:
    chain = state["mandate_chain"]
    errors = []
    for key in ("intent", "cart", "payment"):
        if not verify_signature(chain[key]):
            errors.append(f"Invalid signature on {key} mandate")
        if is_expired(chain[key]):
            errors.append(f"Expired {key} mandate")
    return {"sig_ok": not errors, "errors": errors}


def sub_verify_chain_links(state: PaymentState) -> dict:
    chain = state["mandate_chain"]
    intent, cart, payment = chain["intent"], chain["cart"], chain["payment"]
    errors = []
    if cart.get("parentMandateId") != intent["id"]:
        errors.append("Cart parent does not match intent id")
    if payment.get("parentMandateId") != cart["id"]:
        errors.append("Payment parent does not match cart id")
    if cart["payload"]["intentMandateId"] != intent["id"]:
        errors.append("Cart payload intentMandateId mismatch")
    if payment["payload"]["cartMandateId"] != cart["id"]:
        errors.append("Payment payload cartMandateId mismatch")
    return {"chain_ok": not errors, "errors": errors}


def sub_verify_amount(state: PaymentState) -> dict:
    chain = state["mandate_chain"]
    intent, cart, payment = chain["intent"], chain["cart"], chain["payment"]
    errors = []
    if payment["payload"]["amountCents"] != cart["payload"]["totalCents"]:
        errors.append(
            f"Payment amount {payment['payload']['amountCents']} != cart total {cart['payload']['totalCents']}"
        )
    max_price = intent["payload"]["conditions"]["maxPriceCents"]
    if cart["payload"]["totalCents"] > max_price:
        errors.append(f"Cart total {cart['payload']['totalCents']} exceeds intent max {max_price}")
    allowed = intent["payload"]["conditions"].get("allowedSkus")
    if allowed:
        for item in cart["payload"]["items"]:
            if item["sku"] not in allowed:
                errors.append(f"SKU {item['sku']} not in allowed list")
    return {"amount_ok": not errors, "errors": errors}


def sub_replay_guard(state: PaymentState) -> dict:
    payment_id = state["mandate_chain"]["payment"]["payload"]["paymentId"]
    if payment_id in processed_payments:
        return {"replay_ok": False, "errors": ["Payment already processed (replay rejected)"]}
    return {"replay_ok": True, "errors": []}


def parallel_proof(state: PaymentState) -> PaymentState:
    """Run the 4 proof sub-agents concurrently and merge results."""
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(sub_verify_signatures, state),
            pool.submit(sub_verify_chain_links, state),
            pool.submit(sub_verify_amount, state),
            pool.submit(sub_replay_guard, state),
        ]
        results = [f.result() for f in futures]

    errors: list[str] = []
    merged: PaymentState = {}
    for r in results:
        errors.extend(r.pop("errors"))
        merged.update(r)

    merged["proof_errors"] = errors
    merged["proof_passed"] = not errors
    return merged


def route_after_proof(state: PaymentState) -> str:
    return "charge" if state.get("proof_passed") else "explain"


def sub_charge_executor(state: PaymentState) -> PaymentState:
    """Autonomous mock charge (PayPal-style capture). No LLM involved."""
    payment = state["mandate_chain"]["payment"]["payload"]
    processed_payments.add(payment["paymentId"])
    return {
        "success": True,
        "transaction_id": f"txn_{uuid.uuid4().hex[:8]}",
        "message": f"Mock charge of ${payment['amountCents'] / 100:.2f} approved",
    }


def sub_explainer(state: PaymentState) -> PaymentState:
    """Human-readable outcome. Plug Groq here in production — never decides."""
    if state.get("success"):
        chain = state["mandate_chain"]
        items = ", ".join(
            f"{i['quantity']}x {i['name']}" for i in chain["cart"]["payload"]["items"]
        )
        amount = chain["payment"]["payload"]["amountCents"] / 100
        text = (
            f"APPROVED: charged ${amount:.2f} for {items}. "
            f"Transaction {state.get('transaction_id')}."
        )
    else:
        text = "BLOCKED: " + "; ".join(state.get("proof_errors") or ["unknown error"])
    return {"explanation": text, "success": bool(state.get("success"))}
