/**
 * Adversarial test pass (Week 7 deliverable preview)
 * Tests: replay, scope creep, forged approval
 */
import { randomUUID } from 'node:crypto';
import {
  createMandate,
  registerSignerKey,
  type CartMandatePayload,
  type IntentMandatePayload,
  type MandateChain,
  type PaymentMandatePayload,
} from '@pixelium/shared';
import {
  createIntentMandate,
  createPaymentMandate,
  runRealtimePurchase,
  submitPayment,
  validateMandateChain,
} from './broker.js';

interface TestCase {
  name: string;
  run: () => Promise<{ blocked: boolean; detail: string }>;
}

const tests: TestCase[] = [
  {
    name: 'Replay attack — resubmit same payment mandate',
    run: async () => {
      const first = await runRealtimePurchase(
        [{ sku: 'BOOK-AI-AGENTS', quantity: 1 }],
        10000,
        'Buy the agentic systems book'
      );
      if (!first.success || !first.chain) {
        return { blocked: false, detail: 'Setup failed — could not create initial payment' };
      }
      const replay = await submitPayment(first.chain);
      return {
        blocked: !replay.success,
        detail: replay.errors?.join('; ') ?? replay.payment?.message ?? 'unknown',
      };
    },
  },
  {
    name: 'Scope creep — cart exceeds intent price ceiling',
    run: async () => {
      const validUntil = new Date(Date.now() + 3600000).toISOString();
      const intent = createIntentMandate(
        'realtime',
        'Buy expensive phone',
        { maxPriceCents: 5000, validUntil }
      );
      const cartPayload: CartMandatePayload = {
        cartId: randomUUID(),
        merchantId: 'pixelium-merchant',
        merchantName: 'Pixelium Store',
        items: [{ sku: 'PHONE-17-PRO', name: 'PixelPhone 17 Pro', quantity: 1, unitPriceCents: 169999 }],
        subtotalCents: 169999,
        taxCents: 13600,
        totalCents: 183599,
        currency: 'USD',
        intentMandateId: intent.id,
      };
      const cart = createMandate('cart', 'merchant', cartPayload, validUntil, intent.id);
      const payment = createPaymentMandate(intent, cart);
      const validation = validateMandateChain({ intent, cart, payment });
      return {
        blocked: !validation.valid,
        detail: validation.errors.join('; '),
      };
    },
  },
  {
    name: 'Forged approval — tampered payment amount with original signature',
    run: async () => {
      const validUntil = new Date(Date.now() + 3600000).toISOString();
      const intentPayload: IntentMandatePayload = {
        flowMode: 'realtime',
        userId: 'demo-user',
        naturalLanguageIntent: 'Buy headphones',
        conditions: { maxPriceCents: 50000, validUntil },
      };
      const intent = createMandate('intent', 'user', intentPayload, validUntil);
      const cartPayload: CartMandatePayload = {
        cartId: randomUUID(),
        merchantId: 'pixelium-merchant',
        merchantName: 'Pixelium Store',
        items: [{ sku: 'HEADPHONES-NC', name: 'Headphones', quantity: 1, unitPriceCents: 34999 }],
        subtotalCents: 34999,
        taxCents: 2800,
        totalCents: 37799,
        currency: 'USD',
        intentMandateId: intent.id,
      };
      const cart = createMandate('cart', 'merchant', cartPayload, validUntil, intent.id);
      const paymentPayload: PaymentMandatePayload = {
        paymentId: randomUUID(),
        cartMandateId: cart.id,
        intentMandateId: intent.id,
        amountCents: 100,
        currency: 'USD',
        paymentMethod: 'mock_card',
        last4: '4242',
      };
      const payment = createMandate('payment', 'user', paymentPayload, validUntil, cart.id);
      const result = await submitPayment({ intent, cart, payment });
      return {
        blocked: !result.success,
        detail: result.errors?.join('; ') ?? 'passed incorrectly',
      };
    },
  },
  {
    name: 'Forged signature — attacker signs with wrong key',
    run: async () => {
      const validUntil = new Date(Date.now() + 3600000).toISOString();
      const intentPayload: IntentMandatePayload = {
        flowMode: 'realtime',
        userId: 'attacker',
        naturalLanguageIntent: 'Unauthorized purchase',
        conditions: { maxPriceCents: 999999, validUntil },
      };
      registerSignerKey('attacker', 'attacker-secret-not-trusted');
      const intent = createMandate('intent', 'attacker', intentPayload, validUntil);
      const validation = validateMandateChain({
        intent,
        cart: createMandate('cart', 'merchant', {
          cartId: randomUUID(),
          merchantId: 'm',
          merchantName: 'M',
          items: [],
          subtotalCents: 0,
          taxCents: 0,
          totalCents: 0,
          currency: 'USD',
          intentMandateId: intent.id,
        }, validUntil, intent.id),
        payment: createMandate('payment', 'user', {
          paymentId: randomUUID(),
          cartMandateId: 'x',
          intentMandateId: intent.id,
          amountCents: 0,
          currency: 'USD',
          paymentMethod: 'mock_card',
          last4: '0000',
        }, validUntil, 'x'),
      });
      return {
        blocked: !validation.valid,
        detail: validation.errors.join('; '),
      };
    },
  },
];

async function main() {
  console.log('\n=== Adversarial Test Pass ===\n');
  const findings: string[] = [];

  for (const test of tests) {
    const result = await test.run();
    const status = result.blocked ? 'BLOCKED ✓' : 'ALLOWED ✗';
    console.log(`${status}  ${test.name}`);
    console.log(`         ${result.detail}\n`);
    if (!result.blocked) {
      findings.push(`VULNERABILITY: ${test.name} — ${result.detail}`);
    }
  }

  if (findings.length === 0) {
    console.log('All adversarial scenarios were correctly blocked.\n');
  } else {
    console.log('Security findings:');
    findings.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch(console.error);
