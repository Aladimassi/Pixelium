---
name: pixelium
description: >-
  Pixelium consent-commerce monorepo map and commands. Use when editing,
  debugging, or extending pixelium-consent-commerce — avoids broad codebase search.
---

# Pixelium Consent Commerce

## Layout (read these files first)

| Path | Purpose |
|------|---------|
| `packages/shared/src/types.ts` | Mandate types |
| `packages/shared/src/signing.ts` | HMAC sign/verify |
| `packages/shared/src/validation.ts` | Chain validation |
| `packages/shared/src/catalog.ts` | Mock products |
| `packages/consent-broker/src/broker.ts` | Orchestration core |
| `packages/consent-broker/src/delegated-monitor.ts` | Watch jobs |
| `packages/consent-broker/src/groq-intent.ts` | Groq NL intent parsing |
| `packages/consent-broker/src/server.ts` | REST API :4000 |
| `packages/ecommerce-agent/src/server.ts` | A2A :4001 |
| `packages/payment-agent/src/server.ts` | A2A :4002 |
| `packages/audit/src/store.ts` | JSON audit log |
| `packages/dashboard/src/public/` | UI (HTML/CSS/JS) |
| `docs/` | FINAL_REPORT, SECURITY, USABILITY, DEMO_SCRIPT |

## Commands

```bash
npm install && npm run build && npm run complete   # finish all 8 weeks
npm run dev
npm run demo:realtime
npm run demo:delegated
npm run demo:ai
npm run test:adversarial
powershell scripts/verify.ps1
```

## Ports

4000 broker · 4001 ecommerce · 4002 payment · 3000 dashboard

## Rules

- Do **not** re-read entire repo — use table above
- Do **not** add SQLite/native deps (Windows build issues)
- Mandate changes → `shared` then rebuild: `npm run build -w @pixelium/shared`
- New API → `consent-broker/src/server.ts` + dashboard `app.js` if UI needed
- Docs live in `docs/` only when deliverable-related

## Flow

Intent (user) → Cart (merchant) → Payment (user) → broker validates → payment agent
