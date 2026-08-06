import { buildCart, createIntentMandate } from './broker.js';
import { parseShoppingIntent, type ParsedPurchaseIntent } from './groq-intent.js';
import type { CartMandate, IntentMandate, IntentMandatePayload } from '@pixelium/shared';

export type ChatHistoryTurn = { role: 'user' | 'assistant'; content: string };

export interface PreparedAiPurchase {
  parsed: ParsedPurchaseIntent;
  intentMandate: IntentMandate;
  cartMandate: CartMandate;
}

/** Combine recent chat turns so follow-ups like "buy them" keep product context. */
export function buildPurchaseQuery(message: string, history: ChatHistoryTurn[] = []): string {
  const current = message.trim();
  if (!current) return '';

  const namesProduct =
    /\b(jacket|sneakers?|shoes?|headphones|phone|book|trainers?|high-?tops?|coat|parka)\b/i.test(current);

  // User named a specific product type — don't mix in unrelated earlier topics.
  if (namesProduct && !/\b(it|them|those|this|that|one|item)\b/i.test(current)) {
    return current;
  }

  // Pronoun / deictic follow-up — use recent user messages for product context.
  if (/\b(it|them|those|this|that|the one|this item|that item|this one|that one)\b/i.test(current)) {
    const recent = history
      .filter((t) => t.role === 'user')
      .slice(-3)
      .map((t) => t.content.trim())
      .filter(Boolean);
    return [...recent, current].join('. ');
  }

  const parts = history
    .filter((t) => t.role === 'user')
    .slice(-4)
    .map((t) => t.content.trim())
    .filter(Boolean);
  parts.push(current);
  return parts.join('. ');
}

export async function prepareAiPurchase(
  message: string,
  userId: string,
  history: ChatHistoryTurn[] = []
): Promise<PreparedAiPurchase> {
  const query = buildPurchaseQuery(message, history);
  const parsed = await parseShoppingIntent(query);
  const items = [{ sku: parsed.sku, quantity: parsed.quantity }];
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const conditions: IntentMandatePayload['conditions'] =
    parsed.flowMode === 'delegated'
      ? {
          maxPriceCents: parsed.maxPriceCents,
          allowedSkus: [parsed.sku],
          validUntil,
        }
      : { maxPriceCents: parsed.maxPriceCents, validUntil };

  const intentMandate = createIntentMandate(
    parsed.flowMode,
    parsed.naturalLanguageIntent,
    conditions,
    userId
  );
  const cartResult = await buildCart(intentMandate, items);
  if ('error' in cartResult) {
    throw new Error(cartResult.error);
  }
  if (cartResult.cartMandate.payload.totalCents > parsed.maxPriceCents) {
    throw new Error(
      `Cart total $${(cartResult.cartMandate.payload.totalCents / 100).toFixed(2)} exceeds budget $${(parsed.maxPriceCents / 100).toFixed(2)} incl. tax.`
    );
  }

  return {
    parsed: {
      ...parsed,
      agentThinking: cartResult.agentThinking,
      agentWarnings: cartResult.agentWarnings,
    } as ParsedPurchaseIntent & { agentThinking?: string; agentWarnings?: string[] },
    intentMandate,
    cartMandate: cartResult.cartMandate,
  };
}
