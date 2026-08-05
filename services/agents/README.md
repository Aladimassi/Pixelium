# Pixelium Agents (Python / LangGraph)

Replaces the old TypeScript `@pixelium/ecommerce-agent` and `@pixelium/payment-agent` packages.

## Architecture

```
services/agents/
├── pixelium_agents/
│   ├── shared/            # HMAC mandates + catalog (MySQL or mock)
│   ├── product_agent/     # Port 4001 — search, filter, rank, cart builder
│   ├── payment_agent/     # Port 4002 — proof pipeline + autonomous charge
│   └── servers/           # FastAPI HTTP layer (broker calls POST /invoke)
│       ├── common.py      # Shared app factory, CORS, health/root helpers
│       ├── schemas.py     # Pydantic models (camelCase for Node broker)
│       ├── product_server.py
│       └── payment_server.py
├── tests/                 # pytest tests
├── run_product_agent.py   # Start product agent :4001
└── run_payment_agent.py   # Start payment agent :4002
```

## Install

From repo root:

```powershell
pip install -r services/agents/requirements.txt
# or
npm run agents:install
```

## Run (standalone)

From repo root:

```powershell
python services/agents/run_product_agent.py   # :4001
python services/agents/run_payment_agent.py   # :4002
```

Or: `npm run dev` (starts Python agents + broker + dashboard).

## Test

```powershell
npm run test:agents
# or
python -m pytest services/agents/tests/ -v
```

## HTTP API (broker calls POST /invoke)

**Product** `http://localhost:4001/invoke`
```json
{ "action": "build_cart", "intentMandate": {...}, "items": [{"sku": "HEADPHONES-NC", "quantity": 1}] }
```

**Payment** `http://localhost:4002/invoke`
```json
{ "action": "process_payment", "mandateChain": { "intent": {...}, "cart": {...}, "payment": {...} } }
```

Health: `GET /health` · Agent card: `GET /.well-known/agent-card.json`
