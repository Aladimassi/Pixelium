# Pixelium Consent Commerce

**Pixelium Internship Program 2026** — Prototype de commerce agentique avec consentement utilisateur.

Boutique en ligne où des agents IA (LangGraph) recherchent des produits et préparent des achats **uniquement après validation explicite** de l'utilisateur. Un **consent broker** central applique une chaîne de mandats signés inspirée d'AP2 : **Intent → Cart → Payment**. Assistant shopping conversationnel (RAG + Groq), panier et paiement isolés par utilisateur, déploiement Docker sur Azure.

| | |
|---|---|
| **Démo en ligne** | https://pixelium.duckdns.org |
| **Compte démo** | `demo@pixelium.com` / `demo123` |
| **Dépôt GitHub** | https://github.com/Aladimassi/Pixeliumstg |

## Pour l'encadrant

Document d'architecture complet (contexte, schémas, flux mandats, RAG, sécurité, déploiement) :

| Format | Lien |
|--------|------|
| **PDF (recommandé)** | [docs/ARCHITECTURE_ENCADRANT.pdf](./docs/ARCHITECTURE_ENCADRANT.pdf) |
| **HTML** | [docs/ARCHITECTURE_ENCADRANT.html](./docs/ARCHITECTURE_ENCADRANT.html) |

Sur GitHub : [Architecture encadrant (PDF)](https://github.com/Aladimassi/Pixeliumstg/blob/main/docs/ARCHITECTURE_ENCADRANT.pdf) · [Architecture encadrant (HTML)](https://github.com/Aladimassi/Pixeliumstg/blob/main/docs/ARCHITECTURE_ENCADRANT.html)

Autres livrables : [rapport final](./docs/FINAL_REPORT.md) · [format des mandats](./docs/MANDATE_FORMAT.md) · [sécurité](./docs/SECURITY_FINDINGS.md) · [script de démo](./docs/DEMO_SCRIPT.md)

## Fonctionnalités principales

- **Chat shopping multi-tours** — l'utilisateur discute avec l'assistant IA ; recommandations vs achat automatique sont distinguées (« que me recommandes-tu ? » vs « achète-moi les chaussures »).
- **Chaîne de consentement** — chaque étape (intention, panier, paiement) passe par des mandats signés HMAC validés par le broker avant tout débit.
- **Agents A2A** — agent produit (LangGraph, port 4001) et agent paiement (port 4002) orchestrés par le broker (port 4000), jamais en contact direct avec le client.
- **RAG catalogue** — embeddings, vector store, reranking et expansion de requêtes (ex. running → chaussures).
- **Guardrails** — politiques entrée/sortie sur les requêtes IA et les actions broker.
- **Auth JWT + MySQL** — comptes utilisateurs, commandes filtrées par utilisateur, panier et carte bancaire en localStorage par session.
- **Déploiement production** — Docker Compose (nginx HTTPS, broker Node, dashboard React, agents Python, MySQL).

## Stack technique

| Couche | Technologies |
|--------|----------------|
| Frontend | React, Vite, TypeScript |
| API / orchestration | Node.js, Express, TypeScript |
| Agents | Python, LangGraph, FastAPI |
| IA | Groq (LLM + intent), embeddings locaux, RAG |
| Données | MySQL (auth, catalogue, audit) |
| Infra | Docker, nginx, Azure VM |

Deux agents A2A (e-commerce + paiement) communiquent via un **consent broker** qui journalise et valide chaque mandat avant simulation de charge.

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
                             │  Pixelium Store  │
                             │  (React + AI)    │
                             │  :3000           │
                             └──────────────────┘
```

## Monorepo layout

```
pixelium-consent-commerce/
├── apps/
│   ├── dashboard/          # React store UI (:3000)
│   └── broker/             # Consent broker API (:4000)
├── packages/
│   ├── shared/             # Mandates, signing, types
│   ├── audit/              # Order audit log
│   ├── auth/               # MySQL users + JWT
│   └── catalog/            # MySQL product store
├── services/
│   └── agents/             # Python LangGraph agents (:4001, :4002)
├── scripts/                # verify.ps1, complete.ps1
└── docs/                   # Reports, specs, demo scripts
```

| Folder | What runs here |
|--------|----------------|
| `apps/` | Deployable applications (Node.js) |
| `packages/` | Shared libraries consumed by apps |
| `services/` | Standalone Python services (pip, not npm) |

## Fastest way to finish (all 8 weeks)

```powershell
npm run complete
```

Installs, builds, starts services, runs all demos + security tests, prints week status.  
Details: [docs/WEEKS.md](./docs/WEEKS.md) · Submit: [docs/SUBMISSION_CHECKLIST.md](./docs/SUBMISSION_CHECKLIST.md)

## Quick Start

```bash
npm install
pip install -r services/agents/requirements.txt
npm run build
npm run dev
```

Open http://localhost:3000 — sign in, browse the catalog, use the **AI assistant**, or checkout from the cart.

## Deploy (production)

Docker Compose deployment (VPS or local):

```bash
cp .env.production.example .env   # edit passwords + GROQ_API_KEY
docker compose up -d --build
```

Open http://localhost — see [docs/DEPLOY.md](./docs/DEPLOY.md) for HTTPS, VPS, and troubleshooting.

```powershell
npm run deploy   # Windows helper script
```

## Commands

```bash
npm run demo:realtime      # Human-present flow
npm run demo:delegated     # Pre-authorized delegated flow
npm run demo:ai           # Groq natural-language purchase
npm run test:adversarial   # Security test pass
npm run test:agents        # Python agent unit tests (21)
npm run verify             # Build + demos + tests (agents must be running)
```

## Project layout

| Path | Port | Role |
|------|------|------|
| `apps/dashboard` | 3000 | React store UI (shop, cart, AI, profile) |
| `apps/broker` | 4000 | REST API + **orchestration** (only boss) |
| `packages/shared` | — | Mandates, HMAC signing, catalog search |
| `packages/auth` | — | MySQL users + JWT |
| `packages/catalog` | — | MySQL product store |
| `packages/audit` | — | Order audit log |
| `services/agents` product agent | 4001 | LangGraph: cart builder |
| `services/agents` payment agent | 4002 | LangGraph: payment proof + charge |

Node.js apps live in `apps/`. Shared TS libraries in `packages/`. Python LangGraph agents in `services/agents/` — the broker calls them over HTTP.

## Deliverables (complete)

| Deliverable | Location |
|-------------|----------|
| **Architecture encadrant (PDF)** | [docs/ARCHITECTURE_ENCADRANT.pdf](./docs/ARCHITECTURE_ENCADRANT.pdf) |
| **Architecture encadrant (HTML)** | [docs/ARCHITECTURE_ENCADRANT.html](./docs/ARCHITECTURE_ENCADRANT.html) |
| Working prototype | `apps/`, `packages/`, `services/` |
| Mandate spec | [docs/MANDATE_FORMAT.md](./docs/MANDATE_FORMAT.md) |
| Final report | [docs/FINAL_REPORT.md](./docs/FINAL_REPORT.md) |
| Security memo | [docs/SECURITY_FINDINGS.md](./docs/SECURITY_FINDINGS.md) |
| Usability study | [docs/USABILITY.md](./docs/USABILITY.md) |
| Demo script | [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) |
| Deploy guide | [docs/DEPLOY.md](./docs/DEPLOY.md) |

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
