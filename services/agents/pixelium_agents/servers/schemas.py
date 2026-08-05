"""Pydantic request/response models — camelCase for Node broker compatibility."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CartItemInput(BaseModel):
    sku: str
    quantity: int = 1
    name: str | None = None
    unitPriceCents: int | None = None
    inStock: int | None = None


class ProductInvokeRequest(BaseModel):
    action: str
    query: str | None = None
    items: list[CartItemInput] | None = None
    intentMandate: dict[str, Any] | None = None


class ProductSearchResponse(BaseModel):
    products: list[dict[str, Any]] = Field(default_factory=list)
    rankedSku: str = ""
    thinking: str | None = None


class ProductCartResponse(BaseModel):
    cartMandate: dict[str, Any] | None = None
    error: str | None = None
    thinking: str | None = None
    warnings: list[str] | None = None


class PaymentInvokeRequest(BaseModel):
    action: str
    mandateChain: dict[str, Any] | None = None


class PaymentInvokeResponse(BaseModel):
    success: bool
    transactionId: str = ""
    amountCents: int = 0
    timestamp: str
    message: str = ""
    explanation: str | None = None
    proofErrors: list[str] | None = None
    thinking: str | None = None
    riskNotes: list[str] | None = None
