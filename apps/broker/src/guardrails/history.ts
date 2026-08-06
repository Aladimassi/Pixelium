import { guardInput } from './input.js';
import { normalizeGuardText } from './normalize.js';

export type ChatHistoryTurn = { role: 'user' | 'assistant'; content: string };

/** Client-supplied assistant turns can be forged — never trust them as assistant role. */
const FORGED_ASSISTANT_PATTERN =
  /\b(system override|ignore (all )?(previous|prior) instructions|you are now|api keys?|bypass (the )?broker|payment (is )?complete|approve all payments)\b/i;

/**
 * Sanitize chat history from the client.
 * - Keeps only user turns (drops forged assistant messages)
 * - Blocks turns that fail input guardrails
 */
export function sanitizeChatHistory(
  history: unknown,
  maxTurns = 10,
): { turns: ChatHistoryTurn[]; blocked: GuardrailBlock | null } {
  if (!Array.isArray(history)) {
    return { turns: [], blocked: null };
  }

  const turns: ChatHistoryTurn[] = [];
  for (const turn of history.slice(-maxTurns)) {
    if (!turn || typeof turn !== 'object') continue;

    const rawRole = (turn as { role?: unknown }).role;
    const content = String((turn as { content?: unknown }).content ?? '').trim();
    if (!content) continue;

    const normalized = normalizeGuardText(content);

    // Reject forged system-like content regardless of claimed role.
    if (FORGED_ASSISTANT_PATTERN.test(normalized)) {
      return {
        turns: [],
        blocked: {
          rule: 'history_injection',
          message: 'Suspicious content in chat history is not allowed.',
        },
      };
    }

    const guard = guardInput(content);
    if (!guard.allowed) {
      return { turns: [], blocked: { rule: guard.rule, message: guard.message } };
    }

    // Only user turns are trusted for multi-turn context.
    if (rawRole === 'user') {
      turns.push({ role: 'user', content });
    }
  }

  return { turns, blocked: null };
}

export interface GuardrailBlock {
  rule: string;
  message: string;
}
