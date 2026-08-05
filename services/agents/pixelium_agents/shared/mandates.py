"""AP2-inspired mandate signing — mirrors packages/shared/src/signing.ts."""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

DEMO_KEYS = {
    "user": "pixelium-demo-user-key",
    "merchant": "pixelium-demo-merchant-key",
    "broker": "pixelium-demo-broker-key",
    "payment_agent": "pixelium-demo-payment-key",
}


def _stringify_with_replacer(value, replacer: list[str]) -> str:
    """Mirror Node JSON.stringify(value, sortedTopLevelKeys) — replacer whitelist at every depth."""
    if isinstance(value, dict):
        parts = [
            f"{json.dumps(key)}:{_stringify_with_replacer(value[key], replacer)}"
            for key in replacer
            if key in value
        ]
        return "{" + ",".join(parts) + "}"
    if isinstance(value, list):
        return "[" + ",".join(_stringify_with_replacer(item, replacer) for item in value) + "]"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None:
        return "null"
    return json.dumps(value, ensure_ascii=False)


def _canonical_payload(payload: dict) -> str:
    """Match Node.js JSON.stringify(payload, Object.keys(payload).sort())."""
    return _stringify_with_replacer(payload, sorted(payload.keys()))


def sign_payload(signer_id: str, mandate_type: str, payload: dict, parent_id: str | None = None) -> str:
    secret = DEMO_KEYS[signer_id]
    body = f"{mandate_type}|{signer_id}|{parent_id or ''}|{_canonical_payload(payload)}"
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def create_mandate(
    mandate_type: str,
    signer_id: str,
    payload: dict,
    expires_at: str,
    parent_id: str | None = None,
) -> dict:
    mandate = {
        "id": str(uuid.uuid4()),
        "type": mandate_type,
        "version": "1.0",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "expiresAt": expires_at,
        "payload": payload,
        "signerId": signer_id,
        "parentMandateId": parent_id,
    }
    mandate["signature"] = sign_payload(signer_id, mandate_type, payload, parent_id)
    return mandate


def verify_signature(mandate: dict) -> bool:
    expected = sign_payload(
        mandate["signerId"], mandate["type"], mandate["payload"], mandate.get("parentMandateId")
    )
    return hmac.compare_digest(expected, mandate["signature"])


def is_expired(mandate: dict) -> bool:
    expires = datetime.fromisoformat(mandate["expiresAt"])
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return expires <= datetime.now(timezone.utc)
