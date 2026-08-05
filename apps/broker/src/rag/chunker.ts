import type { Product } from '@pixelium/shared';

/** One retrievable chunk in the vector store (product = document). */
export interface DocumentChunk {
  id: string;
  text: string;
  product: Product;
}

function productToText(p: Product): string {
  return [
    `Product: ${p.name}`,
    `Category: ${p.category}`,
    `SKU: ${p.sku}`,
    `Price: $${(p.priceCents / 100).toFixed(2)}`,
    `In stock: ${p.inStock}`,
    `Description: ${p.description}`,
  ].join('\n');
}

/** Chunk catalog products into embedding-ready text segments. */
export function chunkProducts(products: Product[]): DocumentChunk[] {
  return products
    .filter((p) => p.inStock > 0)
    .map((product) => ({
      id: product.sku,
      text: productToText(product),
      product,
    }));
}
