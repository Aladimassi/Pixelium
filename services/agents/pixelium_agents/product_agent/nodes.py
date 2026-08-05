"""Product Agent sub-agents — LLM reasoning when GROQ_API_KEY is set."""
from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from ..shared import TAX_RATE, create_mandate, get_product, search_products
from ..shared.llm_think import think_cart_match, think_rank_products
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
    """Rank products — Groq reasoning when configured, else keyword heuristic."""
    candidates = state.get("filtered_results") or state.get("search_results") or []
    q = state.get("query") or ""
    if not candidates:
        return {"ranked_sku": "", "products": [], "thinking": "No catalog matches for that query."}

    llm = think_rank_products(q, candidates)
    if llm:
        sku = str(llm.get("sku") or "").strip()
        valid = {p["sku"] for p in candidates}
        if sku in valid:
            ordered = sorted(candidates, key=lambda p: p["sku"] != sku)
            return {
                "ranked_sku": sku,
                "products": ordered,
                "thinking": str(llm.get("reasoning") or "Selected best catalog match."),
            }

    q_lower = q.lower()

    def score(p: dict) -> int:
        s = 0
        for word in q_lower.split():
            if word in p["name"].lower():
                s += 2
            if word in p["category"]:
                s += 1
        return s

    ranked = sorted(candidates, key=score, reverse=True)
    top = ranked[0]["sku"] if ranked else ""
    return {
        "ranked_sku": top,
        "products": ranked,
        "thinking": f"Ranked by keyword relevance for “{q}”.",
    }


def parallel_search(state: ProductState) -> ProductState:
    """Run search + filter concurrently, then rank."""
    with ThreadPoolExecutor(max_workers=2) as pool:
        search_out = pool.submit(sub_search, state).result()
        merged = {**state, **search_out}
        filter_out = pool.submit(sub_filter, merged).result()
        merged = {**merged, **filter_out}
    return {**search_out, **filter_out, **sub_rank(merged)}


def sub_think_cart(state: ProductState) -> ProductState:
    """LLM reviews intent vs line items before the merchant signs the cart."""
    intent = state.get("intent_mandate") or {}
    items = state.get("items") or []
    nl = intent.get("payload", {}).get("naturalLanguageIntent", "Purchase request")
    previews: list[dict] = []
    for item in items:
        product = _resolve_line_product(item)
        previews.append(
            {
                "sku": item.get("sku"),
                "name": product["name"] if product else item.get("name"),
                "quantity": item.get("quantity", 1),
            }
        )

    llm = think_cart_match(nl, previews)
    if llm:
        warnings = [str(w) for w in (llm.get("warnings") or []) if w]
        return {
            "thinking": str(llm.get("reasoning") or "Reviewed cart against shopper intent."),
            "warnings": warnings,
        }

    return {
        "thinking": f"Preparing cart for: {nl}",
        "warnings": [],
    }


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
