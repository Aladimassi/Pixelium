# 8-Week Fast-Track Guide

Complete the entire internship project in **one session**. All weeks are implemented — run verification, then submit docs.

## Fastest path (one command)

```powershell
cd pixelium-consent-commerce
npm run complete
```

This installs, builds, starts services, runs all demos + security tests, and prints a week-by-week status.

---

## Week-by-week map

### Week 1 — Mandate format + repo setup ✅

**Done:** HMAC mandate chain, mock catalog, monorepo.

| Verify | Command / file |
|--------|----------------|
| Mandate spec | `docs/MANDATE_FORMAT.md` |
| Catalog | `packages/shared/src/catalog.ts` |
| Signing | `packages/shared/src/signing.ts` |

---

### Weeks 2–3 — A2A agents ✅

**Done:** E-commerce agent (:4001) + payment agent (:4002) with Agent Cards.

| Verify | Command |
|--------|---------|
| Agent cards | Open http://localhost:4001/.well-known/agent-card.json |
| Health | http://localhost:4001/health and :4002/health |

---

### Week 4 — Consent broker + realtime flow ✅

**Done:** Broker validates mandate chain; blocks unauthorized payments.

| Verify | Command |
|--------|---------|
| Real-time demo | `npm run demo:realtime` |
| Guided UI | Dashboard → Guided Purchase wizard |

---

### Week 5 — Delegated flow ✅

**Done:** Pre-signed intent with price/SKU limits; background monitor.

| Verify | Command |
|--------|---------|
| Delegated demo | `npm run demo:delegated` |
| Watch job | `npm run demo:monitor` |
| Dashboard | Click "Schedule Delegated Watch" |

---

### Week 6 — Audit dashboard ✅

**Done:** Orders, events, reconciliation, mandate chain viewer.

| Verify | URL |
|--------|-----|
| Dashboard | http://localhost:3000 |
| Audit API | http://localhost:4000/api/audit/orders |

---

### Week 7 — Adversarial testing ✅

**Done:** Replay, scope creep, forged approval — all blocked.

| Verify | Command |
|--------|---------|
| Run tests | `npm run test:adversarial` |
| Read memo | `docs/SECURITY_FINDINGS.md` |

---

### Week 8 — Report + demo ✅

**Done:** Final report, demo script, usability template.

| Deliverable | File |
|-------------|------|
| Final report | `docs/FINAL_REPORT.md` |
| Demo script | `docs/DEMO_SCRIPT.md` |
| Usability | `docs/USABILITY.md` |
| Submit checklist | `docs/SUBMISSION_CHECKLIST.md` |

**Optional (15 min):** Run one guided purchase yourself and fill the participant sheet in `USABILITY.md`.

---

## Daily commands

```bash
npm run dev              # start all services
npm run demo:realtime    # week 4
npm run demo:delegated   # week 5
npm run demo:monitor     # week 5 monitor
npm run test:adversarial # week 7
npm run verify           # tests only (services must be up)
npm run complete         # everything
```

## If something fails

| Problem | Fix |
|---------|-----|
| Port in use | Kill old node processes or change ports via env vars |
| Demo connection refused | Run `npm run dev` first |
| Build error | `npm run build -w @pixelium/shared` then full build |
