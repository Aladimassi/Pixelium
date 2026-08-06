import { randomUUID } from 'node:crypto';
import {
  computeTax,
  createMandate,
  getProduct,
  validateMandateChain,
  cartChargeTotalCents,
  type CartLineItem,
  type CartMandate,
  type CartMandatePayload,
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
  const res = await fetch(`${baseUrl}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Agent ${baseUrl} returned ${res.status}`);
  }
  return (await res.json()) as T;
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

type EnrichedCartItem = {
  sku: string;
  quantity: number;
  name?: string;
  unitPriceCents?: number;
  inStock?: number;
};

function buildCartLocally(
  intentMandate: IntentMandate,
  items: EnrichedCartItem[]
): { cartMandate: CartMandate } | { error: string } {
  const lineItems: CartLineItem[] = [];
  let subtotalCents = 0;

  for (const item of items) {
    const product = getProduct(item.sku);
    const name = item.name ?? product?.name;
    const unitPriceCents = item.unitPriceCents ?? product?.priceCents;
    const inStock = item.inStock ?? product?.inStock ?? 0;

    if (!name || unitPriceCents == null) {
      return { error: `Unknown SKU: ${item.sku}` };
    }
    if (inStock < item.quantity) {
      return { error: `Insufficient stock for ${name}` };
    }

    lineItems.push({ sku: item.sku, name, quantity: item.quantity, unitPriceCents });
    subtotalCents += unitPriceCents * item.quantity;
  }

  const taxCents = computeTax(subtotalCents);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const cartMandate = createMandate(
    'cart',
    'merchant',
    {
      cartId: randomUUID(),
      merchantId: 'pixelium-merchant',
      merchantName: 'Pixelium Store',
      items: lineItems,
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents,
      currency: 'USD' as const,
      intentMandateId: intentMandate.id,
    },
    expiresAt,
    intentMandate.id
  );

  return { cartMandate: cartMandate as CartMandate };
}

/** Attach shipping to a signed cart mandate (re-signs with updated payload). */
export function applyShippingToCart(cartMandate: CartMandate, shippingCents: number): CartMandate {
  const normalized = Math.max(0, Math.round(shippingCents));
  if ((cartMandate.payload.shippingCents ?? 0) === normalized) {
    return cartMandate;
  }
  const payload: CartMandatePayload = {
    ...cartMandate.payload,
    shippingCents: normalized,
  };
  return createMandate(
    'cart',
    cartMandate.signerId,
    payload,
    cartMandate.expiresAt,
    cartMandate.parentMandateId,
  ) as CartMandate;
}

function rebindCartToIntent(cartMandate: CartMandate, intentMandate: IntentMandate): CartMandate {
  const payload: CartMandatePayload = {
    ...cartMandate.payload,
    intentMandateId: intentMandate.id,
  };
  return createMandate(
    'cart',
    cartMandate.signerId,
    payload,
    cartMandate.expiresAt,
    intentMandate.id,
  ) as CartMandate;
}

/** Apply shipping and raise intent ceiling when needed before payment. */
export function preparePaymentChain(
  intentMandate: IntentMandate,
  cartMandate: CartMandate,
  shippingCents: number,
  last4 = '4242',
): { intent: IntentMandate; cart: CartMandate; payment: PaymentMandate } {
  let intent = intentMandate;
  let cart =
    shippingCents > 0 ? applyShippingToCart(cartMandate, shippingCents) : cartMandate;
  const chargeTotal = cartChargeTotalCents(cart);

  if (chargeTotal > intent.payload.conditions.maxPriceCents) {
    intent = createIntentMandate(
      intent.payload.flowMode,
      intent.payload.naturalLanguageIntent,
      { ...intent.payload.conditions, maxPriceCents: chargeTotal },
      intent.payload.userId,
    );
    cart = rebindCartToIntent(cart, intent);
  }

  const payment = createPaymentMandate(intent, cart, last4);
  return { intent, cart, payment };
}

export async function buildCart(
  intentMandate: IntentMandate,
  items: Array<{ sku: string; quantity: number }>
): Promise<
  | { cartMandate: CartMandate; agentThinking?: string; agentWarnings?: string[] }
  | { error: string }
