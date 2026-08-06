import './load-env.js';
import express from 'express';
import cors from 'cors';
import {
  auditStore,
  applyShippingToCart,
  buildCart,
  createIntentMandate,
  createPaymentMandate,
  preparePaymentChain,
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
import { isGroqConfigured, parseShoppingIntent, ConversationalMessageError, isConversationalMessage, getConversationalReply, isAdvisoryMessage, isPurchaseIntentMessage } from './groq-intent.js';
import { prepareAiPurchase } from './ai-prepare.js';
import { isVoiceTranscribeConfigured, transcribeAudioBuffer, getVoiceTranscribeModel, warmWhisperModel, usesGroqWhisper } from './voice-transcribe.js';
import { parseMultipartAudio } from './multipart-audio.js';
import { adviseShopping, refreshRagIndex, isIndexReady, getEmbeddingModelName, getVectorIndexSize } from './rag/index.js';
import { guardInput, guardParsedSku, listGuardrailPolicies, type GuardrailResult } from './guardrails/index.js';
import type { IntentMandatePayload, MandateChain } from '@pixelium/shared';
import { FEATURED_SKUS, type Product } from '@pixelium/shared';
import {
  initAuth,
  loginUser,
  registerUser,
  getUserStore,
  isAuthReady,
  createAuthMiddleware,
  optionalAuth,
  updateUserProfile,
  changeUserPassword,
  requestPasswordReset,
  resetPasswordWithToken,
  type AuthRequest,
} from '@pixelium/auth';
import { initCatalog, getProductStore } from '@pixelium/catalog';
import { isMailConfigured, publicAppUrl, sendPasswordResetEmail, trySendPurchaseReceiptEmail } from './mail.js';

const PORT = Number(process.env.BROKER_PORT ?? 4000);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

startDelegatedMonitor(5000);

function expandSearchToken(token: string): string[] {
  const t = token.toLowerCase();
  const forms = new Set<string>([t]);
  const synonyms: Record<string, string[]> = {
    shoes: ['shoe', 'sneaker', 'sneakers', 'footwear', 'trainer', 'trainers', 'boot', 'boots'],
    shoe: ['shoe', 'sneaker', 'sneakers', 'footwear', 'trainer', 'boot'],
    sneakers: ['sneaker', 'shoe', 'shoes', 'footwear'],
    sneaker: ['sneaker', 'shoe', 'shoes', 'footwear'],
    trainers: ['trainer', 'shoe', 'sneakers', 'footwear'],
    boots: ['boot', 'shoe', 'footwear'],
    book: ['book', 'books'],
    books: ['book', 'books'],
    dice: ['dice', 'die'],
    game: ['game', 'games'],
    games: ['game', 'games'],
    toy: ['toy', 'toys', 'plush'],
    toys: ['toy', 'toys', 'plush'],
    phone: ['phone', 'smartphone', 'mobile'],
    headphones: ['headphone', 'headphones', 'earbud', 'earbuds'],
  };
  for (const s of synonyms[t] ?? []) forms.add(s);
  if (t.length > 3 && t.endsWith('s')) forms.add(t.slice(0, -1));
  if (t.length > 4 && t.endsWith('es')) forms.add(t.slice(0, -2));
  return [...forms];
}

function haystackForProduct(p: Product): string {
  return `${p.name} ${p.category} ${p.description} ${p.sku}`.toLowerCase();
}

function productMatchesQuery(p: Product, tokens: string[]): boolean {
  const hay = haystackForProduct(p);
  return tokens.every((token) => expandSearchToken(token).some((form) => hay.includes(form)));
}

function filterProducts(
  products: Product[],
  q?: string,
  category?: string,
  minPrice?: number,
  maxPrice?: number,
  inStockOnly?: boolean
): Product[] {
  let list = products;
  if (category && category !== 'all') {
    list = list.filter((p) => p.category === category);
  }
  if (typeof minPrice === 'number' && !Number.isNaN(minPrice)) {
    list = list.filter((p) => p.priceCents >= minPrice);
  }
  if (typeof maxPrice === 'number' && !Number.isNaN(maxPrice)) {
    list = list.filter((p) => p.priceCents <= maxPrice);
  }
  if (inStockOnly) {
    list = list.filter((p) => p.inStock > 0);
  }
  if (q?.trim()) {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter((p) => productMatchesQuery(p, tokens));
  }
  return list;
}

type CatalogSort = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popular';

function sortProducts(products: Product[], sort: CatalogSort): Product[] {
  const list = [...products];
  switch (sort) {
    case 'price-asc':
      return list.sort((a, b) => a.priceCents - b.priceCents);
    case 'price-desc':
      return list.sort((a, b) => b.priceCents - a.priceCents);
    case 'name-desc':
      return list.sort((a, b) => b.name.localeCompare(a.name));
    case 'popular':
      return list.sort((a, b) => b.inStock - a.inStock || a.name.localeCompare(b.name));
    default:
      return list.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function parseCatalogSort(raw: unknown): CatalogSort {
  const allowed: CatalogSort[] = ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popular'];
  return typeof raw === 'string' && allowed.includes(raw as CatalogSort) ? (raw as CatalogSort) : 'name-asc';
}

app.get('/', (_req, res) => {
  res.json({
    service: 'consent-broker',
    status: 'ok',
    message: 'API only — open the store at http://localhost:3000',
    store: 'http://localhost:3000',
    endpoints: {
      health: '/health',
      catalog: '/api/catalog',
      login: 'POST /api/auth/login',
      checkout: 'POST /api/checkout/prepare',
      aiStatus: '/api/ai/status',
      aiAdvise: 'POST /api/ai/advise',
      aiChat: 'POST /api/ai/chat',
    },
    agents: {
      product: 'http://localhost:4001',
      payment: 'http://localhost:4002',
    },
  });
});

app.get('/health', async (_req, res) => {
  let catalogCount = 0;
  let catalogSource = 'mock';
  try {
    const store = getProductStore();
    catalogCount = await store.count();
    catalogSource = store.kind;
  } catch {
    /* catalog not initialized */
  }
  res.json({
    status: 'ok',
    service: 'consent-broker',
    auth: isAuthReady(),
    groq: isGroqConfigured(),
    rag: {
      indexed: isIndexReady(),
      vectorNodes: getVectorIndexSize(),
      embeddingModel: getEmbeddingModelName(),
      catalogProducts: catalogCount,
    },
    catalog: { count: catalogCount, source: catalogSource },
  });
});

app.get('/api/guardrails/policies', (_req, res) => {
  res.json(listGuardrailPolicies());
});

app.get('/api/ai/status', (_req, res) => {
  res.json({
    configured: isGroqConfigured(),
    voiceTranscribe: isVoiceTranscribeConfigured(),
    voiceModel: getVoiceTranscribeModel(),
    voiceProvider: usesGroqWhisper() ? 'groq' : 'local',
    model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  });
});

function formatCheckoutChatReply(cartMandate: { payload: { items: Array<{ name: string; quantity: number }>; totalCents: number } }): string {
  const items = cartMandate.payload.items
    .map((i) => `${i.quantity}× ${i.name}`)
    .join(', ');
  const total = (cartMandate.payload.totalCents / 100).toFixed(2);
  return `Here's your order: ${items} — $${total} total incl. tax. Review below and approve payment when you're ready.`;
}

function authUnavailable(res: express.Response) {
  res.status(503).json({
    error: 'Auth unavailable — MySQL is not connected. Check broker logs and MYSQL_* in .env.',
  });
}

app.get('/api/auth/status', async (_req, res) => {
  if (!isAuthReady()) {
    return res.json({ ready: false, userCount: 0 });
  }
  try {
    const count = await getUserStore().countUsers();
    res.json({ ready: true, userCount: count });
  } catch (err) {
    res.status(503).json({
      ready: false,
      error: err instanceof Error ? err.message : 'Auth check failed',
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!isAuthReady()) return authUnavailable(res);
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await loginUser(String(email), String(password));
    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    if (message.includes('Auth not initialized')) return authUnavailable(res);
    res.status(500).json({ error: message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    if (!isAuthReady()) return authUnavailable(res);
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const result = await registerUser(String(email), String(password), String(displayName));
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Registration failed' });
  }
});

const PASSWORD_RESET_SENT =
  'If an account exists for that email, we sent password reset instructions. Check your inbox.';

async function attachPurchaseReceiptEmail(
  result: Awaited<ReturnType<typeof submitPayment>>,
  user: { email: string; displayName?: string },
  receipt?: {
    shippingSummary?: string;
    shippingCents?: number;
    deliveryLabel?: string;
    sendEmail?: boolean;
  },
): Promise<{ emailSent: boolean; emailError?: string }> {
  if (!result.success || !result.chain || receipt?.sendEmail === false) {
    return { emailSent: false };
  }
  const transactionId =
    result.payment?.transactionId ?? result.chain.payment.payload.paymentId ?? '';
  const { sent, error } = await trySendPurchaseReceiptEmail(
    user.email,
    user.displayName,
    result.chain,
    transactionId,
    receipt,
  );
  return { emailSent: sent, emailError: error };
}

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    if (!isAuthReady()) return authUnavailable(res);
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ error: 'Email required' });
    }
    const normalized = String(email).trim().toLowerCase();
    const token = await requestPasswordReset(normalized);
    let emailSent = false;
    let emailError: string | undefined;
    if (token) {
      const resetUrl = `${publicAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      if (isMailConfigured()) {
        try {
          await sendPasswordResetEmail(normalized, resetUrl);
          emailSent = true;
        } catch (err) {
          emailError = err instanceof Error ? err.message : 'Could not send email';
          console.error('[password-reset]', emailError);
        }
      } else {
        emailError = 'Email delivery is not configured on the server.';
        if (process.env.NODE_ENV !== 'production') {
          console.info('[password-reset] SMTP not configured. Reset link:', resetUrl);
        }
      }
    }
    res.json({ message: PASSWORD_RESET_SENT, emailSent, emailError });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    if (message.includes('Auth not initialized')) return authUnavailable(res);
    res.status(400).json({ error: message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    if (!isAuthReady()) return authUnavailable(res);
    const { token, password } = req.body;
    if (!token?.trim() || !password) {
      return res.status(400).json({ error: 'Reset token and new password required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    await resetPasswordWithToken(String(token).trim(), String(password));
    res.json({ message: 'Password updated. You can sign in now.' });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Reset failed' });
  }
});

app.get('/api/catalog/categories', async (_req, res) => {
  try {
    const store = getProductStore();
    const products = await store.listAll();
    const counts = new Map<string, number>();
    for (const p of products) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    const categories = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ categories, total: products.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Catalog unavailable' });
  }
});

app.get('/api/catalog/featured', async (_req, res) => {
  try {
    const store = getProductStore();
    const all = await store.listAll();
    const bySku = new Map(all.map((p) => [p.sku, p]));
    const picked = FEATURED_SKUS.map((sku) => bySku.get(sku)).filter(Boolean) as Product[];
    const fallback = all.filter((p) => p.inStock > 0).slice(0, 8);
    const products = (picked.length >= 4 ? picked : fallback).slice(0, 8);
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Catalog unavailable' });
  }
});

app.get('/api/catalog', async (req, res) => {
  try {
    const store = getProductStore();
    const all = await store.listAll();
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const sort = parseCatalogSort(req.query.sort);
    const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : undefined;
    const inStockOnly = req.query.inStock === '1' || req.query.inStock === 'true';
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 24)));
    const filtered = sortProducts(
      filterProducts(all, q, category, minPrice, maxPrice, inStockOnly),
      sort
    );
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const products = filtered.slice(offset, offset + limit);
    res.json({ products, total, page, pages: Math.ceil(total / limit) || 1, sort });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Catalog unavailable' });
  }
});

app.get('/api/catalog/:sku', async (req, res) => {
  try {
    const store = getProductStore();
    const product = await store.getBySku(req.params.sku);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Catalog unavailable' });
  }
});

// ── Protected routes (registered after auth init) ──────────────────────────

function logGuardrailBlock(result: GuardrailResult, context: Record<string, unknown> = {}) {
  auditStore.logEvent(
    'broker_blocked',
    { guardrail: true, tier: result.tier, rule: result.rule, message: result.message, ...context },
    { severity: 'warning' }
  );
}

function rejectGuardrail(res: express.Response, result: GuardrailResult) {
  logGuardrailBlock(result);
  return res.status(403).json({
    guardrail: true,
    blocked: true,
    tier: result.tier,
    rule: result.rule,
    error: result.message,
  });
}

function createRequireAuth(userStore: ReturnType<typeof getUserStore> | null) {
  if (!userStore) {
    return (_req: express.Request, res: express.Response) => {
      res.status(503).json({
        error: 'Auth unavailable — start MySQL (XAMPP) and restart the broker.',
      });
    };
  }
  return createAuthMiddleware(userStore);
}

const DEMO_ADMIN_EMAIL = 'demo@pixelium.com';

function isAdminUser(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (normalized === DEMO_ADMIN_EMAIL) return true;
  const extra = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(normalized);
}

function requireAdmin(req: AuthRequest, res: express.Response): boolean {
  if (!isAdminUser(req.user!.email)) {
    res.status(403).json({ error: 'Admin access only' });
    return false;
  }
  return true;
}

function registerProtectedRoutes(requireAuth: ReturnType<typeof createRequireAuth>) {
  app.get('/api/auth/me', requireAuth, (req, res) => {
    const { user } = req as AuthRequest;
    res.json({ user });
  });

  app.patch('/api/auth/profile', requireAuth, async (req, res) => {
    try {
      const { user } = req as AuthRequest;
      const { displayName } = req.body;
      if (!displayName?.trim()) {
        return res.status(400).json({ error: 'Display name required' });
      }
      const result = await updateUserProfile(user!.id, { displayName: String(displayName).trim() });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Update failed' });
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    try {
      const { user } = req as AuthRequest;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password required' });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }
      await changeUserPassword(user!.id, String(currentPassword), String(newPassword));
      res.json({ message: 'Password updated' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Password change failed' });
    }
  });

  app.post('/api/ai/parse', requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      const text = String(message ?? '').trim();
      const inputGuard = guardInput(text);
      if (!inputGuard.allowed) return rejectGuardrail(res, inputGuard);
      if (isConversationalMessage(text)) {
        return res.json({ conversational: true, reply: getConversationalReply(text) });
      }
      const parsed = await parseShoppingIntent(text);
      const product = (await import('@pixelium/shared')).getProduct(parsed.sku);
      const skuGuard = guardParsedSku(parsed.sku, Boolean(product));
      if (!skuGuard.allowed) return rejectGuardrail(res, skuGuard);
      res.json({ parsed, product, guardrailsPassed: true });
    } catch (err) {
      if (err instanceof ConversationalMessageError) {
        return res.json({ conversational: true, reply: err.reply });
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Parse failed' });
    }
  });

  app.post('/api/ai/advise', requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      const text = String(message ?? '').trim();
      const inputGuard = guardInput(text);
      if (!inputGuard.allowed) return rejectGuardrail(res, inputGuard);
      if (isConversationalMessage(text) && !isAdvisoryMessage(text)) {
        return res.json({ conversational: true, reply: getConversationalReply(text) });
      }
      const advice = await adviseShopping(text);
      res.json({ rag: true, ...advice });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Advise failed' });
    }
  });

  app.post('/api/ai/chat', requireAuth, async (req, res) => {
    try {
      const { user } = req as AuthRequest;
      const { message, history } = req.body;
      const text = String(message ?? '').trim();
      if (!text) return res.status(400).json({ error: 'Message is required' });
      const inputGuard = guardInput(text);
      if (!inputGuard.allowed) return rejectGuardrail(res, inputGuard);

      const prior: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (Array.isArray(history)) {
        for (const turn of history.slice(-10)) {
          if (!turn || typeof turn !== 'object') continue;
          const role = turn.role === 'assistant' ? 'assistant' : turn.role === 'user' ? 'user' : null;
          const content = String(turn.content ?? '').trim();
          if (role && content) prior.push({ role, content });
        }
      }

      if (isPurchaseIntentMessage(text)) {
        try {
          const prepared = await prepareAiPurchase(text, user!.id, prior);
          return res.json({
            rag: true,
            chat: true,
            action: 'prepare_checkout',
            reply: formatCheckoutChatReply(prepared.cartMandate),
            picks: [],
            retrievedCount: 0,
            usedGroq: prepared.parsed.usedGroq,
            conversational: true,
            parsed: prepared.parsed,
            intentMandate: prepared.intentMandate,
            cartMandate: prepared.cartMandate,
            guardrailsPassed: true,
          });
        } catch (err) {
          if (!(err instanceof ConversationalMessageError)) {
            const msg = err instanceof Error ? err.message : 'Could not prepare checkout';
            const { suggestProducts, resolveProductImageUrl } = await import('@pixelium/shared');
            const suggestions = suggestProducts(text, 3);
            const picks = suggestions.map((p) => ({
              sku: p.sku,
              name: p.name,
              priceCents: p.priceCents,
              category: p.category,
              reason: 'Similar product you might want',
              imageUrl: resolveProductImageUrl(p),
            }));
            const reply =
              picks.length > 0 && msg.includes('Did you mean')
                ? msg
                : picks.length > 0
                  ? `${msg} Here are some close matches:`
                  : msg.startsWith("I couldn't find")
                    ? msg
                    : `I couldn't start checkout: ${msg}. Try being more specific about the product.`;
            return res.json({
              rag: true,
              chat: true,
              reply,
              picks,
              retrievedCount: picks.length,
              usedGroq: false,
              conversational: true,
            });
          }
        }
      }

      const { shoppingAssistantChat } = await import('./shopping-chat.js');
      const result = await shoppingAssistantChat(text, prior);
      res.json({ rag: true, chat: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Chat failed' });
    }
  });

  app.post('/api/ai/search', requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      const text = String(message ?? '').trim();
      const inputGuard = guardInput(text);
      if (!inputGuard.allowed) return rejectGuardrail(res, inputGuard);
      if (isConversationalMessage(text)) {
        return res.json({ conversational: true, reply: getConversationalReply(text), products: [], total: 0 });
      }
      const { searchProducts } = await import('@pixelium/shared');
      const products = searchProducts(text).slice(0, 12);
      res.json({ products, total: products.length, guardrailsPassed: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Search failed' });
    }
  });

  app.post('/api/ai/transcribe', requireAuth, express.raw({ type: 'multipart/form-data', limit: '10mb' }), async (req, res) => {
    try {
      if (!isVoiceTranscribeConfigured()) {
        return res.status(503).json({ error: 'Voice transcription is not available.' });
      }

      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        return res.status(400).json({ error: 'Missing audio recording' });
      }

      const { buffer, mimeType, language } = parseMultipartAudio(body, String(req.headers['content-type'] ?? ''));
      const text = await transcribeAudioBuffer(buffer, mimeType, language);
      const inputGuard = guardInput(text);
      if (!inputGuard.allowed) return rejectGuardrail(res, inputGuard);
      res.json({ text, guardrailsPassed: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Transcription failed' });
    }
  });

  app.post('/api/ai/prepare', requireAuth, async (req, res) => {
    try {
      const { user } = req as AuthRequest;
      const { message } = req.body;
      const text = String(message ?? '').trim();
      const inputGuard = guardInput(text);
      if (!inputGuard.allowed) return rejectGuardrail(res, inputGuard);
      if (isConversationalMessage(text)) {
        return res.json({ conversational: true, reply: getConversationalReply(text) });
      }
      const prepared = await prepareAiPurchase(text, user!.id);
      res.json({
        parsed: prepared.parsed,
        intentMandate: prepared.intentMandate,
        cartMandate: prepared.cartMandate,
        guardrailsPassed: true,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Prepare failed' });
    }
  });

  app.post('/api/ai/purchase', requireAuth, async (req, res) => {
    try {
      const { user } = req as AuthRequest;
      const { message } = req.body;
      const text = String(message ?? '').trim();
      const inputGuard = guardInput(text);
      if (!inputGuard.allowed) return rejectGuardrail(res, inputGuard);
      const parsed = await parseShoppingIntent(message ?? '');
      const items = [{ sku: parsed.sku, quantity: parsed.quantity }];
      const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const result =
        parsed.flowMode === 'delegated'
          ? await runDelegatedPurchase(
              items,
              { maxPriceCents: parsed.maxPriceCents, allowedSkus: [parsed.sku], validUntil },
              parsed.naturalLanguageIntent,
              user!.id
            )
          : await runRealtimePurchase(
              items,
              parsed.maxPriceCents,
              parsed.naturalLanguageIntent,
              user!.id
            );

      res.status(result.success ? 200 : 403).json({ parsed, result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'AI purchase failed' });
    }
  });

  app.post('/api/intent', requireAuth, (req, res) => {
    const { user } = req as AuthRequest;
    const { flowMode, intentText, conditions } = req.body;
    const mandate = createIntentMandate(flowMode, intentText, conditions, user!.id);
    res.json({ intentMandate: mandate });
  });

  app.post('/api/cart', requireAuth, async (req, res) => {
    const { intentMandate, items } = req.body;
    const result = await buildCart(intentMandate, items);
    res.json(result);
  });

  app.post('/api/payment-mandate', requireAuth, (req, res) => {
    const { intentMandate, cartMandate, last4, shippingCents = 0 } = req.body;
    const chain = preparePaymentChain(intentMandate, cartMandate, Number(shippingCents) || 0, last4);
    res.json({ paymentMandate: chain.payment, cartMandate: chain.cart, intentMandate: chain.intent });
  });

  app.post('/api/submit', requireAuth, async (req, res) => {
    const { user } = req as AuthRequest;
    const chain = req.body.mandateChain as MandateChain;
    const receipt = req.body.receipt as
      | { shippingSummary?: string; shippingCents?: number; deliveryLabel?: string }
      | undefined;
    if (chain.intent.payload.userId !== user!.id) {
      return res.status(403).json({ error: 'Mandate does not belong to this account' });
    }
    const result = await submitPayment(chain);
    const { emailSent, emailError } = await attachPurchaseReceiptEmail(result, user!, receipt);
    res.status(result.success ? 200 : 403).json({ ...result, emailSent, emailError });
  });

  app.post('/api/validate', requireAuth, (req, res) => {
    const chain = req.body.mandateChain as MandateChain;
    res.json(validateMandateChain(chain));
  });

  app.post('/api/checkout/prepare', requireAuth, async (req, res) => {
    const { user } = req as AuthRequest;
    const { items, intentText, shippingCents = 0 } = req.body as {
      items: Array<{ sku: string; quantity: number }>;
      intentText?: string;
      shippingCents?: number;
    };
    if (!items?.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const store = getProductStore();
    const { computeTax } = await import('@pixelium/shared');
    let subtotalCents = 0;
    for (const item of items) {
      const product = await store.getBySku(item.sku);
      if (!product) return res.status(400).json({ error: `Unknown SKU: ${item.sku}` });
      if (product.inStock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }
      subtotalCents += product.priceCents * item.quantity;
    }
    const ship = Math.max(0, Math.round(Number(shippingCents) || 0));
    const maxPriceCents = subtotalCents + computeTax(subtotalCents) + ship;
    const validUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const text =
      intentText ??
      `Purchase ${items.length} item(s) — approved by ${user!.displayName ?? user!.email}`;

    const intent = createIntentMandate('realtime', text, { maxPriceCents, validUntil }, user!.id);
    const cartResult = await buildCart(intent, items);
    if ('error' in cartResult) {
      return res.status(400).json({ error: cartResult.error });
    }
    const cartMandate = ship > 0 ? applyShippingToCart(cartResult.cartMandate, ship) : cartResult.cartMandate;
    res.json({
      intentMandate: intent,
      cartMandate,
      agentThinking: cartResult.agentThinking,
      agentWarnings: cartResult.agentWarnings,
    });
  });

  app.post('/api/checkout', requireAuth, async (req, res) => {
    const { user } = req as AuthRequest;
    const { items, intentText } = req.body as {
      items: Array<{ sku: string; quantity: number }>;
      intentText?: string;
    };
    if (!items?.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const store = getProductStore();
    let totalCents = 0;
    for (const item of items) {
      const product = await store.getBySku(item.sku);
      if (!product) return res.status(400).json({ error: `Unknown SKU: ${item.sku}` });
      if (product.inStock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }
      totalCents += product.priceCents * item.quantity;
    }
    const maxPriceCents = Math.round(totalCents * 1.1);
    const validUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const text =
      intentText ??
      `Purchase ${items.length} item(s) — approved by ${user!.displayName ?? user!.email}`;

    const intent = createIntentMandate('realtime', text, { maxPriceCents, validUntil }, user!.id);
    const cartResult = await buildCart(intent, items);
    if ('error' in cartResult) {
      return res.status(400).json({ error: cartResult.error });
    }
    const payment = createPaymentMandate(intent, cartResult.cartMandate);
    const result = await submitPayment({
      intent,
      cart: cartResult.cartMandate,
      payment,
    });
    const { emailSent, emailError } = await attachPurchaseReceiptEmail(result, user!);
    res.status(result.success ? 200 : 403).json({ ...result, emailSent, emailError });
  });

  app.post('/api/demo/realtime', requireAuth, async (req, res) => {
    const authReq = req as AuthRequest;
    if (!requireAdmin(authReq, res)) return;
    const { user } = authReq;
    const { items, maxPriceCents, intentText } = req.body;
    const result = await runRealtimePurchase(items, maxPriceCents, intentText, user!.id);
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/demo/delegated', requireAuth, async (req, res) => {
    const authReq = req as AuthRequest;
    if (!requireAdmin(authReq, res)) return;
    const { user } = authReq;
    const { items, conditions, intentText } = req.body;
    const result = await runDelegatedPurchase(items, conditions, intentText, user!.id);
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/delegated/watch', requireAuth, (req, res) => {
    const { items, conditions, intentText } = req.body;
    const job = registerDelegatedWatch(items, conditions, intentText);
    res.json({ job });
  });

  app.get('/api/delegated/jobs', requireAuth, (_req, res) => {
    res.json({ jobs: listWatchJobs() });
  });

  app.post('/api/delegated/execute/:jobId', requireAuth, async (req, res) => {
    const result = await executeWatchJob(String(req.params.jobId));
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/delegated/tick', requireAuth, async (_req, res) => {
    const executed = await tickDelegatedMonitor();
    res.json({ executed, jobs: listWatchJobs() });
  });

  app.get('/api/audit/orders', requireAuth, (req, res) => {
    const { user } = req as AuthRequest;
    res.json({ orders: auditStore.listOrders(user!.id) });
  });

  app.get('/api/audit/orders/:orderId', requireAuth, (req, res) => {
    const { user } = req as AuthRequest;
    const orderId = String(req.params.orderId);
    const order = auditStore.getOrderForUser(orderId, user!.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const chain = auditStore.getOrderChain(orderId);
    res.json({ order, mandateChain: chain ?? null });
  });

  app.get('/api/audit/events', requireAuth, (req, res) => {
    const { user } = req as AuthRequest;
    if (!requireAdmin(req as AuthRequest, res)) return;
    const limit = Number(req.query.limit ?? 100);
    res.json({ events: auditStore.listEvents(limit) });
  });

  app.get('/api/audit/mismatches', requireAuth, (req, res) => {
    const { user } = req as AuthRequest;
    res.json({ mismatches: auditStore.getMismatches(user!.id) });
  });
}

async function start() {
  console.log('🔐 Starting Consent Broker…');

  try {
    await initCatalog();
    const stats = await refreshRagIndex();
    console.log(`   RAG vector index: ${stats.chunks} chunks (${stats.embeddingModel})`);
  } catch (err) {
    console.error('⚠️  Catalog init failed:', err instanceof Error ? err.message : err);
  }

  let userStore: ReturnType<typeof getUserStore> | null = null;
  try {
    await initAuth();
    userStore = getUserStore();
    app.use(optionalAuth(userStore));
  } catch (err) {
    console.error('⚠️  Auth init failed:', err instanceof Error ? err.message : err);
    console.error('   Login and checkout require MySQL. Start XAMPP MySQL and restart.');
  }

  registerProtectedRoutes(createRequireAuth(userStore));

  void warmWhisperModel()
    .then((model) => {
      if (!usesGroqWhisper()) {
        console.log(`   Voice model ready: ${model}`);
      }
    })
    .catch((err) => {
      console.warn('⚠️  Voice model warmup failed:', err instanceof Error ? err.message : err);
    });

  app.listen(PORT, () => {
    console.log(`🔐 Consent Broker on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

export { app };
