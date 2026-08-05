import type { Product } from '@pixelium/shared';

export interface VectorNode {
  id: string;
  vector: number[];
  text: string;
  product: Product;
}

export interface SearchHit {
  node: VectorNode;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/** In-memory vector store — indexing & similarity search. */
class VectorStore {
  private nodes: VectorNode[] = [];

  clear(): void {
    this.nodes = [];
  }

  size(): number {
    return this.nodes.length;
  }

  upsert(nodes: VectorNode[]): void {
    this.nodes = nodes;
  }

  search(queryVector: number[], topK: number): SearchHit[] {
    if (this.nodes.length === 0) return [];

    return this.nodes
      .map((node) => ({
        node,
        score: cosineSimilarity(queryVector, node.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export const vectorStore = new VectorStore();
