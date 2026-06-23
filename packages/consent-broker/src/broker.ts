import { randomUUID } from 'node:crypto';
import { ClientFactory } from '@a2a-js/sdk/client';
import type { Message } from '@a2a-js/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  createMandate,
  validateMandateChain,
  type CartMandate,
  type FlowMode,
  type IntentMandate,
  type IntentMandatePayload,
  type MandateChain,
  type PaymentMandate,
  type PaymentMandatePayload,
  type PaymentResult,
} from '@pixelium/shared';
import { AuditStore } from '@pixelium/audit';

const ECOMMERCE_URL = process.env.ECOMMERCE_URL ?? 'http://localhost:4001';
const PAYMENT_URL = process.env.PAYMENT_URL ?? 'http://localhost:4002';
const DB_PATH = process.env.AUDIT_DB_PATH ?? './data/audit.json';

export const auditStore = new AuditStore(DB_PATH);

async function sendToAgent<T>(baseUrl: string, payload: unknown): Promise<T> {
  const factory = new ClientFactory();
  const client = await factory.createFromUrl(baseUrl);
  const response = await client.sendMessage({
    message: {
      messageId: uuidv4(),
      role: 'user',
      parts: [{ kind: 'text', text: JSON.stringify(payload) }],
      kind: 'message',
    },
  });
  const result = response as Message;
  const text = result.parts.find((p) => p.kind === 'text')?.text ?? '{}';
  return JSON.parse(text) as T;
}

export function createIntentMandate(
  flowMode: FlowMode,
  naturalLanguageIntent: string,
  conditions: IntentMandatePayload['conditions'],
  userId = 'demo-user'
): IntentMandate {
  const expiresAt = conditions.validUntil;
  const payload: IntentMandatePayload = {
    flowMode,
    userId,
    naturalLanguageIntent,
    conditions,
  };
  const mandate = createMandate('intent', 'user', payload, expiresAt);
  auditStore.logEvent('intent_created', { mandateId: mandate.id, flowMode, intent: naturalLanguageIntent }, {
    mandateId: mandate.id,
  });
  return mandate;
}

export async function buildCart(
  intentMandate: IntentMandate,
  items: Array<{ sku: string; quantity: number }>
): Promise<{ cartMandate: CartMandate } | { error: string }> {
  const result = await sendToAgent<{ cartMandate?: CartMandate; error?: string }>(
    ECOMMERCE_URL,
    { action: 'build_cart', intentMandate, items }
  );

  if (result.error || !result.cartMandate) {
    return { error: result.error ?? 'Failed to build cart' };
  }

  auditStore.logEvent(
    'cart_created',
    { mandateId: result.cartMandate.id, totalCents: result.cartMandate.payload.totalCents },
    { mandateId: result.cartMandate.id, orderId: result.cartMandate.payload.cartId }
  );

  return { cartMandate: result.cartMandate };
}

export function createPaymentMandate(
  intentMandate: IntentMandate,
  cartMandate: CartMandate,
  last4 = '4242'
): PaymentMandate {
  const payload: PaymentMandatePayload = {
    paymentId: randomUUID(),
    cartMandateId: cartMandate.id,
    intentMandateId: intentMandate.id,
    amountCents: cartMandate.payload.totalCents,
    currency: 'USD',
    paymentMethod: 'mock_card',
    last4,
  };
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const mandate = createMandate('payment', 'user', payload, expiresAt, cartMandate.id);

  auditStore.logEvent(
    'payment_authorized',
    { mandateId: mandate.id, amountCents: payload.amountCents },
    { mandateId: mandate.id, orderId: payload.paymentId }
  );

  return mandate;
}

export interface BrokerResult {
  success: boolean;
  payment?: PaymentResult;
  chain?: MandateChain;
  errors?: string[];
}

export async function submitPayment(chain: MandateChain): Promise<BrokerResult> {
  const validation = validateMandateChain(chain);

  if (!validation.valid) {
    auditStore.logEvent(
      'broker_blocked',
      { errors: validation.errors, chainIds: [chain.intent.id, chain.cart.id, chain.payment.id] },
      { orderId: chain.payment.payload.paymentId, severity: 'warning' }
    );
    auditStore.upsertOrderFromChain(chain, 'blocked');
    return { success: false, errors: validation.errors };
  }

  auditStore.upsertOrderFromChain(chain, 'pending');

  const paymentResult = await sendToAgent<PaymentResult>(PAYMENT_URL, {
    action: 'process_payment',
    mandateChain: chain,
  });

  if (paymentResult.success) {
    auditStore.markPaymentProcessed(
      chain.payment.payload.paymentId,
      paymentResult.amountCents,
      chain.cart.payload.totalCents
    );
    auditStore.logEvent(
      'payment_processed',
      { transactionId: paymentResult.transactionId, amountCents: paymentResult.amountCents },
      { orderId: chain.payment.payload.paymentId }
    );
  }

  return {
    success: paymentResult.success,
    payment: paymentResult,
    chain,
    errors: paymentResult.success ? undefined : [paymentResult.message],
  };
}

/** Real-time flow: user present, approves cart then payment */
export async function runRealtimePurchase(
  items: Array<{ sku: string; quantity: number }>,
  maxPriceCents: number,
  intentText: string
): Promise<BrokerResult> {
  const validUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const intent = createIntentMandate('realtime', intentText, {
    maxPriceCents,
    validUntil,
  });

  const cartResult = await buildCart(intent, items);
  if ('error' in cartResult) {
    return { success: false, errors: [cartResult.error] };
  }

  const payment = createPaymentMandate(intent, cartResult.cartMandate);
  const chain: MandateChain = {
    intent,
    cart: cartResult.cartMandate,
    payment,
  };

  return submitPayment(chain);
}

/** Delegated flow: pre-signed intent with conditions, agent executes when met */
export async function runDelegatedPurchase(
  items: Array<{ sku: string; quantity: number }>,
  conditions: IntentMandatePayload['conditions'],
  intentText: string
): Promise<BrokerResult> {
  const intent = createIntentMandate('delegated', intentText, conditions);

  const cartResult = await buildCart(intent, items);
  if ('error' in cartResult) {
    return { success: false, errors: [cartResult.error] };
  }

  const payment = createPaymentMandate(intent, cartResult.cartMandate);
  const chain: MandateChain = {
    intent,
    cart: cartResult.cartMandate,
    payment,
  };

  return submitPayment(chain);
}

export { validateMandateChain };
