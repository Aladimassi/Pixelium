import { useEffect, useState } from 'react';
import type { SavedCard } from '../lib/payment';
import { formatPrice, handleProductImageError, productImageUrl, type Product } from '../lib/cart';
import { cardDisplayLine } from '../lib/payment';
import {
  DELIVERY_OPTIONS,
  type DeliveryOption,
  type ShippingAddress,
  emptyShippingAddress,
  isShippingComplete,
  shippingCostCents,
} from '../lib/shipping';
import { ShippingAddressFields } from './ShippingAddressFields';
import { SavedCardView } from './SavedCardView';
import { useDialog } from '../hooks/useDialog';

type CheckoutStep = 'shipping' | 'review' | 'processing' | 'success';

type PaidItem = {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

interface CheckoutModalProps {
  open: boolean;
  step: CheckoutStep;
  reviewHtml?: React.ReactNode;
  totalCents?: number;
  subtotalCents?: number;
  shippingCents?: number;
  statusMessage?: string;
  savedCard: SavedCard | null;
  shippingAddress: ShippingAddress;
  deliveryOption: DeliveryOption;
  displayName?: string;
  successAmount?: string;
  successTxn?: string;
  successOrderId?: string;
  successDelivery?: string;
  successItems?: PaidItem[];
  productsBySku?: Record<string, Product>;
  successMethod?: string;
  processingMessage: string;
  canPay: boolean;
  onClose: () => void;
  onReject: () => void;
  onConfirmPay: () => void;
  onEditCard: () => void;
  onShippingChange: (addr: ShippingAddress) => void;
  onDeliveryChange: (option: DeliveryOption) => void;
  onContinueToReview: () => void;
  onEditDelivery?: () => void;
}

export function CheckoutModal({
  open,
  step,
  reviewHtml,
  totalCents,
  subtotalCents = 0,
  shippingCents = 0,
  statusMessage,
  savedCard,
  shippingAddress,
  deliveryOption,
  displayName = '',
  successAmount,
  successTxn,
  successOrderId,
  successDelivery,
  successItems = [],
  productsBySku = {},
  successMethod,
  processingMessage,
  canPay,
  onClose,
  onReject,
  onConfirmPay,
  onEditCard,
  onShippingChange,
  onDeliveryChange,
  onContinueToReview,
  onEditDelivery,
}: CheckoutModalProps) {
  const dialogRef = useDialog(open);
  const [localAddr, setLocalAddr] = useState(shippingAddress);

  useEffect(() => {
    if (open) {
      setLocalAddr(shippingAddress.fullName ? shippingAddress : emptyShippingAddress(displayName));
    }
  }, [open, shippingAddress, displayName]);

  const previewShipping = shippingCostCents(subtotalCents, deliveryOption);
  const shippingReady = isShippingComplete(localAddr);
  const usingSavedAddress = shippingReady && isShippingComplete(shippingAddress);

  const updateAddr = (patch: Partial<ShippingAddress>) => {
    const next = { ...localAddr, ...patch };
    setLocalAddr(next);
    onShippingChange(next);
  };

  return (
    <>
      <div id="checkout-overlay" className={`overlay${open ? '' : ' hidden'}`} onClick={onClose} />
      <dialog ref={dialogRef} id="checkout-modal" className="checkout-modal pay-modal">
        <button type="button" id="btn-close-checkout" className="modal-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>

        <div className={`checkout-panel${step === 'shipping' ? '' : ' hidden'}`}>
          <p className="consent-label">Checkout</p>
          <h2>Delivery</h2>
          <div className="pay-steps">
            <span className="pay-step active">Delivery</span>
            <span className="pay-step">Review</span>
            <span className="pay-step">Pay</span>
          </div>
          <form
            className="shipping-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (shippingReady) onContinueToReview();
            }}
          >
            {usingSavedAddress ? (
              <p className="saved-address-banner" role="status">
                Using your saved delivery address —{' '}
                {onEditDelivery ? (
                  <button type="button" className="btn-link" onClick={onEditDelivery}>
                    edit in Profile
                  </button>
                ) : (
                  'you can update it below'
                )}
              </p>
            ) : (
              <p className="hint profile-field-hint">
                Save your address in Profile → Delivery for faster checkout next time.
              </p>
            )}
            <ShippingAddressFields address={localAddr} onChange={updateAddr} idPrefix="ship" />
            <fieldset className="delivery-options">
              <legend className="section-header__eyebrow">Delivery method</legend>
              {DELIVERY_OPTIONS.map((opt) => {
                const cents = shippingCostCents(subtotalCents, opt.id);
                return (
                  <label key={opt.id} className={`delivery-option${deliveryOption === opt.id ? ' delivery-option--active' : ''}`}>
                    <input
                      type="radio"
                      name="delivery"
                      checked={deliveryOption === opt.id}
                      onChange={() => onDeliveryChange(opt.id)}
                    />
                    <span>
                      <strong>{opt.label}</strong>
                      <small>{opt.eta}</small>
                    </span>
                    <span className="delivery-option__price">{cents === 0 ? 'Free' : formatPrice(cents)}</span>
                  </label>
                );
              })}
            </fieldset>
            <button type="submit" className="btn-primary btn-full" disabled={!shippingReady}>
              Continue to review →
            </button>
          </form>
        </div>

        <div className={`checkout-panel${step === 'review' ? '' : ' hidden'}`}>
          <p className="consent-label">Checkout</p>
          <h2>Review &amp; pay</h2>
          <div className="pay-steps">
            <span className="pay-step done">Delivery</span>
            <span className="pay-step active">Review</span>
            <span className="pay-step">Pay</span>
          </div>
          <div id="checkout-review">{reviewHtml}</div>
          <p className="section-header__eyebrow" style={{ marginTop: '1.25rem' }}>
            Payment method
          </p>
          <div id="checkout-saved-card">
            {savedCard ? (
              <SavedCardView card={savedCard} linkProfile onEditCard={onEditCard} />
            ) : (
              <div className="checkout-no-card">
                <p className="hint">Add a payment card in your profile before paying.</p>
                <button type="button" className="btn-secondary btn-sm" onClick={onEditCard}>
                  Add payment card →
                </button>
              </div>
            )}
          </div>
          <p className="pay-total-label">
            {totalCents != null ? `Total due: ${formatPrice(totalCents)}` : ''}
          </p>
          {statusMessage ? <p className="checkout-status">{statusMessage}</p> : null}
          <div className="consent-actions">
            <button type="button" className="btn-primary btn-full" disabled={!canPay} onClick={onConfirmPay}>
              Pay now →
            </button>
            <button type="button" className="btn-secondary reject" onClick={onReject}>
              Cancel order
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className={`checkout-panel${step === 'processing' ? '' : ' hidden'}`}>
          <div className="pay-processing">
            <div className="pay-spinner" aria-hidden="true" />
            <p className="consent-label">Processing</p>
            <h2>Authorizing payment</h2>
            <p className="hint">{processingMessage}</p>
          </div>
        </div>

        <div className={`checkout-panel${step === 'success' ? '' : ' hidden'}`}>
          <div className="pay-success">
            <p className="pay-success__mark">✓</p>
            <p className="consent-label">Order confirmed</p>
            <h2>Thank you for your order</h2>
            {successOrderId ? <p className="order-id-badge">Order {successOrderId}</p> : null}
            {successDelivery ? <p className="hint pay-success__delivery">{successDelivery}</p> : null}
            {successItems.length > 0 ? (
              <div className="pay-success__items">
                {successItems.map((item) => {
                  const product =
                    productsBySku[item.sku] ??
                    ({
                      sku: item.sku,
                      name: item.name,
                      category: '',
                      priceCents: item.unitPriceCents,
                      inStock: 0,
                    } satisfies Product);
                  return (
                    <div className="review-line review-line--compact" key={item.sku}>
                      <img
                        className="review-line__thumb"
                        src={productImageUrl(product)}
                        alt=""
                        loading="lazy"
                        data-sku={item.sku}
                        onError={handleProductImageError}
                      />
                      <div className="review-line__info">
                        <span className="review-line__name">
                          {item.quantity}× {item.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className="pay-total-label">{successAmount}</p>
            <p className="mandate-id">{successTxn}</p>
            <p className="hint">{successMethod ?? (savedCard ? cardDisplayLine(savedCard) : '')}</p>
            <p className="hint">Estimated delivery in 3–5 business days.</p>
            <button type="button" className="btn-primary btn-full" onClick={onClose}>
              Continue shopping →
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
