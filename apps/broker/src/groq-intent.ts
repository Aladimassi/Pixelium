import Groq from 'groq-sdk';
import { computeTax, getProduct, searchProducts } from '@pixelium/shared';
export interface ParsedPurchaseIntent {
  sku: string;
  quantity: number;
  maxPriceCents: number;
  flowMode: 'realtime' | 'delegated';
  naturalLanguageIntent: string;
  aiSummary?: string;
  usedGroq: boolean;
  /** Top catalog matches used as context (retrieval step before LLM). */
  candidates?: Array<{ sku: string; name: string; priceCents: number; category: string }>;
}

const CANDIDATE_LIMIT = 20;

const SHOPPING_SIGNAL =
  /\b(buy|purchase|order|shop|cart|checkout|headphones|shoes|jacket|phone|book|train|game|sku|under\s+\$|budget|price)\b/i;

/** Open-ended “help me decide” queries — route to RAG advisor, not chit-chat. */
export const ADVISORY_SIGNAL =
  /\b(recommend|reccommend|reccomend|suggest|what should|what do you|what would you|what to (buy|get)|help me (choose|pick|find|decide)|best (gift|option)|compare|which (one|product|would)|gift for|ideas for|shopping list|personal shopper|advice|show me)\b/i;

/** Catalog SKU pattern, e.g. LAMP-DESK-LED */
const SKU_PATTERN = /\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/;

/** Pull an exact catalog SKU from the message when present. */
export function extractExplicitSku(message: string): string | null {
  const matches = message.match(new RegExp(SKU_PATTERN.source, 'gi')) ?? [];
  for (const raw of matches) {
    const sku = raw.toUpperCase();
    if (getProduct(sku)) return sku;
  }
  return null;
}

function extractQuantity(message: string): number {
  const m = message.match(/\b(?:qty|quantity|x)\s*[:.]?\s*(\d{1,2})\b/i);
  if (m) return Math.max(1, Math.min(99, Number(m[1])));
  return 1;
}

