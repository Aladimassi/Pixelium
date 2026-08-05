# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/broker/package.json apps/broker/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/shared/package.json packages/shared/
COPY packages/audit/package.json packages/audit/
COPY packages/auth/package.json packages/auth/
COPY packages/catalog/package.json packages/catalog/

RUN npm ci

COPY packages ./packages
COPY apps ./apps

RUN find . -name '*.tsbuildinfo' -delete && npm run build

# ── Broker ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS broker

WORKDIR /app

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV BROKER_PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --retries=8 --start-period=60s \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/broker/dist/server.js"]

# ── Dashboard ─────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS dashboard

WORKDIR /app

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV DASHBOARD_PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "-w", "@pixelium/dashboard"]
