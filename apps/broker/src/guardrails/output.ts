import { extractBudgetCents } from '../rag/budget.js';
import { MAX_ADVICE_PICKS, OUTPUT_BLOCK_PATTERNS } from './policies.js';
import type { AdvicePick, GuardrailResult } from './types.js';

function block(rule: string, message: string): GuardrailResult {
  return { allowed: false, tier: 'output', rule, message };
}

function allow(): GuardrailResult {
  return { allowed: true, tier: 'output', rule: 'ok', message: '' };
}

/** Tier 2 — validate RAG / LLM advice before returning to user. */
export function guardAdviceOutput(
  userMessage: string,
  reply: string,
  picks: AdvicePick[],
  allowedSkus: Set<string>
): GuardrailResult {
  for (const { id, pattern, message } of OUTPUT_BLOCK_PATTERNS) {
    if (pattern.test(reply)) {
      return block(id, message);
    }
  }

  if (picks.length > MAX_ADVICE_PICKS) {
    return block('too_many_picks', `At most ${MAX_ADVICE_PICKS} product picks allowed.`);
  }

  for (const pick of picks) {
    if (!pick.sku?.trim()) {
      return block('missing_sku', 'Every pick must include a catalog SKU.');
    }
    if (!allowedSkus.has(pick.sku)) {
      return block('hallucinated_sku', `SKU "${pick.sku}" is not in retrieved catalog context.`);
    }
  }

  const { cents, explicit } = extractBudgetCents(userMessage);
  if (explicit) {
    for (const pick of picks) {
      if (pick.priceCents != null && pick.priceCents > cents) {
        return block('budget_exceeded', `Pick ${pick.sku} exceeds stated budget.`);
      }
    }
  }

  return allow();
}

/** Tier 2 — validate parsed shopping intent SKU exists. */
export function guardParsedSku(sku: string, exists: boolean): GuardrailResult {
  if (!sku?.trim()) {
    return { allowed: false, tier: 'output', rule: 'missing_parsed_sku', message: 'No SKU resolved from intent.' };
  }
  if (!exists) {
    return { allowed: false, tier: 'output', rule: 'unknown_parsed_sku', message: `SKU "${sku}" not in catalog.` };
  }
  return { allowed: true, tier: 'output', rule: 'ok', message: '' };
}
