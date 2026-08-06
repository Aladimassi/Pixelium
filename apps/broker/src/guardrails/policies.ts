/** Guardrail policy constants — single source of truth for encadrant demo. */

export const MAX_INPUT_LENGTH = 2000;
export const MAX_ADVICE_PICKS = 3;
export const MAX_SEARCH_TOKENS = 12;

/** Tier 1 — block prompt injection and payment bypass attempts. */
export const INPUT_BLOCK_PATTERNS: Array<{ id: string; pattern: RegExp; message: string }> = [
  {
    id: 'prompt_injection',
    pattern:
      /\b(ignore (all )?(previous|prior|above) instructions|disregard (your )?rules|forget (your )?(all )?(previous|prior) instructions|override (the )?(system )?prompt|new instructions|you are now|pretend (you are|to be)|act as|jailbreak|dan mode|reveal (your )?(system )?(prompt|instructions|secrets)|show (me )?(the )?(env|environment|api keys?))\b/i,
    message: 'Prompt injection patterns are not allowed.',
  },
  {
    id: 'payment_bypass',
    pattern:
      /\b(charge (my )?card|pay now|process payment|submit payment|bypass (the )?broker|without (my )?approval|skip consent)\b/i,
    message: 'Direct payment commands must go through checkout and consent review.',
  },
  {
    id: 'sql_injection',
    pattern:
      /(\bUNION\b.+\bSELECT\b|;\s*DROP\b|'\s*OR\s+'1'\s*=\s*'1'|(?:^|[;\s])--\s*(?:DROP|DELETE|INSERT|UPDATE|SELECT|UNION))/i,
    message: 'Invalid search characters detected.',
  },
];

/** Tier 2 — LLM output must not promise autonomous payment. */
export const OUTPUT_BLOCK_PATTERNS: Array<{ id: string; pattern: RegExp; message: string }> = [
  {
    id: 'autonomous_payment_promise',
    pattern: /\b(i (have |'ve )?(charged|paid|purchased|ordered) (it|this|for you)|payment (is )?complete|transaction approved)\b/i,
    message: 'Assistant cannot claim a payment was executed.',
  },
];

export const GUARDRAIL_TIERS = ['input', 'output', 'action'] as const;
export type GuardrailTier = (typeof GUARDRAIL_TIERS)[number];
