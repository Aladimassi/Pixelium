import type {
  CartMandate,
  CartMandatePayload,
  IntentMandate,
  IntentMandatePayload,
  MandateChain,
  PaymentMandate,
  PaymentMandatePayload,
} from './types.js';
import { isExpired, verifySignature } from './signing.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateIntentAgainstConditions(
  intent: IntentMandate,
  cartTotalCents: number,
  skus: string[]
): ValidationResult {
  const errors: string[] = [];
  const { conditions } = intent.payload;

  if (cartTotalCents > conditions.maxPriceCents) {
    errors.push(
      `Cart total ${cartTotalCents} exceeds max price ${conditions.maxPriceCents}`
    );
  }

  if (conditions.allowedSkus?.length) {
    for (const sku of skus) {
      if (!conditions.allowedSkus.includes(sku)) {
        errors.push(`SKU ${sku} not in allowed list`);
      }
    }
  }

  if (conditions.validFrom && new Date(conditions.validFrom).getTime() > Date.now()) {
    errors.push('Intent validFrom is in the future');
  }

  if (new Date(conditions.validUntil).getTime() < Date.now()) {
    errors.push('Intent conditions have expired');
  }

  return { valid: errors.length === 0, errors };
}

export function validateMandateChain(chain: MandateChain): ValidationResult {
  const errors: string[] = [];
  const { intent, cart, payment } = chain;

  for (const mandate of [intent, cart, payment]) {
    if (!verifySignature(mandate)) {
      errors.push(`Invalid signature on ${mandate.type} mandate ${mandate.id}`);
    }
    if (isExpired(mandate)) {
      errors.push(`Expired ${mandate.type} mandate ${mandate.id}`);
    }
  }

  if (cart.parentMandateId !== intent.id) {
    errors.push('Cart mandate parent does not match intent mandate id');
  }
  if (payment.parentMandateId !== cart.id) {
    errors.push('Payment mandate parent does not match cart mandate id');
  }
  if (cart.payload.intentMandateId !== intent.id) {
    errors.push('Cart payload intentMandateId mismatch');
  }
  if (payment.payload.cartMandateId !== cart.id) {
    errors.push('Payment payload cartMandateId mismatch');
  }
  if (payment.payload.intentMandateId !== intent.id) {
    errors.push('Payment payload intentMandateId mismatch');
  }
  if (payment.payload.amountCents !== cart.payload.totalCents) {
    errors.push(
      `Payment amount ${payment.payload.amountCents} does not match cart total ${cart.payload.totalCents}`
    );
  }

  const skuList = cart.payload.items.map((i) => i.sku);
  const conditionCheck = validateIntentAgainstConditions(
    intent,
    cart.payload.totalCents,
    skuList
  );
  errors.push(...conditionCheck.errors);

  return { valid: errors.length === 0, errors };
}

export function summarizeChain(chain: MandateChain): string {
  const items = chain.cart.payload.items
    .map((i) => `${i.quantity}x ${i.name}`)
    .join(', ');
  return [
    `Intent (${chain.intent.payload.flowMode}): ${chain.intent.payload.naturalLanguageIntent}`,
    `Cart: ${items} — $${(chain.cart.payload.totalCents / 100).toFixed(2)}`,
    `Payment: $${(chain.payment.payload.amountCents / 100).toFixed(2)} via ****${chain.payment.payload.last4}`,
  ].join('\n');
}

export type {
  CartMandate,
  CartMandatePayload,
  IntentMandate,
  IntentMandatePayload,
  PaymentMandate,
  PaymentMandatePayload,
};