/** User wants to complete a purchase — route chat to checkout preparation. */
export function isPurchaseIntentMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  if (extractExplicitSku(text)) return true;

  // Recommendation / exploration — suggest products, do not checkout.
  if (isAdvisoryMessage(text) && !/\b(buy|purchase|order|checkout|add to cart)\b/i.test(text)) return false;

  const hasBuyVerb = /\b(buy|purchase|order|checkout|i('ll| will) take|add to cart)\b/i.test(text);

  // Questions and comparisons without a buy command stay in advisory chat.
  if (
    /\b(what do you|what would you|which (one|would)|show me|help me|compare|options?|ideas?|recommend|suggest|reccommend|reccomend)\b/i.test(
      text
    ) &&
    !hasBuyVerb
  ) {
    return false;
  }

  // Vague browsing — "I want to buy gifts" with no concrete checkout phrase.
  if (
    /\b(i want to buy|looking to buy|thinking (about|of) buying|need to buy|shopping for)\b/i.test(text) &&
    !/\b(buy\s+\S|purchase\s+\S|order\s+\S|checkout|i('ll| will) take|add to cart)\b/i.test(text)
  ) {
    return false;
  }

  // Strong checkout signals (follow-ups after recommendations).
  if (
    /\b(checkout(\s+now)?|add\s+(it|them|that|this)\s+to(\s+my)?\s+cart|i want (this|that|it|the one))\b/i.test(
      text
    )
  ) {
    return true;
  }

  if (
    /\b(i('ll| will) take|take\s+(this|that|it|the|those|these)(\s+(one|item))?|get me|grab\s+(me\s+)?)\b/i.test(
      text
    )
  ) {
    return true;
  }

  if (
    /\b(buy\s+(me\s+)?(the|those|these|it|them|that|this)|purchase\s+(the|those|these|it|them|that|this)|order\s+(the|those|these|it|them|that|this|now))\b/i.test(
      text
    )
  ) {
    return true;
  }

  // Direct product purchase: "buy headphones", "order red sneakers under $150".
  const buyMatch = text.match(/\b(buy|purchase|order)\s+(?:me\s+)?(.+)/i);
  if (buyMatch) {
    const rest = buyMatch[2].replace(/[!?.]+$/, '').trim();
    if (rest.length > 0 && !/^(something|anything|stuff|things?|a gift)$/i.test(rest)) {
      return true;
    }
  }

  // Trailing purchase intent: "laptop under $500 … purchase (it)"
  if (/\b(buy|purchase|order)\b/i.test(text) && SHOPPING_SIGNAL.test(text)) {
    return true;
  }

  return false;
}

function parseIntentFromExplicitSku(message: string, sku: string): ParsedPurchaseIntent {
  const product = getProduct(sku)!;
  const quantity = Math.min(extractQuantity(message), product.inStock || 1);
  const maxPriceCents = resolveMaxPriceCents(message, product.priceCents, quantity);
  const delegated = /\b(later|away|automatic|delegate|without me|not present)\b/i.test(message);
  return {
    sku: product.sku,
    quantity,
    maxPriceCents,
    flowMode: delegated ? 'delegated' : 'realtime',
    naturalLanguageIntent: message.trim(),
    aiSummary: `Matched SKU ${product.sku} — ${product.name}`,
    usedGroq: false,
  };
}

export function isAdvisoryMessage(message: string): boolean {
  return ADVISORY_SIGNAL.test(message.trim());
}

export class ConversationalMessageError extends Error {
  readonly reply: string;

  constructor(reply: string) {
    super(reply);
    this.name = 'ConversationalMessageError';
    this.reply = reply;
  }
}

/** Chit-chat / help — not a catalog purchase request. */
export function isConversationalMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (SHOPPING_SIGNAL.test(text) || isAdvisoryMessage(text)) return false;

  if (/^(who|what|how|why|hello|hi|hey|help|thanks|thank you)\b/i.test(text)) return true;
  if (/\b(who are you|what are you|what can you do|how do you work|how does this work)\b/i.test(text)) {
    return true;
  }

  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const chitChat = new Set([
    'who', 'are', 'you', 'what', 'how', 'why', 'when', 'where', 'can', 'does', 'do',
    'hello', 'hi', 'hey', 'thanks', 'thank', 'help', 'assistant', 'bot',
  ]);
  return tokens.length > 0 && tokens.every((t) => chitChat.has(t));
}

export function getConversationalReply(message: string): string {
  const text = message.trim();
  if (/\bwho are you\b/i.test(text)) {
    return "I'm the Pixelium Store AI assistant. I search your catalog, build purchase intents, and prepare consent-aware checkouts. Payment only happens after you approve Review & pay. Try: \"Buy noise-canceling headphones under $400\".";
  }
  if (/\b(what can you do|how do you work|how does this work|help)\b/i.test(text)) {
    return 'I can search products, recommend what to buy, and prepare checkout when you ask to buy something. Just chat naturally — e.g. "Gift ideas under $50" then "Buy me the red sneakers".';
  }
  if (/^(hi|hello|hey)\b/i.test(text)) {
    return 'Hello! Tell me what you want to buy — for example "noise canceling headphones under 400 dollars".';
  }
  if (/thank/i.test(text)) {
    return "You're welcome! Ask anytime if you want help finding or buying something.";
  }
  return "I'm here to help you shop with consent-aware checkout. Describe a product you want — not general chat — e.g. \"Buy red sneakers under $150\".";
}

/** Retrieval step — narrow 500+ products to relevant candidates for the LLM prompt. */
function catalogCandidatesForPrompt(message: string) {
  return searchProducts(message)
    .slice(0, CANDIDATE_LIMIT)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      priceCents: p.priceCents,
      category: p.category,
      inStock: p.inStock,
    }));
}

/** Minimum intent ceiling = subtotal + 8% tax (matches cart mandate). */
function minimumBudgetWithTax(unitPriceCents: number, quantity: number): number {
  const subtotal = unitPriceCents * quantity;
  return subtotal + computeTax(subtotal);
}

/** Extract budget from phrases like "under $400" or "under 400 dollars" */
function extractBudgetCents(message: string): { cents: number; explicit: boolean } {
  const patterns = [
    /under\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /below\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /less\s+than\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /max(?:imum)?\s+(?:of\s+)?\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /budget\s+(?:of\s+)?\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /\$\s*(\d+(?:\.\d{1,2})?)\s*(?:max|limit|ceiling|or\s+less)?/i,
  ];

  for (const pattern of patterns) {
    const m = message.match(pattern);
    if (m) {
      const dollars = parseFloat(m[1]);
      if (!Number.isNaN(dollars) && dollars > 0) {
        return { cents: Math.round(dollars * 100), explicit: true };
      }
    }
  }

  return { cents: 0, explicit: false };
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly budgetCents: number,
    public readonly cheapest?: { name: string; totalCents: number }
  ) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

function candidatesWithinBudget(
  candidates: ReturnType<typeof catalogCandidatesForPrompt>,
  budgetCents: number,
  quantity: number
) {
  return candidates.filter((c) => {
    const product = getProduct(c.sku);
    if (!product || product.inStock < quantity) return false;
    return minimumBudgetWithTax(product.priceCents, quantity) <= budgetCents;
  });
}

