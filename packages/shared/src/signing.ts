import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  CartMandatePayload,
  IntentMandatePayload,
  MandateEnvelope,
  MandateType,
  PaymentMandatePayload,
} from './types.js';

export const DEMO_KEYS = {
  user: 'pixelium-demo-user-key',
  merchant: 'pixelium-demo-merchant-key',
  broker: 'pixelium-demo-broker-key',
  payment: 'pixelium-demo-payment-key',
} as const;

export type SignerRole = keyof typeof DEMO_KEYS;

const KEY_BY_SIGNER: Record<string, string> = {
  user: DEMO_KEYS.user,
  merchant: DEMO_KEYS.merchant,
  broker: DEMO_KEYS.broker,
  payment_agent: DEMO_KEYS.payment,
};

export function registerSignerKey(signerId: string, secret: string): void {
  KEY_BY_SIGNER[signerId] = secret;
}

function canonicalPayload(payload: unknown): string {
  return JSON.stringify(payload, Object.keys(payload as object).sort());
}

export function signPayload(
  signerId: string,
  type: MandateType,
  payload: IntentMandatePayload | CartMandatePayload | PaymentMandatePayload,
  parentMandateId?: string
): string {
  const secret = KEY_BY_SIGNER[signerId];
  if (!secret) {
    throw new Error(`Unknown signer: ${signerId}`);
  }
  const body = `${type}|${signerId}|${parentMandateId ?? ''}|${canonicalPayload(payload)}`;
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifySignature(mandate: MandateEnvelope<unknown>): boolean {
  const expected = signPayload(
    mandate.signerId,
    mandate.type,
    mandate.payload as IntentMandatePayload | CartMandatePayload | PaymentMandatePayload,
    mandate.parentMandateId
  );
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(mandate.signature, 'hex')
    );
  } catch {
    return false;
  }
}

export function createMandate<T>(
  type: MandateType,
  signerId: string,
  payload: T,
  expiresAt: string,
  parentMandateId?: string
): MandateEnvelope<T> {
  const mandate: MandateEnvelope<T> = {
    id: randomUUID(),
    type,
    version: '1.0',
    createdAt: new Date().toISOString(),
    expiresAt,
    payload,
    signerId,
    signature: '',
    parentMandateId,
  };
  mandate.signature = signPayload(
    signerId,
    type,
    payload as IntentMandatePayload | CartMandatePayload | PaymentMandatePayload,
    parentMandateId
  );
  return mandate;
}

export function isExpired(mandate: MandateEnvelope<unknown>): boolean {
  return new Date(mandate.expiresAt).getTime() <= Date.now();
}
