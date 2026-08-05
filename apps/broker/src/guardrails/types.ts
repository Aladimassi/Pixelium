import type { GuardrailTier } from './policies.js';

export interface GuardrailResult {
  allowed: boolean;
  tier: GuardrailTier;
  rule: string;
  message: string;
}

export interface AdvicePick {
  sku: string;
  priceCents?: number;
}
