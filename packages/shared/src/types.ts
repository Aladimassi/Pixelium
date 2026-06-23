export type MandateType = 'intent' | 'cart' | 'payment';

export type FlowMode = 'realtime' | 'delegated';

export interface MandateEnvelope<T> {
  id: string;
  type: MandateType;
  version: '1.0';
  createdAt: string;
  expiresAt: string;
  payload: T;
  signerId: string;
  signature: string;
  /** Links mandates in a chain (intent → cart → payment) */
  parentMandateId?: string;
}

export interface IntentConditions {
  maxPriceCents: number;
  allowedSkus?: string[];
  allowedCategories?: string[];
  /** ISO timestamp — purchase must complete before this time */
  validUntil: string;
  /** ISO timestamp — earliest time agent may execute (delegated flow) */
  validFrom?: string;
  requiresRefundable?: boolean;
}

export interface IntentMandatePayload {
  flowMode: FlowMode;
  userId: string;
  naturalLanguageIntent: string;
  conditions: IntentConditions;
}

export interface CartLineItem {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CartMandatePayload {
  cartId: string;
  merchantId: string;
  merchantName: string;
  items: CartLineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: 'USD';
  intentMandateId: string;
}

export interface PaymentMandatePayload {
  paymentId: string;
  cartMandateId: string;
  intentMandateId: string;
  amountCents: number;
  currency: 'USD';
  paymentMethod: 'mock_card';
  last4: string;
}

export type IntentMandate = MandateEnvelope<IntentMandatePayload>;
export type CartMandate = MandateEnvelope<CartMandatePayload>;
export type PaymentMandate = MandateEnvelope<PaymentMandatePayload>;

export interface MandateChain {
  intent: IntentMandate;
  cart: CartMandate;
  payment: PaymentMandate;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amountCents: number;
  timestamp: string;
  message: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  eventType:
    | 'intent_created'
    | 'cart_created'
    | 'payment_authorized'
    | 'payment_processed'
    | 'broker_blocked'
    | 'reconciliation_mismatch';
  orderId?: string;
  mandateId?: string;
  details: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error';
}
