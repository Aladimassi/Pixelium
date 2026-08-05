from __future__ import annotations

from typing import TypedDict


class PaymentState(TypedDict, total=False):
    # input
    mandate_chain: dict              # {intent, cart, payment}
    # proof outputs
    sig_ok: bool
    chain_ok: bool
    amount_ok: bool
    replay_ok: bool
    proof_passed: bool
    proof_errors: list[str]
    # charge outputs
    success: bool
    transaction_id: str
    message: str
    explanation: str
    thinking: str
    risk_notes: list[str]
