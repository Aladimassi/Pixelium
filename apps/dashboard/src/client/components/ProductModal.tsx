import type { Product } from '../lib/cart';
import { formatPrice, handleProductImageError, productImageUrl } from '../lib/cart';
import { formatCategoryLabel, getProductRating } from '../lib/product-meta';
import { useDialog } from '../hooks/useDialog';
import { ProductRating } from './ProductRating';

interface ProductModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onAddToCart: (sku: string) => void;
}

export function ProductModal({ open, product, onClose, onAddToCart }: ProductModalProps) {
  const dialogRef = useDialog(open);

  if (!product) return null;

  const { stars, count } = getProductRating(product.sku);
  const lowStock = product.inStock > 0 && product.inStock <= 5;

  return (
    <>
      <div
        id="product-overlay"
        className={`overlay${open ? '' : ' hidden'}`}
        onClick={onClose}
      />
      <dialog ref={dialogRef} id="product-modal" className="product-modal">
        <button type="button" id="btn-close-product" className="modal-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div id="product-detail" className="product-detail">
          <img
            className="product-detail__img"
            src={productImageUrl(product)}
            alt={product.name}
            data-sku={product.sku}
            onError={handleProductImageError}
          />
          <div className="product-detail__body">
            <p className="product-card__cat">{formatCategoryLabel(product.category)}</p>
            <h2>{product.name}</h2>
            <ProductRating sku={product.sku} />
            <p className="product-detail__price">{formatPrice(product.priceCents)}</p>
            <ul className="product-detail__perks">
              <li>Free standard delivery on orders over €50</li>
              <li>{product.refundable ? '30-day free returns' : 'Final sale — limited returns'}</li>
              <li>Secure checkout — you approve every charge</li>
            </ul>
            <p className="product-detail__desc">{product.description}</p>
            <p className="product-card__stock">
              {product.inStock > 0 ? (
                lowStock ? (
                  <span className="stock-badge stock-badge--low">Only {product.inStock} left in stock</span>
                ) : (
                  `${product.inStock} in stock — ships in 1–2 days`
                )
              ) : (
                <span className="stock-badge stock-badge--out">Out of stock</span>
              )}
            </p>
            <p className="hint product-detail__sku">SKU: {product.sku}</p>
            <button
              type="button"
              id="modal-add-cart"
              className="btn-primary btn-full"
              disabled={product.inStock < 1}
              onClick={() => {
                onAddToCart(product.sku);
                onClose();
              }}
            >
              Add to cart →
            </button>
            <p className="hint product-detail__reviews-note">
              Rated {stars.toFixed(1)} / 5 by {count.toLocaleString()} verified buyers
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
