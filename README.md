# Pixelium Consent Commerce

**Pixelium Internship Program 2026** — Consent-Aware Agent Commerce prototype.

Two A2A-speaking agents (e-commerce + payment) communicate through a **consent broker** that enforces an AP2-inspired mandate chain: **Intent → Cart → Payment**.

## Architecture

```
┌─────────────┐     A2A      ┌──────────────────┐     A2A      ┌───────────────┐
│  E-Commerce │◄────────────►│  Consent Broker  │───────────►│ Payment Agent │
│    Agent    │              │  (validation +   │            │ (mock charge) │
│  :4001      │              │   audit log)     │            │  :4002        │
└─────────────┘              │  :4000           │            └───────────────┘
                             └────────┬─────────┘
                                      │ REST
                             ┌────────▼─────────┐
                             │ Audit Dashboard  │
                             │  :3000           │
                             └──────────────────┘
```

## Fastest way to finish (all 8 weeks)

```powershell
npm run complete
```

Installs, builds, starts services, runs all demos + security tests, prints week status.  
Details: [docs/WEEKS.md](./docs/WEEKS.md) · Submit: [docs/SUBMISSION_CHECKLIST.md](./docs/SUBMISSION_CHECKLIST.md)

## Quick Start

```bash
cd pixelium-consent-commerce
npm install
npm run build
npm run dev
```

Open http://localhost:3000 — use **Guided Purchase** for the consent wizard.

## Commands

```bash
npm run demo:realtime      # Human-present flow
npm run demo:delegated     # Pre-authorized delegated flow
npm run demo:ai           # Groq natural-language purchase
npm run test:adversarial   # Security test pass
npm run verify             # Build + demos + tests (agents must be running)
```

## Packages

| Package | Port | Role |
|---------|------|------|
| `@pixelium/ecommerce-agent` | 4001 | Catalog, cart, merchant-signed Cart Mandate |
| `@pixelium/payment-agent` | 4002 | Mock payment processor |
| `@pixelium/consent-broker` | 4000 | Mandate validation, orchestration, audit API |
| `@pixelium/dashboard` | 3000 | Reconciliation UI + consent wizard |
| `@pixelium/shared` | — | Mandate types, HMAC signing, mock catalog |
| `@pixelium/audit` | — | JSON file audit store |

## Deliverables (complete)

| Deliverable | Location |
|-------------|----------|
| Working prototype | `packages/*` |
| Mandate spec | [docs/MANDATE_FORMAT.md](./docs/MANDATE_FORMAT.md) |
| Final report | [docs/FINAL_REPORT.md](./docs/FINAL_REPORT.md) |
| Security memo | [docs/SECURITY_FINDINGS.md](./docs/SECURITY_FINDINGS.md) |
| Usability study | [docs/USABILITY.md](./docs/USABILITY.md) |
| Demo script | [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) |

## Groq AI

Set `GROQ_API_KEY` in `.env` (see `.env.example`). The broker uses Groq to parse natural-language shopping requests into SKUs and mandate conditions.

```bash
npm run demo:ai "Buy noise-canceling headphones under 400 dollars"
```

Dashboard: **AI Shopping** panel at http://localhost:3000

## Agent Skills (token savings)

Project skills in `.cursor/skills/`:

- **pixelium** — file map + commands (avoids repo-wide search)
- **token-efficient** — general low-token workflow

Mention `@pixelium` or `@token-efficient` in Cursor to load them.

## 8-Week Roadmap

| Week | Focus | Status |
|------|-------|--------|
| 1 | Mandate format, repo, mock catalog | ✅ |
| 2–3 | A2A agents, task handoff | ✅ |
| 4 | Consent broker, realtime flow | ✅ |
| 5 | Delegated flow + monitor | ✅ |
| 6 | Audit dashboard | ✅ |
| 7 | Adversarial tests | ✅ |
| 8 | Report, usability, demo polish | ✅ |

## Protocol References

- [A2A Protocol](https://a2a-protocol.org/)
- [AP2](https://ap2-protocol.org/)
