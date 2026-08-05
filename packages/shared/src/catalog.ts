export interface Product {
  sku: string;
  name: string;
  category: string;
  priceCents: number;
  description: string;
  refundable: boolean;
  inStock: number;
  /** Product photo URL (Unsplash or stored in MySQL). */
  imageUrl?: string;
}

let activeCatalog: Product[] | null = null;

/** Replace in-memory catalog (called after MySQL load). */
export function setActiveCatalog(products: Product[]): void {
  activeCatalog = products.length > 0 ? products : null;
}

function getCatalog(): Product[] {
  return activeCatalog ?? MOCK_CATALOG;
}

export const MOCK_CATALOG: Product[] = [
  {
    sku: 'SHOE-RED-HIGH',
    name: 'Classic Red High-Top Sneakers',
    category: 'footwear',
    priceCents: 12999,
    description:
      'Bold red high-top sneakers with padded collar and grippy rubber sole. Lightweight for running, training, and everyday wear. Classic court-shoe look that pairs with jeans or joggers.',
    refundable: true,
    inStock: 12,
  },
  {
    sku: 'JACKET-GREEN-M',
    name: 'Waterproof Trail Jacket (Green, M)',
    category: 'outerwear',
    priceCents: 18999,
    description:
      'Forest-green waterproof trail jacket, size M. Seam-sealed hood, breathable lining, and packable fit for hiking, commuting, and winter weather. Wind-resistant shell keeps you dry in rain and snow.',
    refundable: true,
    inStock: 5,
  },
  {
    sku: 'PHONE-17-PRO',
    name: 'PixelPhone 17 Pro (256GB)',
    category: 'electronics',
    priceCents: 169999,
    description:
      'Flagship PixelPhone 17 Pro with 256 GB storage, 6.7" OLED display, and built-in AI assistant. Triple-camera system with night mode, all-day battery, and 5G. One-year warranty included.',
    refundable: false,
    inStock: 20,
  },
  {
    sku: 'HEADPHONES-NC',
    name: 'Noise-Canceling Headphones',
    category: 'electronics',
    priceCents: 34999,
    description:
      'Over-ear active noise-canceling headphones with 40-hour battery, Bluetooth 5.3, and a fold-flat travel case. Adaptive ANC for flights and focus work, with memory-foam ear cushions.',
    refundable: true,
    inStock: 30,
  },
  {
    sku: 'BOOK-AI-AGENTS',
    name: 'Building Agentic Systems',
    category: 'books',
    priceCents: 4599,
    description:
      'Practical guide to multi-agent architectures, tool use, RAG pipelines, and consent-aware commerce. Covers orchestration patterns and production deployment. Paperback, 320 pages.',
    refundable: true,
    inStock: 100,
  },
];

const STOP_WORDS = new Set([
  'buy', 'me', 'the', 'a', 'an', 'under', 'over', 'for', 'with', 'want', 'get',
  'please', 'some', 'my', 'and', 'or', 'to', 'in', 'on', 'at', 'is', 'it',
  'dollars', 'dollar', 'usd', 'from', 'selected', 'item', 'approval', 'test',
  'check', 'site',
  'who', 'are', 'you', 'what', 'how', 'why', 'when', 'where', 'can', 'does',
  'hello', 'hi', 'hey', 'thanks', 'thank', 'help',
]);

const COLOR_WORDS = new Set(['red', 'green', 'blue', 'black', 'white', 'grey', 'gray']);

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[$,]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/[^\w-]/g, ''))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

/** Best catalog match or null — never silently defaults to first product */
export function matchProductFromMessage(query: string): Product | null {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return null;

  type Scored = { product: Product; matched: string[]; score: number };
  const ranked: Scored[] = getCatalog().map((p) => {
    const name = p.name.toLowerCase();
    const haystack = `${name} ${p.category} ${p.sku} ${p.description}`.toLowerCase();
    const matched: string[] = [];
    let score = 0;
    for (const token of tokens) {
      if (name.includes(token)) {
        matched.push(token);
        score += token.length >= 5 ? 5 : 3;
      } else if (p.category.includes(token)) {
        matched.push(token);
        score += 2;
      } else if (haystack.includes(token)) {
        matched.push(token);
        score += 1;
      }
    }
    return { product: p, matched, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;

  const best = ranked[0];
  const unmatched = tokens.filter((t) => !best.matched.includes(t));
  const badUnmatched = unmatched.filter(
    (t) => t.length >= 3 && !COLOR_WORDS.has(t)
  );

  if (badUnmatched.length > 0) return null;
  if (best.score < 2) return null;

  return best.product;
}

export function searchProducts(query: string): Product[] {
  const matched = matchProductFromMessage(query);
  if (matched) return [matched];
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const scored = getCatalog().map((p) => {
    const haystack = `${p.name} ${p.category} ${p.sku} ${p.description}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (p.name.toLowerCase().includes(token)) score += 3;
      else if (p.category.toLowerCase().includes(token)) score += 2;
      else if (haystack.includes(token)) score += 1;
    }
    return { product: p, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((x) => x.product);
}

export function getProduct(sku: string): Product | undefined {
  return getCatalog().find((p) => p.sku === sku);
}

export function computeTax(subtotalCents: number): number {
  return Math.round(subtotalCents * 0.08);
}
