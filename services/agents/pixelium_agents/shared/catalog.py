"""Mock product catalog — mirrors the demo SKUs of the Node project."""
from __future__ import annotations

TAX_RATE = 0.08

MOCK_CATALOG: list[dict] = [
    {"sku": "HEADPHONES-NC", "name": "Noise-Canceling Headphones", "category": "electronics", "price_cents": 12999, "in_stock": 10},
    {"sku": "SHOE-RED-HIGH", "name": "Classic Red High-Top Sneakers", "category": "footwear", "price_cents": 12999, "in_stock": 12},
    {"sku": "BOOK-AI-AGENTS", "name": "Agentic Systems Guide", "category": "books", "price_cents": 3499, "in_stock": 20},
    {"sku": "JACKET-GREEN-M", "name": "Green Field Jacket (M)", "category": "outerwear", "price_cents": 15999, "in_stock": 7},
    {"sku": "PHONE-17-PRO", "name": "Phone 17 Pro", "category": "electronics", "price_cents": 99999, "in_stock": 3},
]

_active: list[dict] = list(MOCK_CATALOG)


def set_active_catalog(products: list[dict]) -> None:
    global _active
    _active = list(products)


def get_active_catalog() -> list[dict]:
    return _active


def get_product(sku: str) -> dict | None:
    found = next((p for p in _active if p["sku"] == sku), None)
    if found:
        return found

    # Cache miss — broker may have MySQL SKUs while agent started on mock fallback
    from .catalog_loader import fetch_product_by_sku

    row = fetch_product_by_sku(sku)
    if row:
        _active.append(row)
        return row
    return None


def search_products(query: str) -> list[dict]:
    words = query.lower().split()
    if not words:
        return []

    def matches(p: dict) -> bool:
        haystack = f"{p['name']} {p['category']} {p['sku']}".lower()
        return any(w in haystack for w in words)

    return [p for p in _active if matches(p)]
