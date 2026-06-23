# Final Report — Pixelium Consent Commerce

**Internship Program 2026 · Consent-Aware Agent Commerce**

## Executive Summary

We built a working prototype where an e-commerce agent and payment agent communicate via **A2A**, with a **consent broker** enforcing an AP2-inspired mandate chain (Intent → Cart → Payment). Both human-present and human-not-present flows work end-to-end, with audit reconciliation and adversarial testing.

## Design Decisions

### 1. Simplified mandates (HMAC, not W3C VC)

Full AP2 uses Verifiable Credentials and hardware-backed keys. We use HMAC-SHA256 signed JSON envelopes with static demo keys. This preserves the **chain-of-consent** semantics while keeping the 8-week scope achievable.

### 2. Consent broker as gatekeeper

Every payment task passes through the broker. It validates signatures, parent links, expiry, and intent conditions before forwarding to the payment agent. Unauthorized tasks are blocked and logged.

### 3. A2A for agent-to-agent, REST for UI

Agents expose Agent Cards and JSON-RPC. The broker and dashboard use REST for orchestration and audit — simpler for demos and usability testing.

### 4. JSON audit store (not SQLite)

SQLite required native compilation on Windows without VS Build Tools. A JSON file store meets the spec's "SQLite or simple JSON store" option.

### 5. Delegated monitor

Human-not-present flow uses a watch job with `validFrom` / `validUntil` / price ceiling. A background poller executes purchases when conditions are met.

## What Worked

| Area | Result |
|------|--------|
| Real-time flow | Intent → cart → payment → mock charge |
| Delegated flow | Pre-signed intent with SKU/price constraints |
| Broker blocking | Over-budget, forged sig, tampered amount all blocked |
| Audit dashboard | Orders, events, mandate chain viewer, guided wizard |
| A2A SDK | `@a2a-js/sdk` Agent Cards and message exchange |

## What Didn't / Limitations

- **No real payments** — mock processor only (by design)
- **Shared demo keys** — not production key management
- **In-memory replay guard** — payment agent resets on restart
- **Delegated monitor** — in-memory jobs; not persisted across broker restart
- **AP2 fidelity** — simplified; see [MANDATE_FORMAT.md](./MANDATE_FORMAT.md)

## Recommendations

1. **Production**: Replace HMAC with ECDSA + device-bound keys; persist mandates in a tamper-evident store.
2. **Broker**: Run as mandatory sidecar; payment agent should reject direct calls without broker attestation.
3. **Audit**: Move to append-only log (e.g. SQLite with WAL or cloud audit trail).
4. **Usability**: Expand consent wizard user testing (see [USABILITY.md](./USABILITY.md)).
5. **Protocol tracking**: Monitor A2A v1.0 and AP2 VC format as specs stabilize.

## Deliverables Checklist

- [x] Working prototype repository
- [x] Live demo (real-time + delegated)
- [x] Audit dashboard with reconciliation
- [x] Security findings memo
- [x] Final report (this document)
- [x] Usability preview + study template

## Evaluation Self-Assessment

| Criterion | Status |
|-----------|--------|
| Functional correctness | Both flows E2E; broker blocks unauthorized payments |
| Protocol fidelity | Mandate chain + A2A delegation reflect design intent |
| Security awareness | 4 adversarial scenarios documented and blocked |
| Audit quality | Dashboard answers "authorized vs charged" per order |
| Communication | Docs, demo script, dashboard wizard |
