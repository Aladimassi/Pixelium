import { pipeline } from '@xenova/transformers';

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const BATCH_SIZE = 32;

type Embedder = {
  (text: string, options?: { pooling?: string; normalize?: boolean }): Promise<unknown>;
};

let embedder: Embedder | null = null;
let modelName = DEFAULT_MODEL;

function getModelName(): string {
  return process.env.RAG_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
}

/** Load the sentence-transformer embedding model (once). */
export async function initEmbeddingModel(): Promise<string> {
  modelName = getModelName();
  if (embedder) return modelName;

  embedder = (await pipeline('feature-extraction', modelName, {
    quantized: true,
  })) as Embedder;
  return modelName;
}

export function getEmbeddingModelName(): string {
  return modelName;
}

function toVector(raw: unknown): number[] {
  const data = raw as { data?: Float32Array | number[] };
  if (data?.data) {
    return Array.from(data.data as ArrayLike<number>);
  }
  if (Array.isArray(raw)) {
    return raw.flat(Infinity) as number[];
  }
  throw new Error('Unexpected embedding output shape');
}

async function embedOne(text: string): Promise<number[]> {
  if (!embedder) await initEmbeddingModel();
  const output = await embedder!(text, { pooling: 'mean', normalize: true });
  return toVector(output);
}

/** Vectorize many document chunks during indexing. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (!embedder) await initEmbeddingModel();
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    for (const text of batch) {
      vectors.push(await embedOne(text));
    }
  }

  return vectors;
}

/** Vectorize a user query for similarity search. */
export async function embedQuery(query: string): Promise<number[]> {
  return embedOne(query.trim());
}
