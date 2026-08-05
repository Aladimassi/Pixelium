"""HTTP server for the Payment Agent (port 4002)."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from ..payment_agent import build_payment_agent
from .common import agent_card, create_agent_app, health_payload, service_root
from .schemas import PaymentInvokeRequest, PaymentInvokeResponse

PORT = int(os.getenv("PAYMENT_PORT", "4002"))
SERVICE_NAME = "Pixelium Payment Agent (LangGraph)"
agent = build_payment_agent()

app = create_agent_app(title=SERVICE_NAME)


@app.get("/")
def root() -> dict[str, Any]:
    return service_root(
        service=SERVICE_NAME,
        port=PORT,
        message="API only — called by the consent broker to process payments",
        skills=[{"id": "process_payment", "name": "Process Payment"}],
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return health_payload(agent=SERVICE_NAME, port=PORT)


@app.get("/.well-known/agent-card.json")
def agent_card_route() -> dict[str, Any]:
    return agent_card(
        name="Pixelium Payment Agent",
        description="LangGraph proof pipeline + autonomous mock charge",
        port=PORT,
        skills=[{"id": "process_payment", "name": "Process Payment"}],
    )


@app.post("/invoke")
def invoke(body: PaymentInvokeRequest) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    if body.action != "process_payment" or not body.mandateChain:
        return PaymentInvokeResponse(
            success=False,
            timestamp=now,
            message="Expected action: process_payment with mandateChain",
        ).model_dump(exclude_none=True)

    chain = body.mandateChain
    result = agent.invoke({"mandate_chain": chain})
    amount = chain["payment"]["payload"]["amountCents"]

    return PaymentInvokeResponse(
        success=bool(result.get("success")),
        transactionId=result.get("transaction_id", ""),
        amountCents=amount,
        timestamp=now,
        message=result.get("message") or result.get("explanation", ""),
        explanation=result.get("explanation"),
        proofErrors=result.get("proof_errors"),
        thinking=result.get("thinking"),
        riskNotes=result.get("risk_notes"),
    ).model_dump(exclude_none=True)
