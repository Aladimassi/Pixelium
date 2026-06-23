# Submission Checklist

Use this before handing in the Pixelium internship project.

## Repository

- [x] Working prototype in `pixelium-consent-commerce/`
- [x] `npm install && npm run build` succeeds
- [x] `npm run complete` passes (or manual demo + adversarial)

## Required deliverables

| # | Deliverable | Location | Done |
|---|-------------|----------|------|
| 1 | Working prototype repo | `packages/*` | ✅ |
| 2 | Live demo (realtime + delegated) | `npm run demo:*` + dashboard | ✅ |
| 3 | Audit dashboard | http://localhost:3000 | ✅ |
| 4 | Security findings memo | `docs/SECURITY_FINDINGS.md` | ✅ |
| 5 | Final written report | `docs/FINAL_REPORT.md` | ✅ |
| 6 | Usability (optional) | `docs/USABILITY.md` | ✅ template |

## Demo day (8 min)

Follow `docs/DEMO_SCRIPT.md`:

1. Architecture (1 min)
2. Guided purchase wizard (2 min)
3. Delegated + watch job (2 min)
4. Audit / mandate chain (1 min)
5. Adversarial tests (1 min)
6. Q&A

## Evaluation criteria self-check

| Criterion | Evidence |
|-----------|----------|
| Functional correctness | Both flows E2E; broker blocks bad payments |
| Protocol fidelity | Intent→Cart→Payment chain; A2A Agent Cards |
| Security awareness | 4 adversarial scenarios blocked |
| Audit quality | Dashboard: authorized vs charged per order |
| Communication | FINAL_REPORT + DEMO_SCRIPT |

## Optional polish before submit

- [ ] Record a 3-min screen capture of guided purchase
- [ ] Run 1 usability self-test (fill sheet in USABILITY.md)
- [ ] Zip repo excluding `node_modules/`

## One-line proof

```powershell
npm run complete
```

All weeks should show `[OK]`.
