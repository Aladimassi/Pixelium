/** Zero-width and invisible chars used to bypass regex word boundaries. */
const ZERO_WIDTH = /[\u200B-\u200C\u200D\uFEFF\u2060\u180E]/g;

const LEET_SUBSTITUTIONS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/**
 * Normalize user text before guardrail pattern matching.
 * Does not alter the message sent to the LLM — matching only.
 */
export function normalizeGuardText(message: string): string {
  let text = message.normalize('NFKC').replace(ZERO_WIDTH, '');
  text = text.toLowerCase().replace(/[013457@$]/g, (ch) => LEET_SUBSTITUTIONS[ch] ?? ch);
  return text.replace(/\s+/g, ' ').trim();
}
