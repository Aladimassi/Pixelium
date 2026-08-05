import type { Product } from '@pixelium/shared';
import { chunkProducts } from './chunker.js';
import { embedDocuments, getEmbeddingModelName, initEmbeddingModel } from './embeddings.js';
import { vectorStore, type VectorNode } from './vector-store.js';

export interface IndexStats {
  chunks: number;
  embeddingModel: string;
}

/** Indexing pipeline: Documents → Chunking → Embedding → Vector Store */
export async function buildVectorIndex(products: Product[]): Promise<IndexStats> {
  const embeddingModel = await initEmbeddingModel();
  const chunks = chunkProducts(products);

  vectorStore.clear();
  if (chunks.length === 0) {
    return { chunks: 0, embeddingModel };
  }

  const vectors = await embedDocuments(chunks.map((c) => c.text));
  const nodes: VectorNode[] = chunks.map((chunk, i) => ({
    id: chunk.id,
    vector: vectors[i],
    text: chunk.text,
    product: chunk.product,
  }));

  vectorStore.upsert(nodes);
  return { chunks: nodes.length, embeddingModel: getEmbeddingModelName() };
}

export function isVectorIndexReady(): boolean {
  return vectorStore.size() > 0;
}

export function getVectorIndexSize(): number {
  return vectorStore.size();
}
