import { STORE_CATALOG, type Product } from './store-catalog.js';

export type { Product } from './store-catalog.js';
export { STORE_CATALOG, FEATURED_SKUS, STORE_CATALOG as MOCK_CATALOG } from './store-catalog.js';

let activeCatalog: Product[] | null = null;

/** Replace in-memory catalog (called after MySQL load). */
export function setActiveCatalog(products: Product[]): void {
  activeCatalog = products.length > 0 ? products : null;
}

function getCatalog(): Product[] {
  return activeCatalog ?? STORE_CATALOG;
}

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
