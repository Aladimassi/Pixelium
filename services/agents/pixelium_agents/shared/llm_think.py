"""LLM reasoning helpers for product & payment services."""
from __future__ import annotations

import json
from typing import Any

from .groq_client import groq_json_completion


def think_rank_products(query: str, candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not candidates:
        return None
    catalog = [
        {
            "sku": p["sku"],
            "name": p["name"],
            "category": p.get("category", ""),
            "priceCents": p.get("price_cents", p.get("priceCents")),
            "inStock": p.get("in_stock", p.get("inStock")),
        }
        for p in candidates[:12]
    ]
    system = """You are the Product Agent for Pixelium Store.
Pick the BEST catalog match for the shopper query. Use ONLY SKUs from the list.
Return JSON:
{
  "sku": "exact SKU from list",
  "reasoning": "2-3 sentences explaining why this is the best match",
  "confidence": 0.0-1.0
}"""
    user = f"Shopper query: {query}\n\nCandidates:\n{json.dumps(catalog, indent=2)}"
    return groq_json_completion(system, user, temperature=0.2)


def think_cart_match(intent_text: str, line_items: list[dict[str, Any]]) -> dict[str, Any] | None:
    system = """You are the Product Agent reviewing a cart before the merchant signs it.
Compare the user's natural-language intent with the line items.
Return JSON:
{
  "reasoning": "2-4 sentences: does this cart fulfill the intent? any caveats?",
  "warnings": ["optional short warnings, empty if none"],
  "matchScore": 0.0-1.0
}
Never invent products. If items look reasonable, say so clearly."""
    user = json.dumps({"intent": intent_text, "items": line_items}, indent=2)
    return groq_json_completion(system, user, temperature=0.25)


def think_payment_review(chain: dict[str, Any]) -> dict[str, Any] | None:
    intent = chain.get("intent", {}).get("payload", {})
    cart = chain.get("cart", {}).get("payload", {})
    payment = chain.get("payment", {}).get("payload", {})
    summary = {
        "intent": intent.get("naturalLanguageIntent"),
        "flowMode": intent.get("flowMode"),
        "maxPriceCents": intent.get("conditions", {}).get("maxPriceCents"),
        "items": cart.get("items"),
        "cartTotalCents": cart.get("totalCents"),
        "paymentAmountCents": payment.get("amountCents"),
        "last4": payment.get("last4"),
    }
    system = """You are the Payment Agent risk analyst for a consent-first checkout.
Review the mandate summary. You ADVISE only — you do not approve or block payments.
Return JSON:
{
  "reasoning": "2-4 sentences: does this look like a coherent, user-consented purchase?",
  "riskNotes": ["0-3 short notes, e.g. budget headroom, unusual patterns"],
  "comfortScore": 0.0-1.0
}"""
    user = json.dumps(summary, indent=2)
    return groq_json_completion(system, user, temperature=0.2)


def think_explain_payment(
    *,
    success: bool,
    chain: dict[str, Any],
    transaction_id: str | None,
    proof_errors: list[str],
    prior_reasoning: str | None,
) -> str | None:
    items = chain.get("cart", {}).get("payload", {}).get("items", [])
    amount = chain.get("payment", {}).get("payload", {}).get("amountCents", 0)
    system = """You are the Payment Agent explainer. Summarize the payment outcome for the shopper.
Return JSON: { "explanation": "2-3 concise sentences for the shopper" }
Mention items and amount if approved. Never claim payment succeeded if success is false."""
    user = json.dumps(
        {
            "success": success,
            "transactionId": transaction_id,
            "amountCents": amount,
            "items": items,
            "proofErrors": proof_errors,
            "priorAnalysis": prior_reasoning,
        },
        indent=2,
    )
    result = groq_json_completion(system, user, temperature=0.35)
    if result and isinstance(result.get("explanation"), str):
        return result["explanation"].strip()
    if result and isinstance(result.get("reply"), str):
        return result["reply"].strip()
    return None