function budgetExceededMessage(
  message: string,
  budgetCents: number,
  candidates: ReturnType<typeof catalogCandidatesForPrompt>,
  quantity: number
): never {
  const priced = candidates
    .map((c) => {
      const p = getProduct(c.sku);
      if (!p) return null;
      return { name: p.name, totalCents: minimumBudgetWithTax(p.priceCents, quantity) };
    })
    .filter((x): x is { name: string; totalCents: number } => x !== null)
    .sort((a, b) => a.totalCents - b.totalCents);

  const cheapest = priced[0];
  const hint = cheapest
    ? ` Cheapest related item "${cheapest.name}" is ${formatDollars(cheapest.totalCents)} incl. tax.`
    : '';
  throw new BudgetExceededError(
    `No match within ${formatDollars(budgetCents)} incl. tax for "${message}".${hint} Try a higher budget or different keywords.`,
    budgetCents,
    cheapest
  );
}

function pickProductForMessage(
  message: string,
  candidates: ReturnType<typeof catalogCandidatesForPrompt>,
  quantity = 1
) {
  const { cents: budgetCents, explicit } = extractBudgetCents(message);

  if (explicit) {
    const affordable = candidatesWithinBudget(candidates, budgetCents, quantity);
    if (affordable.length === 0) {
      budgetExceededMessage(message, budgetCents, candidates, quantity);
    }
    const product = getProduct(affordable[0].sku)!;
    return { product, maxPriceCents: budgetCents, budgetExplicit: true };
  }

  const product = getProduct(candidates[0].sku)!;
  const maxPriceCents = minimumBudgetWithTax(product.priceCents, quantity);
  return { product, maxPriceCents, budgetExplicit: false };
}

function resolveMaxPriceCents(
  message: string,
  productPriceCents: number,
  quantity: number,
  groqMax?: number
): number {
  const required = minimumBudgetWithTax(productPriceCents, quantity);
  const { cents: fromText, explicit } = extractBudgetCents(message);

  if (explicit) {
    if (required > fromText) {
      throw new BudgetExceededError(
        `Selected item total ${formatDollars(required)} exceeds your ${formatDollars(fromText)} budget incl. tax.`,
        fromText,
        { name: '', totalCents: required }
      );
    }
    return fromText;
  }

  return Math.max(groqMax ?? 0, required);
}

function parseIntentFallback(message: string): ParsedPurchaseIntent {
  const candidates = catalogCandidatesForPrompt(message);
  if (candidates.length === 0) {
    throw new Error(
      `No catalog product matches "${message}". Try describing the item, category, or brand.`
    );
  }

  const delegated = /\b(later|away|automatic|delegate|without me|not present)\b/i.test(message);
  const quantity = 1;
  const { product, maxPriceCents, budgetExplicit } = pickProductForMessage(
    message,
    candidates,
    quantity
  );

  let aiSummary = `Matched "${product.name}" via catalog search`;
  if (budgetExplicit) {
    aiSummary += ` (within ${formatDollars(maxPriceCents)} budget incl. tax)`;
  }

  return {
    sku: product.sku,
    quantity,
    maxPriceCents,
    flowMode: delegated ? 'delegated' : 'realtime',
    naturalLanguageIntent: message,
    aiSummary,
    usedGroq: false,
    candidates,
  };
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

const GROQ_SYSTEM_PROMPT = (candidates: ReturnType<typeof catalogCandidatesForPrompt>, budgetHint: string) =>
  `You are a shopping intent parser for Pixelium Store.
The catalog was pre-filtered by keyword search. Pick the BEST match from these candidates ONLY (use exact sku):
${JSON.stringify(candidates)}
${budgetHint}

Return JSON only:
{
  "sku": "exact SKU from candidates",
  "quantity": 1,
  "maxPriceCents": number (user budget ceiling incl ~8% tax — never exceed stated budget),
  "delegated": boolean (true if user wants autonomous/buy later/when away purchase),
  "summary": "one sentence explaining the match"
}
If no candidate fits the user's budget, return { "sku": null, "summary": "reason" }.`;

function groqBudgetHint(message: string): string {
  const { cents, explicit } = extractBudgetCents(message);
  if (!explicit) return 'User did not specify a budget — pick the best overall match.';
  return `HARD BUDGET: checkout total incl. ~8% tax must be <= ${cents} cents (${formatDollars(cents)}). Only pick SKUs that fit this ceiling.`;
}

async function callGroqViaFetch(
  apiKey: string,
  model: string,
  message: string,
  candidates: ReturnType<typeof catalogCandidatesForPrompt>,
  budgetHint: string
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Connection: 'close',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: GROQ_SYSTEM_PROMPT(candidates, budgetHint) },
          { role: 'user', content: message },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
    }
    return (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callGroq(
  apiKey: string,
  model: string,
  message: string,
  candidates: ReturnType<typeof catalogCandidatesForPrompt>,
  budgetHint: string
) {
  const groq = new Groq({ apiKey, maxRetries: 1, timeout: 20_000 });
  return groq.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: GROQ_SYSTEM_PROMPT(candidates, budgetHint) },
      { role: 'user', content: message },
    ],
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientGroqError(msg: string): boolean {
  return /premature close|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed|aborted/i.test(msg);
}

