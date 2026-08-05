"""HTTP server for the Product Agent (port 4001)."""
from __future__ import annotations

import os
from typing import Any

from ..product_agent import build_product_agent
from ..shared.catalog_loader import load_catalog
from .common import agent_card, create_agent_app, health_payload, service_root
from .schemas import ProductCartResponse, ProductInvokeRequest, ProductSearchResponse

PORT = int(os.getenv("ECOMMERCE_PORT", "4001"))
SERVICE_NAME = "Pixelium Product Agent (LangGraph)"
agent = build_product_agent()

app = create_agent_app(title=SERVICE_NAME, on_startup=load_catalog)


@app.get("/")
def root() -> dict[str, Any]:
    return service_root(
        service=SERVICE_NAME,
        port=PORT,
        message="API only — called by the consent broker, not opened in browser for shopping",
        skills=[
            {"id": "search_catalog", "name": "Search Catalog"},
            {"id": "build_cart", "name": "Build Cart"},
        ],
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return health_payload(agent=SERVICE_NAME, port=PORT)


@app.get("/.well-known/agent-card.json")
def agent_card_route() -> dict[str, Any]:
    return agent_card(
        name="Pixelium Product Agent",
        description="LangGraph catalog search and cart mandates",
        port=PORT,
        skills=[
            {"id": "search_catalog", "name": "Search Catalog"},
            {"id": "build_cart", "name": "Build Cart"},
        ],
    )


@app.post("/invoke", response_model=None)
def invoke(body: ProductInvokeRequest) -> dict[str, Any]:
    if body.action == "search":
        result = agent.invoke({"action": "search", "query": body.query or ""})
        return ProductSearchResponse(
            products=result.get("products", []),
            rankedSku=result.get("ranked_sku", ""),
            thinking=result.get("thinking"),
        ).model_dump()

    if body.action == "build_cart":
        payload = {
            "action": "build_cart",
            "items": [item.model_dump(exclude_none=True) for item in (body.items or [])],
            "intent_mandate": body.intentMandate,
        }
        result = agent.invoke(payload)
        if result.get("error", "").startswith("Unknown SKU:"):
            load_catalog()
            result = agent.invoke(payload)
        if result.get("error"):
            return ProductCartResponse(
                error=result["error"],
                thinking=result.get("thinking"),
                warnings=result.get("warnings"),
            ).model_dump(exclude_none=True)
        return ProductCartResponse(
            cartMandate=result.get("cart_mandate"),
            thinking=result.get("thinking"),
            warnings=result.get("warnings") or None,
        ).model_dump(exclude_none=True)

    return ProductCartResponse(error=f"Unknown action: {body.action}").model_dump(exclude_none=True)
