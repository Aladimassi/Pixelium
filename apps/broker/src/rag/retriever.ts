import type { Product } from '@pixelium/shared';
import { embedQuery } from './embeddings.js';
import { expandQueryForRetrieval, type ExpandedQuery, type ShoppingIntent } from './query-expand.js';
import { rerankHits } from './rerank.js';
import { vectorStore } from './vector-store.js';

export interface RetrievalResult {
  products: Product[];
  intent: ShoppingIntent;
  expandedQuery: ExpandedQuery;
}

/** Retrieval pipeline: Query → expand → embed → vector search → rerank → retrieve */
export async function retrieveProductsWithIntent(query: string, limit = 10): Promise<RetrievalResult> {
  const expandedQuery = expandQueryForRetrieval(query);
  if (vectorStore.size() === 0) {
    return { products: [], intent: expandedQuery.intent, expandedQuery };
  }

  const queryVector = await embedQuery(expandedQuery.searchText);
  const hits = vectorStore.search(queryVector, Math.max(limit * 2, 20));
  const reranked = rerankHits(hits, expandedQuery);

  return {
    products: reranked.slice(0, limit).map((h) => h.node.product),
    intent: expandedQuery.intent,
    expandedQuery,
  };
}

export async function retrieveProducts(query: string, limit = 10): Promise<Product[]> {
  const { products } = await retrieveProductsWithIntent(query, limit);
  return products;
}

export function formatProductContext(products: Product[]): string {
  return products
    .map(
      (p) =>
        `- SKU: ${p.sku} | ${p.name} | ${p.category} | $${(p.priceCents / 100).toFixed(2)} | ${p.inStock} in stock | ${p.description.slice(0, 120)}`
    )
    .join('\n');
}
