# Live Demo Script

**Duration:** ~8 minutes  
**Prereq:** `npm run dev` (all 4 services running)

## 1. Architecture (1 min)

Open README architecture diagram. Explain:

- E-commerce agent (catalog/cart)
- Payment agent (mock charge)
- **Consent broker** — core contribution; blocks bad payments
- Mandate chain: Intent → Cart → Payment

## 2. Real-Time Flow (2 min)

**Option A — Dashboard wizard**

1. Open http://localhost:3000
2. Guided Purchase: pick sneakers, budget $200, create intent
3. Build cart → **Approve** on consent screen → Submit payment
4. Show order in table with status `matched`

**Option B — One click**

```bash
npm run demo:realtime
```

## 3. Delegated Flow (2 min)

1. Dashboard → "One-Click Delegated" OR `npm run demo:delegated`
2. Explain pre-signed intent with price ceiling + SKU allowlist
3. Show blocked case: phone over $1800 budget (mention tax)

**Monitor demo:**

1. Click "Schedule Delegated Watch" (executes after 3s)
2. Watch jobs table → status `executed`

## 4. Audit & Reconciliation (1 min)

1. Orders table: Authorized vs Charged columns
2. Click **chain** on an order → show full mandate JSON
3. Audit events: intent_created → cart → payment → processed

## 5. Security (1 min)

```bash
npm run test:adversarial
```

Highlight: replay blocked, scope creep blocked, tampered amount blocked.

## 6. Q&A Talking Points

- Simplified AP2 (HMAC vs VC) — see `docs/MANDATE_FORMAT.md`
- A2A Agent Cards at :4001 and :4002 `/.well-known/agent-card.json`
- Production path: device keys, append-only audit, broker attestation

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Dashboard can't reach broker | Ensure broker on :4000 |
| Demo fails connection | Start all agents: `npm run dev` |
| Port in use | Set `ECOMMERCE_PORT`, `PAYMENT_PORT`, `BROKER_PORT`, `DASHBOARD_PORT` |
