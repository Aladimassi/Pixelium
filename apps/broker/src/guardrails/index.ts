import { INPUT_BLOCK_PATTERNS } from './policies.js';

export { guardInput } from './input.js';
export { guardAdviceOutput, guardParsedSku } from './output.js';
export { guardPaymentAction } from './actions.js';
export {
  GUARDRAIL_TIERS,
  INPUT_BLOCK_PATTERNS,
  OUTPUT_BLOCK_PATTERNS,
  MAX_INPUT_LENGTH,
  MAX_ADVICE_PICKS,
  type GuardrailTier,
} from './policies.js';
export type { GuardrailResult, AdvicePick } from './types.js';

export function listGuardrailPolicies() {
  return {
    tiers: [
      {
        id: 'input',
        description: 'Validate user messages before AI or search',
        rules: [
          'empty_message',
          'message_too_long',
          ...INPUT_BLOCK_PATTERNS.map((p) => p.id),
        ],
      },
      {
        id: 'output',
        description: 'Validate LLM advice and parsed intents',
        rules: [
          'hallucinated_sku',
          'too_many_picks',
          'budget_exceeded',
          'autonomous_payment_promise',
          'unknown_parsed_sku',
        ],
      },
      {
        id: 'action',
        description: 'Validate mandate chain before payment',
        rules: [
          'mandate_chain_invalid',
          'zero_amount',
          'empty_cart',
          'amount_mismatch',
        ],
      },
    ],
  };
}
