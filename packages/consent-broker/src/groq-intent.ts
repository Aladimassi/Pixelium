import Groq from 'groq-sdk';
import { MOCK_CATALOG, getProduct, matchProductFromMessage } from '@pixelium/shared';

export interface ParsedPurchaseIntent {
  sku: string;
  quantity: number;
  maxPriceCents: number;
  flowMode: 'realtime' | 'delegated';
  naturalLanguageIntent: string;
  aiSummary?: string;
  usedGroq: boolean;
}

function catalogForPrompt() {
  return MOCK_CATALOG.map((p) => ({
    sku: p.sku,
    name: p.name,
    priceCents: p.priceCents,
    category: p.category,
  }));
}

/** Extract budget from phrases like "under $400" or "under 400 dollars" */
function extractBudgetCents(message: string, productPriceCents: number): number {
  const patterns = [
    /under\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /below\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /max(?:imum)?\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /budget\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /\$\s*(\d+(?:\.\d{1,2})?)\s*(?:max|limit|ceiling)?/i,
  ];

  for (const pattern of patterns) {
    const m = message.match(pattern);
    if (m) {
      const dollars = parseFloat(m[1]);
      if (!Number.isNaN(dollars) && dollars > 0) {
        return Math.round(dollars * 100);
      }
    }
  }

  return Math.ceil(productPriceCents * 1.15);
}

function parseIntentFallback(message: string): ParsedPurchaseIntent {
  const product = matchProductFromMessage(message);
  if (!product) {
    throw new Error(
      `No catalog product matches "${message}". Try: headphones, sneakers, phone, jacket, or book.`
    );
  }
  const delegated = /\b(later|away|automatic|delegate|without me|not present)\b/i.test(message);
  const maxPriceCents = extractBudgetCents(message, product.priceCents);

  return {
    sku: product.sku,
    quantity: 1,
    maxPriceCents,
    flowMode: delegated ? 'delegated' : 'realtime',
    naturalLanguageIntent: message,
    aiSummary: `Matched "${product.name}" via keyword search`,
    usedGroq: false,
  };
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

async function callGroq(apiKey: string, model: string, message: string) {
  const groq = new Groq({ apiKey, maxRetries: 3, timeout: 30_000 });
  return groq.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a shopping intent parser for Pixelium Store.
Catalog (use exact sku values only):
${JSON.stringify(catalogForPrompt(), null, 2)}

Return JSON only:
{
  "sku": "exact SKU from catalog",
  "quantity": 1,
  "maxPriceCents": number (budget ceiling incl ~8% tax, at least item total),
  "delegated": boolean (true if user wants autonomous/buy later/when away purchase),
  "summary": "one sentence explaining the match"
}`,
      },
      { role: 'user', content: message },
    ],
  });
}

export async function parseShoppingIntent(message: string): Promise<ParsedPurchaseIntent> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error('Message is required');
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return parseIntentFallback(trimmed);
  }

  const models = [
    process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ];

  let lastError = '';

  for (const model of models) {
    try {
      const completion = await callGroq(apiKey, model, trimmed);
      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as {
        sku?: string;
        quantity?: number;
        maxPriceCents?: number;
        delegated?: boolean;
        summary?: string;
      };

      const product = parsed.sku ? getProduct(parsed.sku) : undefined;
      if (!product) {
        console.warn('[groq] Unknown SKU from model:', parsed.sku);
        return parseIntentFallback(trimmed);
      }

      const quantity = Math.max(1, Math.min(parsed.quantity ?? 1, product.inStock));
      const minBudget = Math.ceil(product.priceCents * quantity * 1.1);
      const budgetFromText = extractBudgetCents(trimmed, product.priceCents);

      return {
        sku: product.sku,
        quantity,
        maxPriceCents: Math.max(
          parsed.maxPriceCents ?? budgetFromText,
          minBudget,
          budgetFromText
        ),
        flowMode: parsed.delegated ? 'delegated' : 'realtime',
        naturalLanguageIntent: trimmed,
        aiSummary: parsed.summary ?? `Matched ${product.name} via Groq (${model})`,
        usedGroq: true,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[groq] ${model} failed:`, lastError);
    }
  }

  const fallback = parseIntentFallback(trimmed);
  fallback.aiSummary = `Groq unavailable (${lastError}). ${fallback.aiSummary}`;
  return fallback;
}
