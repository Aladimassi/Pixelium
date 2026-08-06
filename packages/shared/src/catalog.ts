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

/** Common shopping typos → normalized token before fuzzy match. */
const TOKEN_ALIASES: Record<string, string> = {
  runing: 'running',
  runnin: 'running',
  shos: 'shoes',
  shoos: 'shoes',
  sneekers: 'sneakers',
  snakers: 'sneakers',
  headfones: 'headphones',
  headphons: 'headphones',
  earbds: 'earbuds',
  phne: 'phone',
  phoen: 'phone',
  bok: 'book',
  boook: 'book',
  jaket: 'jacket',
  jackt: 'jacket',
};

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function maxFuzzyDistance(token: string, word: string): number {
  const len = Math.max(token.length, word.length);
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 8) return 2;
  return 3;
}

function normalizeToken(raw: string): string {
  const lower = raw.toLowerCase();
  return TOKEN_ALIASES[lower] ?? lower;
}

function tokenMatchesWord(token: string, word: string): { matched: boolean; fuzzy: boolean; score: number } {
  if (token.length < 2 || word.length < 2) {
    return { matched: false, fuzzy: false, score: 0 };
  }

  if (word.includes(token)) {
    return { matched: true, fuzzy: false, score: token.length >= 5 ? 5 : 3 };
  }

  // Avoid spurious hits like "phone" inside "headphones" or "one" inside "xyznonexistent"
  const minEmbedded = Math.max(4, Math.floor(token.length * 0.45));
  if (token.includes(word) && word.length >= minEmbedded && token.length <= word.length + 1) {
    return { matched: true, fuzzy: false, score: token.length >= 5 ? 5 : 3 };
  }

  const lenDiff = Math.abs(token.length - word.length);
  if (lenDiff > maxFuzzyDistance(token, word) + 2) {
    return { matched: false, fuzzy: false, score: 0 };
  }

  const dist = levenshteinDistance(token, word);
  if (dist <= maxFuzzyDistance(token, word)) {
    return { matched: true, fuzzy: true, score: token.length >= 5 ? 4 : 2 };
  }

  return { matched: false, fuzzy: false, score: 0 };
}

function productWords(product: Product): string[] {
  const haystack = `${product.name} ${product.category} ${product.sku} ${product.description}`.toLowerCase();
  return haystack.split(/[^a-z0-9]+/).filter((w) => w.length > 1);
}

function scoreTokenAgainstProduct(token: string, product: Product): { score: number; matched: boolean } {
  const normalized = normalizeToken(token);
  const name = product.name.toLowerCase();
  const category = product.category.toLowerCase();
  const haystack = `${name} ${category} ${product.sku} ${product.description}`.toLowerCase();

  if (name.includes(normalized)) {
    return { score: normalized.length >= 5 ? 5 : 3, matched: true };
  }
  if (category.includes(normalized)) {
    return { score: 2, matched: true };
  }
  if (haystack.includes(normalized)) {
    return { score: 1, matched: true };
  }

  let best = 0;
  let matched = false;
  for (const word of productWords(product)) {
    const result = tokenMatchesWord(normalized, word);
    if (result.matched && result.score > best) {
      best = result.score;
      matched = true;
    }
  }

  return { score: best, matched };
}

function rankProductsByQuery(query: string): Array<{ product: Product; score: number; matchedTokens: string[] }> {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  return getCatalog()
    .map((product) => {
      let score = 0;
      const matchedTokens: string[] = [];
      for (const token of tokens) {
        const { score: tokenScore, matched } = scoreTokenAgainstProduct(token, product);
        if (matched) {
          matchedTokens.push(token);
          score += tokenScore;
        }
      }
      return { product, score, matchedTokens };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

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

  const ranked = rankProductsByQuery(query);
  if (ranked.length === 0) return null;

  const best = ranked[0];
  const unmatched = tokens.filter((t) => !best.matchedTokens.includes(t));
  const badUnmatched = unmatched.filter(
    (t) => t.length >= 3 && !COLOR_WORDS.has(t),
  );

  if (badUnmatched.length > 0) return null;
  if (best.score < Math.max(2, tokens.length * 2)) return null;

  return best.product;
}

export function searchProducts(query: string): Product[] {
  const matched = matchProductFromMessage(query);
  if (matched) return [matched];
  return rankProductsByQuery(query).map((r) => r.product);
}

/** Top catalog picks for error messages when nothing matches exactly. */
export function suggestProducts(query: string, limit = 3): Product[] {
  const exact = searchProducts(query);
  if (exact.length > 0) return exact.slice(0, limit);

  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return getCatalog().slice(0, limit);
  }

  const ranked = rankProductsByQuery(query);
  if (ranked.length > 0) {
    return ranked.slice(0, limit).map((r) => r.product);
  }

  // Last resort: match individual fuzzy tokens loosely
  const loose = getCatalog()
    .map((product) => {
      let score = 0;
      for (const token of tokens) {
        const { score: tokenScore } = scoreTokenAgainstProduct(token, product);
        score += tokenScore;
      }
      return { product, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return loose.slice(0, limit).map((r) => r.product);
}

export function formatProductSuggestionList(products: Product[]): string {
  if (products.length === 0) {
    return 'Try keywords like shoes, headphones, books, or games.';
  }
  return products.map((p) => p.name).join(', ');
}

export function buildNoProductMatchMessage(query: string, suggestions: Product[]): string {
  const trimmed = query.trim();
  if (suggestions.length === 0) {
    return `I couldn't find anything matching "${trimmed}". Try describing the product type — e.g. shoes, headphones, or books.`;
  }
  return `I couldn't find an exact match for "${trimmed}". Did you mean: ${formatProductSuggestionList(suggestions)}?`;
}

export function getProduct(sku: string): Product | undefined {
  return getCatalog().find((p) => p.sku === sku);
}

export function computeTax(subtotalCents: number): number {
  return Math.round(subtotalCents * 0.08);
}
