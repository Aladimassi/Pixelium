import { validateMandateChain, type MandateChain } from '@pixelium/shared';
import type { GuardrailResult } from './types.js';

function block(rule: string, message: string): GuardrailResult {
  return { allowed: false, tier: 'action', rule, message };
}

function allow(): GuardrailResult {
  return { allowed: true, tier: 'action', rule: 'ok', message: '' };
}

/** Tier 3 — validate mandate chain before payment agent (extends existing validation). */
export function guardPaymentAction(chain: MandateChain): GuardrailResult {
  if (chain.cart.payload.items.length === 0) {
    return block('empty_cart', 'Cart must contain at least one item.');
  }

  const amount = chain.payment.payload.amountCents;
  if (amount <= 0) {
    return block('zero_amount', 'Payment amount must be positive.');
  }

  if (amount !== chain.cart.payload.totalCents) {
    return block('amount_mismatch', 'Payment amount must match cart total.');
  }

  const validation = validateMandateChain(chain);
  if (!validation.valid) {
    return block('mandate_chain_invalid', validation.errors.join('; '));
  }

  return allow();
}
