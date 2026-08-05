import type { Product } from '@pixelium/shared';
import { extractBudgetCents } from './budget.js';
import { requestGroqJsonCompletion } from './groq-chat.js';
import { formatProductContext, retrieveProductsWithIntent } from './retriever.js';
import { filterSleepPicks, filterRunningPicks } from './rerank.js';
import { isGroqConfigured } from '../groq-intent.js';
import { guardAdviceOutput } from '../guardrails/index.js';
import { resolveProductImageUrl } from '@pixelium/shared';

export interface RagPick {
  sku: string;
  name: string;
  priceCents: number;
  category: string;
  reason: string;
  imageUrl?: string;
}

export interface RagAdviceResult {
  reply: string;
  picks: RagPick[];
  retrievedCount: number;
  usedGroq: boolean;
  guardrailsPassed?: boolean;
  guardrail?: { tier: string; rule: string; message: string };
  rag?: {
    embeddingModel: string;
    vectorNodes: number;
  };
}

function finalizeAdvice(message: string, result: RagAdviceResult, retrieved: Product[]): RagAdviceResult {
  const allowedSkus = new Set(retrieved.map((p) => p.sku));
  const check = guardAdviceOutput(message, result.reply, result.picks, allowedSkus);
  if (check.allowed) {
    return { ...result, guardrailsPassed: true };
  }
  return {
    ...result,
    guardrailsPassed: false,
    guardrail: { tier: check.tier, rule: check.rule, message: check.message },
    reply:
      check.rule === 'autonomous_payment_promise'
        ? 'I can suggest products, but only you can approve payment through checkout.'
        : result.reply,
    picks: result.picks.filter((p) => allowedSkus.has(p.sku)).slice(0, 3),
  };
}

const ADVISOR_SYSTEM = `You are a friendly personal shopping assistant for Pixelium Store.
You received RETRIEVED CONTEXT from a vector search over the product catalog.
You ONLY recommend products from that context — never invent SKUs or products.

Important rules:
- Match the user's real intent, not just shared words. Example: "sleeping car coach" train models are NOT sleep aids.
- If the user wants help sleeping, prefer plush toys, pillows, cushions, comfort items, relaxation gifts.
- If the user mentions running, jogging, or athletics, recommend footwear only — never jackets or outerwear.
- Match product category to the user's activity (running → shoes, not jackets).
- If nothing in context truly fits, say so honestly and suggest what the catalog does offer.
- Respect budget if stated.

Return JSON only:
{
  "summary": "2-4 sentences of helpful advice in plain language",
  "picks": [
    { "sku": "exact SKU from context", "reason": "one sentence why this fits the user" }
  ]
}
Include 1-3 picks max.`;

function sleepFallbackSummary(picks: Product[]): string {
  if (picks.length === 0) {
    return 'I could not find good sleep-related items in your catalog. Try searching for pillow, plush, or relaxation gifts.';
  }
  return `Your catalog does not include sleep medicine or white-noise devices, but these comfort items are the closest matches for relaxing at bedtime:`;
}

function fallbackAdvice(
  message: string,
  products: Product[],
  intent: 'sleep' | 'running' | 'general'
): RagAdviceResult {
  const { cents, explicit } = extractBudgetCents(message);
  let picks =
    intent === 'sleep'
      ? filterSleepPicks(products)
      : intent === 'running'
        ? filterRunningPicks(products)
        : products.slice(0, 12);
  if (explicit) {
    picks = picks.filter((p) => p.priceCents <= cents);
  }
  picks = picks.slice(0, 3);

  let summary: string;
  if (picks.length === 0) {
    summary = `I couldn't find in-stock items matching "${message}"${explicit ? ' within your budget' : ''}. Try broader keywords or a higher budget.`;
  } else if (intent === 'sleep') {
    summary = sleepFallbackSummary(picks);
  } else if (intent === 'running') {
    summary =
      picks.length > 0
        ? 'For running, these shoes from our catalog are your best options:'
        : 'I could not find running shoes in the catalog right now.';
  } else {
    summary = `Based on vector search over your catalog, here ${picks.length === 1 ? 'is' : 'are'} ${picks.length} option${picks.length === 1 ? '' : 's'} that may fit.`;
  }

  return {
    reply: summary,
    picks: picks.map((p) => ({
      sku: p.sku,
      name: p.name,
      priceCents: p.priceCents,
      category: p.category,
      reason: pickReason(p, intent),
      imageUrl: p.imageUrl ?? resolveProductImageUrl(p),
    })),
    retrievedCount: products.length,
    usedGroq: false,
  };
}

