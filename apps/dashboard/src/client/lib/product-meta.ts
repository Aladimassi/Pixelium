/** Deterministic mock ratings for store polish (no backend reviews yet). */
export function getProductRating(sku: string): { stars: number; count: number } {
  let hash = 0;
  for (let i = 0; i < sku.length; i++) {
    hash = (hash * 31 + sku.charCodeAt(i)) >>> 0;
  }
  const stars = Math.round((3.6 + (hash % 14) / 10) * 10) / 10;
  const count = 18 + (hash % 480);
  return { stars: Math.min(5, stars), count };
}

export function formatStars(stars: number): string {
  const full = Math.floor(stars);
  const half = stars - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

export function formatCategoryLabel(name: string): string {
  return name
    .replace(/-/g, ' ')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
