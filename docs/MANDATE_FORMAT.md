# Mandate Format (Simplified AP2)

This prototype implements a **simplified mandate chain** inspired by Google's [Agent Payments Protocol (AP2)](https://ap2-protocol.org/), without full W3C Verifiable Credentials.

## Chain: Intent → Cart → Payment

```
User                    Merchant              Broker                 Payment Agent
  │                         │                    │                        │
  │── Intent Mandate ──────►│                    │                        │
  │   (user-signed)         │                    │                        │
  │                         │── Cart Mandate ───►│                        │
  │                         │   (merchant-signed)│                        │
  │── Payment Mandate ──────┼───────────────────►│── validate chain ─────►│
  │   (user-signed)         │                    │                        │
```

## Mandate Envelope

Every mandate shares this structure:

```json
{
  "id": "uuid",
  "type": "intent | cart | payment",
  "version": "1.0",
  "createdAt": "ISO-8601",
  "expiresAt": "ISO-8601",
  "payload": { ... },
  "signerId": "user | merchant | ...",
  "signature": "HMAC-SHA256 hex",
  "parentMandateId": "optional link to parent"
}
```

## Signing

- Algorithm: **HMAC-SHA256**
- Canonical input: `{type}|{signerId}|{parentMandateId}|{sorted JSON payload}`
- Demo keys are in `@pixelium/shared` (`DEMO_KEYS`)

## Intent Mandate Payload

Used for both **realtime** (human-present) and **delegated** (human-not-present) flows.

| Field | Description |
|-------|-------------|
| `flowMode` | `realtime` or `delegated` |
| `userId` | User identifier |
| `naturalLanguageIntent` | Human-readable purchase goal |
| `conditions.maxPriceCents` | Price ceiling |
| `conditions.allowedSkus` | Optional SKU allowlist |
| `conditions.validUntil` | Expiry (ISO-8601) |
| `conditions.validFrom` | Earliest execution time (delegated) |

## Cart Mandate Payload

Merchant-signed lock on items and price.

| Field | Description |
|-------|-------------|
| `cartId` | Unique cart identifier |
| `items[]` | Line items with SKU, qty, unit price |
| `totalCents` | Final total including tax |
| `intentMandateId` | Links to parent intent |

## Payment Mandate Payload

User-signed authorization to charge.

| Field | Description |
|-------|-------------|
| `paymentId` | Order / payment identifier |
| `amountCents` | Must match cart total |
| `cartMandateId`, `intentMandateId` | Chain links |

## Divergence from Full AP2

| Real AP2 | This prototype |
|----------|----------------|
| W3C Verifiable Credentials | HMAC-signed JSON envelopes |
| Hardware-backed device keys | Shared demo secrets |
| Payment network integration | Mock payment agent |
| DID infrastructure | Static signer IDs |

Document all divergences in the final internship report.
