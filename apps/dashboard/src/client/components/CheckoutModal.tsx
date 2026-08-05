import type { SavedCard } from '../lib/payment';
import { formatPrice, handleProductImageError, productImageUrl, type Product } from '../lib/cart';
import { cardDisplayLine } from '../lib/payment';
import { SavedCardView } from './SavedCardView';
import { useDialog } from '../hooks/useDialog';

type CheckoutStep = 'review' | 'processing' | 'success';

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
  mandateId?: string;
  totalCents?: number;
  statusMessage?: string;
  savedCard: SavedCard | null;
  successAmount?: string;
  successTxn?: string;
  successItems?: PaidItem[];
  productsBySku?: Record<string, Product>;
  successMethod?: string;
  processingMessage: string;
  canPay: boolean;
  onClose: () => void;
  onReject: () => void;
  onConfirmPay: () => void;
  onEditCard: () => void;
}

export function CheckoutModal({
  open,
  step,
  reviewHtml,
  mandateId,
  totalCents,
  statusMessage,
  savedCard,
  successAmount,
  successTxn,
  successItems = [],
  productsBySku = {},
  successMethod,
  processingMessage,
  canPay,
  onClose,
  onReject,
  onConfirmPay,
  onEditCard,
}: CheckoutModalProps) {
  const dialogRef = useDialog(open);

  return (
    <>
      <div
        id="checkout-overlay"
        className={`overlay${open ? '' : ' hidden'}`}
        onClick={onClose}
      />
      <dialog ref={dialogRef} id="checkout-modal" className="checkout-modal pay-modal">
        <button type="button" id="btn-close-checkout" className="modal-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>

        <div id="checkout-panel-review" className={`checkout-panel${step === 'review' ? '' : ' hidden'}`}>
          <p className="consent-label">Checkout</p>
          <h2>Review &amp; pay</h2>
          <div id="checkout-steps" className="pay-steps">
            <span className="pay-step active">Review</span>
            <span className="pay-step">Pay</span>
            <span className="pay-step">Done</span>
          </div>
          <div id="checkout-review">{reviewHtml}</div>
          <p id="checkout-mandate-id" className="mandate-id">
            {mandateId ? `Cart mandate ${mandateId.slice(0, 8)}…` : ''}
          </p>
          <p className="section-header__eyebrow" style={{ marginTop: '1.25rem' }}>
            Saved payment
          </p>
          <div id="checkout-saved-card">
            {savedCard ? (
              <SavedCardView card={savedCard} linkProfile onEditCard={onEditCard} />
            ) : (
              <div className="checkout-no-card">
                <p className="hint">No payment card on file. Add your own card — each account has its own.</p>
                <button type="button" className="btn-secondary btn-sm" onClick={onEditCard}>
                  Add payment card →
                </button>
              </div>
            )}
          </div>
          <p id="pay-total-label" className="pay-total-label">
            {totalCents ? `Total due: ${formatPrice(totalCents)}` : ''}
          </p>
          {statusMessage ? (
            <p id="checkout-status" className="checkout-status" aria-live="polite">
              {statusMessage}
            </p>
          ) : (
            <p id="checkout-status" className="checkout-status hidden" aria-live="polite" />
          )}
          <div className="consent-actions">
            <button
              type="button"
              id="btn-confirm-pay"
              className="btn-primary btn-full"
              disabled={!canPay}
              onClick={onConfirmPay}
            >
              Pay now →
            </button>
            <button type="button" id="btn-reject-checkout" className="btn-secondary reject" onClick={onReject}>
              Reject
            </button>
            <button type="button" id="btn-cancel-checkout" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>

        <div id="checkout-panel-processing" className={`checkout-panel${step === 'processing' ? '' : ' hidden'}`}>
          <div className="pay-processing">
            <div className="pay-spinner" aria-hidden="true" />
            <p className="consent-label">Processing</p>
            <h2>Authorizing payment</h2>
            <p id="processing-message" className="hint">
              {processingMessage}
            </p>
          </div>
        </div>

        <div id="checkout-panel-success" className={`checkout-panel${step === 'success' ? '' : ' hidden'}`}>
          <div className="pay-success">
            <p className="pay-success__mark">✓</p>
            <p className="consent-label">Payment complete</p>
            <h2>Thank you</h2>
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
            <p id="success-amount" className="pay-total-label">
              {successAmount}
            </p>
            <p id="success-txn" className="mandate-id">
              {successTxn}
            </p>
            <p id="success-method" className="hint">
              {successMethod ?? (savedCard ? cardDisplayLine(savedCard) : 'Card on file')}
            </p>
            <button type="button" id="btn-done-checkout" className="btn-primary btn-full" onClick={onClose}>
              Continue shopping →
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
