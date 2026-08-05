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
| `apps/broker/src/broker.ts` | Orchestration core |
| `apps/broker/src/delegated-monitor.ts` | Watch jobs |
| `apps/broker/src/groq-intent.ts` | Groq NL intent parsing |
| `apps/broker/src/server.ts` | REST API :4000 |
| `services/agents/run_product_agent.py` | Product agent :4001 (LangGraph) |
| `services/agents/run_payment_agent.py` | Payment agent :4002 (LangGraph) |
| `services/agents/pixelium_agents/product_agent/` | Search, filter, rank, cart sub-agents |
| `services/agents/pixelium_agents/payment_agent/` | Proof + charge sub-agents |
| `packages/audit/src/store.ts` | JSON audit log |
| `apps/dashboard/src/client/` | React UI (components, hooks, lib) |
| `apps/dashboard/src/server/index.ts` | Express + Vite dev server :3000 |
| `docs/` | FINAL_REPORT, SECURITY, USABILITY, DEMO_SCRIPT |

## Commands

```bash
pip install -r services/agents/requirements.txt
npm install && npm run build && npm run complete   # finish all 8 weeks
npm run dev
npm run test:agents
npm run demo:realtime
npm run demo:delegated
npm run demo:ai
npm run test:adversarial
powershell scripts/verify.ps1
```

## Ports

4000 broker · 4001 product (Python) · 4002 payment (Python) · 3000 dashboard

## Rules

- Do **not** re-read entire repo — use table above
- Do **not** add SQLite/native deps (Windows build issues)
- Mandate changes → `shared` then rebuild: `npm run build -w @pixelium/shared`
- New API → `apps/broker/src/server.ts` + `apps/dashboard/src/client/` if UI needed
- Docs live in `docs/` only when deliverable-related

## Flow

Intent (user) → Cart (merchant) → Payment (user) → broker validates → payment agent
