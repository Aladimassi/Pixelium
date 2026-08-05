"""Product Agent sub-agents. Deterministic except rank (LLM pluggable)."""
from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from ..shared import TAX_RATE, create_mandate, get_product, search_products
from .state import ProductState


def router(state: ProductState) -> ProductState:
    return state


def route_action(state: ProductState) -> str:
    return "build_cart" if state.get("action") == "build_cart" else "search"


def sub_search(state: ProductState) -> ProductState:
    return {"search_results": search_products(state.get("query", ""))}


def sub_filter(state: ProductState) -> ProductState:
    results = state.get("search_results") or search_products(state.get("query", ""))
    in_stock = [p for p in results if p["in_stock"] > 0]
    return {"filtered_results": in_stock}


def _resolve_line_product(item: dict) -> dict | None:
    """Use broker-provided snapshot when present; else local catalog lookup."""
    if item.get("name") and item.get("unitPriceCents") is not None:
        return {
            "sku": item["sku"],
            "name": item["name"],
            "price_cents": int(item["unitPriceCents"]),
            "in_stock": int(item.get("inStock", item.get("in_stock", 999))),
        }
    return get_product(item["sku"])


def sub_stock(state: ProductState) -> ProductState:
    items = state.get("items") or []
    ok = all(
        (p := _resolve_line_product(i)) is not None and p["in_stock"] >= i["quantity"]
        for i in items
    )
    return {"stock_ok": ok}


def sub_rank(state: ProductState) -> ProductState:
    """Rank sub-agent — swap this heuristic for a Groq call in production."""
    candidates = state.get("filtered_results") or state.get("search_results") or []
    q = (state.get("query") or "").lower()

    def score(p: dict) -> int:
        s = 0
        for word in q.split():
            if word in p["name"].lower():
                s += 2
            if word in p["category"]:
                s += 1
        return s

    ranked = sorted(candidates, key=score, reverse=True)
    return {
        "ranked_sku": ranked[0]["sku"] if ranked else "",
        "products": ranked,
    }


def parallel_search(state: ProductState) -> ProductState:
    """Run search + filter concurrently, then rank."""
    with ThreadPoolExecutor(max_workers=2) as pool:
        search_out = pool.submit(sub_search, state).result()
        merged = {**state, **search_out}
        filter_out = pool.submit(sub_filter, merged).result()
        merged = {**merged, **filter_out}
    return {**search_out, **filter_out, **sub_rank(merged)}


def sub_cart_builder(state: ProductState) -> ProductState:
    """Build cart lines, compute tax, sign the Cart Mandate (merchant HMAC)."""
    items = state.get("items") or []
    intent = state.get("intent_mandate")
    if not intent:
        return {"error": "intent_mandate required"}
    if not items:
        return {"error": "items required"}

    line_items: list[dict] = []
    subtotal = 0
    for item in items:
        product = _resolve_line_product(item)
        if not product:
            return {"error": f"Unknown SKU: {item['sku']}"}
        if product["in_stock"] < item["quantity"]:
            return {"error": f"Insufficient stock for {item['sku']}"}
        line_items.append({
            "sku": product["sku"],
            "name": product["name"],
            "quantity": item["quantity"],
            "unitPriceCents": product["price_cents"],
        })
        subtotal += product["price_cents"] * item["quantity"]

    tax = round(subtotal * TAX_RATE)
    payload = {
        "cartId": str(uuid.uuid4()),
        "merchantId": "pixelium-merchant",
        "merchantName": "Pixelium Store",
        "items": line_items,
        "subtotalCents": subtotal,
        "taxCents": tax,
        "totalCents": subtotal + tax,
        "currency": "USD",
        "intentMandateId": intent["id"],
    }
    expires = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    return {"cart_mandate": create_mandate("cart", "merchant", payload, expires, intent["id"])}
