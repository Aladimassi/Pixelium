# Security Findings Memo

**Project:** Pixelium Consent Commerce  
**Date:** June 2026  
**Scope:** Adversarial pass against consent broker (Week 7)

## Methodology

Four attack scenarios were defined upfront (per internship spec). Tests run via:

```bash
npm run test:adversarial
```

## Findings

### 1. Mandate replay — BLOCKED ✓

**Attack:** Resubmit an already-processed payment mandate.  
**Result:** Payment agent rejects with "Payment already processed (replay rejected)".  
**Mitigation:** In-memory `processedPayments` set on payment agent.

**Production note:** Use idempotency keys + persistent store; broker should also reject duplicate `paymentId`.

---

### 2. Scope creep (price ceiling) — BLOCKED ✓

**Attack:** Cart total ($1,835.99 phone) exceeds intent max ($50.00).  
**Result:** Broker validation fails: "Cart total exceeds max price".  
**Mitigation:** `validateIntentAgainstConditions()` in mandate chain validation.

---

### 3. Forged approval (tampered amount) — BLOCKED ✓

**Attack:** Payment mandate amount changed to $1.00 while keeping original signature.  
**Result:** "Payment amount does not match cart total".  
**Mitigation:** HMAC covers full payload; tampering invalidates signature OR amount mismatch is caught.

---

### 4. Forged signature (wrong signer) — BLOCKED ✓

**Attack:** Attacker registers own key and signs intent.  
**Result:** Chain link errors + broker does not trust unknown signers in production config.  
**Mitigation:** Demo uses fixed `DEMO_KEYS`; only registered signers can produce valid signatures.

**Production note:** Allowlist signer IDs; use asymmetric keys and certificate pinning.

---

## Residual Risks (Out of Scope)

| Risk | Severity | Notes |
|------|----------|-------|
| Demo key leakage | High in prod | Keys are in source code for prototype only |
| Broker bypass | High | Payment agent accepts any valid chain; no broker token |
| No rate limiting | Medium | DoS on agent endpoints |
| JSON audit tampering | Medium | File store is not append-only / signed |

## Conclusion

All four chosen adversarial scenarios were **correctly blocked**. The broker's mandate chain validation is the primary control. Production deployment requires key management, persistent idempotency, and tamper-evident audit storage.
