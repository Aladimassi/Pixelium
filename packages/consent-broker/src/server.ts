import './load-env.js';
import express from 'express';
import cors from 'cors';
import {
  auditStore,
  buildCart,
  createIntentMandate,
  createPaymentMandate,
  runDelegatedPurchase,
  runRealtimePurchase,
  submitPayment,
  validateMandateChain,
} from './broker.js';
import {
  executeWatchJob,
  listWatchJobs,
  registerDelegatedWatch,
  startDelegatedMonitor,
  tickDelegatedMonitor,
} from './delegated-monitor.js';
import { isGroqConfigured, parseShoppingIntent } from './groq-intent.js';
import type { IntentMandatePayload, MandateChain } from '@pixelium/shared';

const PORT = Number(process.env.BROKER_PORT ?? 4000);

const app = express();
app.use(cors());
app.use(express.json());

startDelegatedMonitor(5000);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'consent-broker', groq: isGroqConfigured() });
});

app.get('/api/ai/status', (_req, res) => {
  res.json({
    configured: isGroqConfigured(),
    model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  });
});

app.post('/api/ai/parse', async (req, res) => {
  try {
    const { message } = req.body;
    const parsed = await parseShoppingIntent(message ?? '');
    res.json({ parsed });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Parse failed' });
  }
});

app.post('/api/ai/purchase', async (req, res) => {
  try {
    const { message } = req.body;
    const parsed = await parseShoppingIntent(message ?? '');
    const items = [{ sku: parsed.sku, quantity: parsed.quantity }];
    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result =
      parsed.flowMode === 'delegated'
        ? await runDelegatedPurchase(
            items,
            {
              maxPriceCents: parsed.maxPriceCents,
              allowedSkus: [parsed.sku],
              validUntil,
            },
            parsed.naturalLanguageIntent
          )
        : await runRealtimePurchase(
            items,
            parsed.maxPriceCents,
            parsed.naturalLanguageIntent
          );

    res.status(result.success ? 200 : 403).json({ parsed, result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'AI purchase failed' });
  }
});

app.get('/api/catalog', async (_req, res) => {
  const { searchProducts } = await import('@pixelium/shared');
  res.json({ products: searchProducts('') });
});

app.post('/api/intent', (req, res) => {
  const { flowMode, intentText, conditions, userId } = req.body;
  const mandate = createIntentMandate(flowMode, intentText, conditions, userId);
  res.json({ intentMandate: mandate });
});

app.post('/api/cart', async (req, res) => {
  const { intentMandate, items } = req.body;
  const result = await buildCart(intentMandate, items);
  res.json(result);
});

app.post('/api/payment-mandate', (req, res) => {
  const { intentMandate, cartMandate, last4 } = req.body;
  const mandate = createPaymentMandate(intentMandate, cartMandate, last4);
  res.json({ paymentMandate: mandate });
});

app.post('/api/submit', async (req, res) => {
  const chain = req.body.mandateChain as MandateChain;
  const result = await submitPayment(chain);
  res.status(result.success ? 200 : 403).json(result);
});

app.post('/api/validate', (req, res) => {
  const chain = req.body.mandateChain as MandateChain;
  res.json(validateMandateChain(chain));
});

app.post('/api/demo/realtime', async (req, res) => {
  const { items, maxPriceCents, intentText } = req.body;
  const result = await runRealtimePurchase(items, maxPriceCents, intentText);
  res.status(result.success ? 200 : 403).json(result);
});

app.post('/api/demo/delegated', async (req, res) => {
  const { items, conditions, intentText } = req.body;
  const result = await runDelegatedPurchase(items, conditions, intentText);
  res.status(result.success ? 200 : 403).json(result);
});

app.post('/api/delegated/watch', (req, res) => {
  const { items, conditions, intentText } = req.body;
  const job = registerDelegatedWatch(items, conditions, intentText);
  res.json({ job });
});

app.get('/api/delegated/jobs', (_req, res) => {
  res.json({ jobs: listWatchJobs() });
});

app.post('/api/delegated/execute/:jobId', async (req, res) => {
  const result = await executeWatchJob(req.params.jobId);
  res.status(result.success ? 200 : 403).json(result);
});

app.post('/api/delegated/tick', async (_req, res) => {
  const executed = await tickDelegatedMonitor();
  res.json({ executed, jobs: listWatchJobs() });
});

app.get('/api/audit/orders', (_req, res) => {
  res.json({ orders: auditStore.listOrders() });
});

app.get('/api/audit/orders/:orderId', (req, res) => {
  const order = auditStore.getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const chain = auditStore.getOrderChain(req.params.orderId);
  res.json({ order, mandateChain: chain ?? null });
});

app.get('/api/audit/events', (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  res.json({ events: auditStore.listEvents(limit) });
});

app.get('/api/audit/mismatches', (_req, res) => {
  res.json({ mismatches: auditStore.getMismatches() });
});

app.listen(PORT, () => {
  console.log(`🔐 Consent Broker on http://localhost:${PORT}`);
});

export { app };
