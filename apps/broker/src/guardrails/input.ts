import { INPUT_BLOCK_PATTERNS, MAX_INPUT_LENGTH } from './policies.js';
import type { GuardrailResult } from './types.js';

function block(tier: 'input', rule: string, message: string): GuardrailResult {
  return { allowed: false, tier, rule, message };
}

function allow(): GuardrailResult {
  return { allowed: true, tier: 'input', rule: 'ok', message: '' };
}

/** Tier 1 — validate user message before AI / search. */
export function guardInput(message: string): GuardrailResult {
  const text = message.trim();

  if (!text) {
    return block('input', 'empty_message', 'Message cannot be empty.');
  }

  if (text.length > MAX_INPUT_LENGTH) {
    return block('input', 'message_too_long', `Message exceeds ${MAX_INPUT_LENGTH} characters.`);
  }

  for (const { id, pattern, message } of INPUT_BLOCK_PATTERNS) {
    if (pattern.test(text)) {
      return block('input', id, message);
    }
  }

  return allow();
}