> {
  // Broker already validated SKUs against MySQL — pass snapshots so the Python
  // agent does not need its own catalog in sync (avoids "Unknown SKU" on AMZ-* etc.)
  const enrichedItems: EnrichedCartItem[] = items.map((item) => {
    const product = getProduct(item.sku);
    if (!product) return item;
    return {
      ...item,
      name: product.name,
      unitPriceCents: product.priceCents,
      inStock: product.inStock,
    };
  });

  let cartMandate: CartMandate | undefined;
  let agentError: string | undefined;
  let agentThinking: string | undefined;
  let agentWarnings: string[] | undefined;

  try {
    const raw = await sendToAgent<Record<string, unknown>>(ECOMMERCE_URL, {
      action: 'build_cart',
      intentMandate,
      items: enrichedItems,
    });
    cartMandate = (raw.cartMandate ?? raw.cart_mandate) as CartMandate | undefined;
    agentError = typeof raw.error === 'string' ? raw.error : undefined;
    agentThinking = typeof raw.thinking === 'string' ? raw.thinking : undefined;
    if (Array.isArray(raw.warnings)) {
      agentWarnings = raw.warnings.filter((w): w is string => typeof w === 'string');
    }
  } catch (err) {
    console.warn(
      '[broker] Product agent unavailable, building cart locally:',
      err instanceof Error ? err.message : err
    );
    const local = buildCartLocally(intentMandate, enrichedItems);
    if ('error' in local) return local;
    cartMandate = local.cartMandate;
  }

  if (agentError || !cartMandate) {
    const local = buildCartLocally(intentMandate, enrichedItems);
    if ('error' in local) {
      return { error: agentError ?? local.error ?? 'Failed to build cart' };
    }
    cartMandate = local.cartMandate;
  }

  auditStore.logEvent(
    'cart_created',
    { mandateId: cartMandate.id, totalCents: cartMandate.payload.totalCents },
    { mandateId: cartMandate.id, orderId: cartMandate.payload.cartId }
  );

  return { cartMandate, agentThinking, agentWarnings };
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
    amountCents: cartChargeTotalCents(cartMandate),
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
  agentThinking?: string;
  agentRiskNotes?: string[];
}

export async function submitPayment(chain: MandateChain): Promise<BrokerResult> {
  const { guardPaymentAction } = await import('./guardrails/index.js');
  const guard = guardPaymentAction(chain);

  if (!guard.allowed) {
    auditStore.logEvent(
      'broker_blocked',
      {
        guardrail: true,
        tier: guard.tier,
        rule: guard.rule,
        message: guard.message,
        chainIds: [chain.intent.id, chain.cart.id, chain.payment.id],
      },
      { orderId: chain.payment.payload.paymentId, severity: 'warning' }
    );
    auditStore.upsertOrderFromChain(chain, 'blocked');
    return { success: false, errors: [guard.message] };
  }

  auditStore.upsertOrderFromChain(chain, 'pending');

  const raw = await sendToAgent<Record<string, unknown>>(PAYMENT_URL, {
    action: 'process_payment',
    mandateChain: chain,
  });

  const paymentResult: PaymentResult = {
    success: Boolean(raw.success),
    transactionId: String(raw.transactionId ?? raw.transaction_id ?? ''),
    amountCents: Number(raw.amountCents ?? chain.payment.payload.amountCents),
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    message: String(raw.message ?? raw.explanation ?? 'Payment failed'),
  };

  const agentThinking = typeof raw.thinking === 'string' ? raw.thinking : undefined;
  const agentRiskNotes = Array.isArray(raw.riskNotes)
    ? raw.riskNotes.filter((n): n is string => typeof n === 'string')
    : Array.isArray(raw.risk_notes)
      ? raw.risk_notes.filter((n): n is string => typeof n === 'string')
      : undefined;

  if (paymentResult.success) {
    auditStore.markPaymentProcessed(
      chain.payment.payload.paymentId,
      paymentResult.amountCents,
      cartChargeTotalCents(chain.cart)
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
    agentThinking,
    agentRiskNotes,
  };
}

/** Real-time flow: user present, approves cart then payment */
export async function runRealtimePurchase(
  items: Array<{ sku: string; quantity: number }>,
  maxPriceCents: number,
  intentText: string,
  userId?: string
): Promise<BrokerResult> {
  const validUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const intent = createIntentMandate('realtime', intentText, {
    maxPriceCents,
    validUntil,
  }, userId);

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
  intentText: string,
  userId?: string
): Promise<BrokerResult> {
  const intent = createIntentMandate('delegated', intentText, conditions, userId);

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
