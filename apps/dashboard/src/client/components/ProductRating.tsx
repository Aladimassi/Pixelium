import { formatStars, getProductRating } from '../lib/product-meta';

export function ProductRating({ sku, compact = false }: { sku: string; compact?: boolean }) {
  const { stars, count } = getProductRating(sku);
  return (
    <p className={`product-rating${compact ? ' product-rating--compact' : ''}`}>
      <span className="product-rating__stars" aria-label={`${stars} out of 5 stars`}>
        {formatStars(stars)}
      </span>
      <span className="product-rating__count">
        {stars.toFixed(1)} ({count.toLocaleString()})
      </span>
    </p>
  );
}
