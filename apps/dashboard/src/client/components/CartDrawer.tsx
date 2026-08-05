import type { CartItem, Product } from '../lib/cart';
import { formatPrice, handleProductImageError, productImageUrl } from '../lib/cart';

interface CartDrawerProps {
  open: boolean;
  cart: CartItem[];
  productsBySku: Record<string, Product>;
  subtotal: number;
  tax: number;
  total: number;
  onClose: () => void;
  onUpdateQty: (sku: string, quantity: number) => void;
  onCheckout: () => void;
}

export function CartDrawer({
  open,
  cart,
  productsBySku,
  subtotal,
  tax,
  total,
  onClose,
  onUpdateQty,
  onCheckout,
}: CartDrawerProps) {
  return (
    <>
      <div
        id="cart-overlay"
        className={`overlay${open ? '' : ' hidden'}`}
        aria-hidden={!open}
        onClick={onClose}
      />
      <aside id="cart-drawer" className={`cart-drawer${open ? '' : ' hidden'}`} aria-label="Shopping cart">
        <header className="cart-drawer__head">
          <h2>Cart</h2>
          <button type="button" id="btn-close-cart" className="btn-ghost" aria-label="Close cart" onClick={onClose}>
            ✕
          </button>
        </header>
        <div id="cart-items" className="cart-drawer__body">
          {cart.length === 0 ? (
            <p className="empty-state">Your cart is empty.</p>
          ) : (
            cart.map((item) => {
              const p = productsBySku[item.sku];
              if (!p) return null;
              return (
                <div className="cart-line" key={item.sku}>
                  <img
                    className="cart-line__thumb"
                    src={productImageUrl(p)}
                    alt=""
                    loading="lazy"
                    data-sku={p.sku}
                    onError={handleProductImageError}
                  />
                  <div className="cart-line__info">
                    <p className="cart-line__name">{p.name}</p>
                    <p className="cart-line__price">{formatPrice(p.priceCents)}</p>
                  </div>
                  <div className="cart-line__qty">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => onUpdateQty(item.sku, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => onUpdateQty(item.sku, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <footer className="cart-drawer__foot">
          <div className="cart-totals">
            <div className="review-row">
              <span>Subtotal</span>
              <span id="cart-subtotal">{formatPrice(subtotal)}</span>
            </div>
            <div className="review-row">
              <span>Tax (8%)</span>
              <span id="cart-tax">{formatPrice(tax)}</span>
            </div>
            <div className="review-row review-row--total">
              <span>Total</span>
              <span id="cart-total">{formatPrice(total)}</span>
            </div>
          </div>
          <button type="button" id="btn-checkout" className="btn-primary btn-full" onClick={onCheckout}>
            Checkout →
          </button>
        </footer>
      </aside>
    </>
  );
}
