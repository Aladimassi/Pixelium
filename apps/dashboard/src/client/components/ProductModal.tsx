import type { Product } from '../lib/cart';
import { formatPrice, handleProductImageError, productImageUrl } from '../lib/cart';
import { useDialog } from '../hooks/useDialog';

interface ProductModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onAddToCart: (sku: string) => void;
}

export function ProductModal({ open, product, onClose, onAddToCart }: ProductModalProps) {
  const dialogRef = useDialog(open);

  if (!product) return null;

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
        <div id="product-detail">
          <img
            className="product-detail__img"
            src={productImageUrl(product)}
            alt={product.name}
            data-sku={product.sku}
            onError={handleProductImageError}
          />
          <p className="product-card__cat">{product.category}</p>
          <h2>{product.name}</h2>
          <p className="product-detail__price">{formatPrice(product.priceCents)}</p>
          <p className="product-detail__desc">{product.description}</p>
          <p className="product-card__stock">
            {product.inStock > 0 ? `${product.inStock} in stock` : 'Out of stock'}
          </p>
          <button
            type="button"
            id="modal-add-cart"
            className="btn-primary"
            disabled={product.inStock < 1}
            onClick={() => {
              onAddToCart(product.sku);
              onClose();
            }}
          >
            Add to Cart →
          </button>
        </div>
      </dialog>
    </>
  );
}
