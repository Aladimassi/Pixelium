from __future__ import annotations

from typing import TypedDict


class ProductState(TypedDict, total=False):
    # input
    action: str                      # "search" | "build_cart"
    query: str
    items: list[dict]                # [{sku, quantity}]
    intent_mandate: dict
    # sub-agent outputs
    search_results: list[dict]
    filtered_results: list[dict]
    stock_ok: bool
    ranked_sku: str
    products: list[dict]
    cart_mandate: dict
    error: str