async function requestGroqCompletion(
  apiKey: string,
  model: string,
  message: string,
  candidates: ReturnType<typeof catalogCandidatesForPrompt>
) {
  const budgetHint = groqBudgetHint(message);
  let lastError = '';
  const attempts: Array<() => Promise<{ choices?: Array<{ message?: { content?: string | null } }> }>> = [
    () => callGroq(apiKey, model, message, candidates, budgetHint),
    () => callGroqViaFetch(apiKey, model, message, candidates, budgetHint),
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      return await attempts[i]();
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (i < attempts.length - 1 && isTransientGroqError(lastError)) {
        await sleep(400);
      }
    }
  }
  throw new Error(lastError || 'Groq request failed');
}

function parseGroqCompletion(
  completion: { choices?: Array<{ message?: { content?: string | null } }> },
  trimmed: string,
  candidates: ReturnType<typeof catalogCandidatesForPrompt>,
  model: string
): ParsedPurchaseIntent | null {
  const raw = completion.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as {
    sku?: string | null;
    quantity?: number;
    maxPriceCents?: number;
    delegated?: boolean;
    summary?: string;
  };

  if (!parsed.sku) {
    const { cents, explicit } = extractBudgetCents(trimmed);
    if (explicit) budgetExceededMessage(trimmed, cents, candidates, 1);
    return null;
  }

  const product = getProduct(parsed.sku);
  if (!product) {
    console.warn('[groq] Unknown SKU from model:', parsed.sku);
    return null;
  }

  const candidateSkus = new Set(candidates.map((c) => c.sku));
  if (!candidateSkus.has(parsed.sku)) {
    console.warn('[groq] SKU not in search candidates:', parsed.sku);
    return null;
  }

  const quantity = Math.max(1, Math.min(parsed.quantity ?? 1, product.inStock));
  let maxPriceCents: number;
  try {
    maxPriceCents = resolveMaxPriceCents(
      trimmed,
      product.priceCents,
      quantity,
      parsed.maxPriceCents
    );
  } catch (err) {
    if (err instanceof BudgetExceededError) return null;
    throw err;
  }

  return {
    sku: product.sku,
    quantity,
    maxPriceCents,
    flowMode: parsed.delegated ? 'delegated' : 'realtime',
    naturalLanguageIntent: trimmed,
    aiSummary: parsed.summary ?? `Matched ${product.name} via Groq (${model})`,
    usedGroq: true,
    candidates,
  };
}

export async function parseShoppingIntent(message: string): Promise<ParsedPurchaseIntent> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error('Message is required');
  }

  const explicitSku = extractExplicitSku(trimmed);
  if (explicitSku) {
    return parseIntentFromExplicitSku(trimmed, explicitSku);
  }

  if (isConversationalMessage(trimmed)) {
    throw new ConversationalMessageError(getConversationalReply(trimmed));
  }

  const candidates = catalogCandidatesForPrompt(trimmed);
  if (candidates.length === 0) {
    throw new Error(
      `No products found for "${trimmed}". Try different keywords (e.g. train set, headphones, game).`
    );
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
      const completion = await requestGroqCompletion(apiKey, model, trimmed, candidates);
      const result = parseGroqCompletion(completion, trimmed, candidates, model);
      if (result) return result;
      return parseIntentFallback(trimmed);
    } catch (err) {
      if (err instanceof BudgetExceededError) throw err;
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[groq] ${model} failed:`, lastError);
      if (isTransientGroqError(lastError)) await sleep(600);
    }
  }

  const fallback = parseIntentFallback(trimmed);
  const shortErr = lastError.includes('Premature close')
    ? 'network hiccup'
    : lastError.slice(0, 80);
  fallback.aiSummary = `Catalog search used (Groq: ${shortErr}). ${fallback.aiSummary}`;
  return fallback;
}
