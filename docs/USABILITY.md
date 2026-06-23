# Usability Study — Consent Approval Screens

## Overview

Lightweight usability check of the consent-approval UI (Week 8, optional deliverable).

## Prototype UI

**Location:** Dashboard → "Guided Purchase (Real-Time Flow)"  
**URL:** http://localhost:3000

### Flow tested

1. **Intent** — Select product, set budget, describe intent
2. **Cart** — Merchant builds cart mandate
3. **Approve** — User reviews items, total, merchant; Approve or Reject
4. **Pay** — Confirm payment mandate and submit

## Study Protocol (template for ~5 participants)

| Step | Task | Success metric |
|------|------|----------------|
| 1 | Complete a purchase using the wizard | ≤ 3 min, no assist |
| 2 | Explain what they approved at step 3 | Correctly names item + total |
| 3 | Reject a purchase | Finds Reject button ≤ 10 s |
| 4 | View mandate chain on an order | Finds "chain" link |

### Questions (post-task)

1. Was the total amount clear before approving?
2. Did you understand the difference between "Approve" (cart) and "Submit Payment"?
3. What would make you trust this for real purchases?

## Predicted Findings (pre-study)

Based on wizard design review:

| Finding | Severity | Recommendation |
|---------|----------|----------------|
| Budget field may confuse users (cents vs dollars) | Low | Label clearly as "Max budget ($)" — done |
| Two-step approve + pay mirrors AP2 cart/payment split | — | Good for protocol fidelity; may feel redundant |
| Mandate chain JSON is technical | Medium | Add human-readable chain summary |
| Reject has no confirmation dialog | Low | Add "Are you sure?" for reject |

## How to Run a Session

1. Start stack: `npm run dev`
2. Open dashboard, use Guided Purchase
3. Record time-on-task and errors
4. Fill participant sheet below

### Participant sheet

```
Participant #: ___
Date: ___
Task 1 time: ___  Errors: ___
Task 2 accurate: Y / N
Task 3 time: ___
Task 4 found chain: Y / N
Trust score (1-5): ___
Notes:
```

## Status

- [x] Consent UI implemented (wizard + approve/reject)
- [ ] Live sessions with 5 participants (fill sheets above)
- [ ] Summary added to final presentation
