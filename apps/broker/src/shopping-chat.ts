import { getConversationalReply, isGroqConfigured } from './groq-intent.js';
import { adviseShopping, type RagPick } from './rag/advisor.js';
import { formatProductContext, retrieveProductsWithIntent } from './rag/retriever.js';
import { requestGroqChatCompletion } from './rag/groq-chat.js';
import { guardAdviceOutput } from './guardrails/index.js';
import { filterRunningPicks } from './rag/rerank.js';
import { resolveProductImageUrl } from '@pixelium/shared';
import type { Product } from '@pixelium/shared';
import type { ShoppingIntent } from './rag/query-expand.js';

export type ChatHistoryTurn = { role: 'user' | 'assistant'; content: string };

export interface ShoppingChatResult {
  reply: string;
  picks: RagPick[];
  retrievedCount: number;
  usedGroq: boolean;
  conversational: true;
}

const MAX_HISTORY_TURNS = 10;

const CHAT_SYSTEM = `You are the Pixelium Store shopping assistant in an ongoing conversation.
Help the user find products, compare options, refine budgets, and decide what to buy.

Rules:
- Use ONLY products from the RETRIEVED CATALOG CONTEXT below — never invent SKUs.
- Remember prior turns: follow-ups like "something cheaper", "in red", or "buy them" refer to the conversation.
- Match category to activity: running/jogging → footwear only (never jackets). Sleep → comfort items.
- Be concise and friendly (2-5 sentences unless listing picks).
- When the user asks to buy, say checkout will open for their approval. Do NOT claim checkout is open unless they used a clear buy phrase (buy it, take this, I'll take it).

When recommending products, return JSON:
{
  "reply": "your conversational answer",
  "picks": [{ "sku": "SKU from context", "reason": "short reason" }]
}
Include 0-3 picks. If no product fits, use "picks": [] and explain in reply.`;

function trimHistory(history: ChatHistoryTurn[]): ChatHistoryTurn[] {
  return history
    .filter((t) => t.role === 'user' && t.content.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: 'user' as const, content: t.content.trim() }));
}

function picksFromGroq(
  raw: string,
  retrieved: Product[],
  intent: ShoppingIntent = 'general'
): { reply: string; picks: RagPick[] } {
  try {
    const parsed = JSON.parse(raw) as {
      reply?: string;
      summary?: string;
      picks?: Array<{ sku?: string; reason?: string }>;
    };
    const bySku = new Map(retrieved.map((p) => [p.sku, p]));
    const picks: RagPick[] = [];
    for (const pick of parsed.picks ?? []) {
      if (!pick.sku || !bySku.has(pick.sku)) continue;
      const p = bySku.get(pick.sku)!;
      picks.push({
        sku: p.sku,
        name: p.name,
        priceCents: p.priceCents,
        category: p.category,
        reason: pick.reason?.trim() || 'Matches your request',
        imageUrl: p.imageUrl ?? resolveProductImageUrl(p),
      });
    }
    return {
      reply: (parsed.reply ?? parsed.summary ?? '').trim() || 'How can I help you shop next?',
      picks: picks.slice(0, 3),
    };
  } catch {
    return { reply: raw.trim() || 'How can I help you shop next?', picks: [] };
  }
}

function filterPicksForIntent(picks: RagPick[], retrieved: Product[], intent: ShoppingIntent): RagPick[] {
  if (intent !== 'running') return picks;
  const bySku = new Map(retrieved.map((p) => [p.sku, p]));
  return picks.filter((pick) => {
    const p = bySku.get(pick.sku);
    return p ? filterRunningPicks([p]).length > 0 : false;
  });
}

/** Multi-turn shopping chat with RAG catalog context. */
export async function shoppingAssistantChat(
  message: string,
  history: ChatHistoryTurn[] = []
): Promise<ShoppingChatResult> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error('Message is required');

  const prior = trimHistory(history);
  const contextQuery = [...prior.filter((t) => t.role === 'user').slice(-2), trimmed].join(' ');
  const { products: retrieved, intent } = await retrieveProductsWithIntent(contextQuery, 12);

  if (!isGroqConfigured()) {
    const advice = await adviseShopping(trimmed);
    return {
      reply: advice.reply,
      picks: advice.picks,
      retrievedCount: advice.retrievedCount,
      usedGroq: false,
      conversational: true,
    };
  }

  const apiKey = process.env.GROQ_API_KEY!.trim();
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  const catalogBlock =
    retrieved.length > 0
      ? `\n\nRETRIEVED CATALOG CONTEXT (${retrieved.length} products):\n${formatProductContext(retrieved)}`
      : '\n\nRETRIEVED CATALOG CONTEXT: (empty — suggest the user try different keywords)';

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: CHAT_SYSTEM + catalogBlock + `\n\nDETECTED INTENT: ${intent}` },
    ...prior.map((t) => ({ role: 'user' as const, content: t.content })),
    { role: 'user', content: trimmed },
  ];

  try {
    const { content } = await requestGroqChatCompletion({
      apiKey,
      model,
      messages,
      temperature: 0.45,
      jsonMode: true,
      fallbackModels: ['llama-3.1-8b-instant'],
    });
    const { reply, picks } = picksFromGroq(content, retrieved, intent);
    const allowedSkus = new Set(retrieved.map((p) => p.sku));
    const check = guardAdviceOutput(trimmed, reply, picks, allowedSkus);
    const safeReply =
      check.allowed
        ? reply
        : check.rule === 'autonomous_payment_promise'
          ? 'I can suggest products, but only you can approve payment through checkout.'
          : reply;
    const safePicks = filterPicksForIntent(
      picks.filter((p) => allowedSkus.has(p.sku)),
      retrieved,
      intent
    );

    return {
      reply: safeReply,
      picks: safePicks,
      retrievedCount: retrieved.length,
      usedGroq: true,
      conversational: true,
    };
  } catch {
    if (prior.length === 0) {
      return {
        reply: getConversationalReply(trimmed),
        picks: [],
        retrievedCount: retrieved.length,
        usedGroq: false,
        conversational: true,
      };
    }
    const advice = await adviseShopping(trimmed);
    return {
      reply: advice.reply,
      picks: advice.picks,
      retrievedCount: advice.retrievedCount,
      usedGroq: advice.usedGroq,
      conversational: true,
    };
  }
}
