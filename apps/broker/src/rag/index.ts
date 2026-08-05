import { getProductStore } from '@pixelium/catalog';
import {
  buildVectorIndex,
  getVectorIndexSize,
  isVectorIndexReady,
  type IndexStats,
} from './indexer.js';

export { adviseShopping, type RagAdviceResult, type RagPick } from './advisor.js';
export { retrieveProducts, formatProductContext } from './retriever.js';
export { getEmbeddingModelName } from './embeddings.js';
export { isVectorIndexReady, getVectorIndexSize, type IndexStats };

let lastIndexStats: IndexStats | null = null;

export function getRagIndexStats(): IndexStats | null {
  return lastIndexStats;
}

/** Full indexing: catalog → chunk → embed → vector store */
export async function refreshRagIndex(): Promise<IndexStats> {
  const store = getProductStore();
  const products = await store.listAll();
  lastIndexStats = await buildVectorIndex(products);
  return lastIndexStats;
}

export function isIndexReady(): boolean {
  return isVectorIndexReady();
}