function pickReason(p: Product, intent: 'sleep' | 'running' | 'general'): string {
  const name = p.name.toLowerCase();
  if (intent === 'sleep') {
    if (/\bsleepy\b/.test(name)) return 'Soft sleepy-themed plush — good for bedtime comfort';
    if (/\bpillow\b/.test(name)) return 'Pillow-style plush for cozy sleep';
    if (/\bcushion\b/.test(name)) return 'Cushion plush for comfort and relaxation';
    if (/\b(bear|teddy)\b/.test(name)) return 'Comfort plush that can help you unwind at night';
    return 'Comfort item that may help you relax before sleep';
  }
  if (intent === 'running') {
    return 'Athletic footwear suited for running and training';
  }
  return `Semantic match — ${p.category}, $${(p.priceCents / 100).toFixed(2)}`;
}

function parseGroqAdvice(raw: string, retrieved: Product[], intent: 'sleep' | 'running' | 'general'): RagAdviceResult {
  const parsed = JSON.parse(raw) as {
    summary?: string;
    picks?: Array<{ sku?: string; reason?: string }>;
  };

  const bySku = new Map(retrieved.map((p) => [p.sku, p]));
  const picks: RagPick[] = [];

  for (const pick of parsed.picks ?? []) {
    if (!pick.sku || !bySku.has(pick.sku)) continue;
    const p = bySku.get(pick.sku)!;
    if (intent === 'sleep' && filterSleepPicks([p]).length === 0) continue;
    if (intent === 'running' && filterRunningPicks([p]).length === 0) continue;
    picks.push({
      sku: p.sku,
      name: p.name,
      priceCents: p.priceCents,
      category: p.category,
      reason: pick.reason?.trim() || pickReason(p, intent),
      imageUrl: p.imageUrl ?? resolveProductImageUrl(p),
    });
  }

  if (picks.length === 0 && retrieved.length > 0) {
    const candidates =
      intent === 'sleep'
        ? filterSleepPicks(retrieved)
        : intent === 'running'
          ? filterRunningPicks(retrieved)
          : retrieved;
    for (const p of candidates.slice(0, 3)) {
      picks.push({
        sku: p.sku,
        name: p.name,
        priceCents: p.priceCents,
        category: p.category,
        reason: pickReason(p, intent),
        imageUrl: p.imageUrl ?? resolveProductImageUrl(p),
      });
    }
  }

  return {
    reply: parsed.summary?.trim() || (intent === 'sleep' ? sleepFallbackSummary(picks.map((x) => bySku.get(x.sku)!)) : 'Here are some options from your catalog.'),
    picks: picks.slice(0, 3),
    retrievedCount: retrieved.length,
    usedGroq: true,
  };
}

/** Augment & Generate: Query + retrieved context → LLM → response */
export async function adviseShopping(message: string): Promise<RagAdviceResult> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error('Message is required');

  const { products: retrieved, intent } = await retrieveProductsWithIntent(trimmed, 12);
  if (retrieved.length === 0) {
    return {
      reply: 'Vector index is empty or no products match. Check MySQL catalog and restart the broker to re-index.',
      picks: [],
      retrievedCount: 0,
      usedGroq: false,
    };
  }

  if (!isGroqConfigured()) {
    return finalizeAdvice(trimmed, fallbackAdvice(trimmed, retrieved, intent), retrieved);
  }

  const apiKey = process.env.GROQ_API_KEY!.trim();
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  const context = formatProductContext(retrieved);

  try {
    const { content } = await requestGroqJsonCompletion({
      apiKey,
      model,
      system: ADVISOR_SYSTEM,
      user: `USER QUERY:\n${trimmed}\n\nDETECTED INTENT: ${intent}\n\nRETRIEVED CONTEXT (${retrieved.length} products from vector store):\n${context}`,
      temperature: 0.35,
      fallbackModels: ['llama-3.1-8b-instant'],
    });
    return finalizeAdvice(trimmed, parseGroqAdvice(content, retrieved, intent), retrieved);
  } catch (err) {
    const fallback = fallbackAdvice(trimmed, retrieved, intent);
    const note = err instanceof Error ? err.message.slice(0, 80) : 'Groq unavailable';
    if (!fallback.reply.includes('Groq')) {
      fallback.reply = `${fallback.reply} (LLM unavailable: ${note})`;
    }
    return finalizeAdvice(trimmed, fallback, retrieved);
  }
}
