export type ShoppingIntent = 'sleep' | 'running' | 'general';

export interface ExpandedQuery {
  original: string;
  searchText: string;
  intent: ShoppingIntent;
}

const SLEEP_PATTERN =
  /\b(sleep|sleeping|insomnia|bedtime|rest better|help me sleep|can't sleep|cant sleep|fall asleep|at night)\b/i;

const RUNNING_PATTERN =
  /\b(running|runner|jogging|jog|marathon|sprint|trail run|cardio|athletic)\b/i;

const WINTER_PATTERN =
  /\b(winter|cold weather|snow|freezing|stay warm|keep warm|warm and dry)\b/i;

/** Expand vague user language into richer text for embedding search. */
export function expandQueryForRetrieval(message: string): ExpandedQuery {
  const original = message.trim();
  if (SLEEP_PATTERN.test(original)) {
    return {
      original,
      intent: 'sleep',
      searchText: `${original}. Shopping for sleep and relaxation: plush pillow cushion teddy bear comfort calm bedtime stress relief soft toy blanket`,
    };
  }

  if (RUNNING_PATTERN.test(original)) {
    return {
      original,
      intent: 'running',
      searchText: `${original}. Running shoes sneakers footwear athletic trainers high-top basketball`,
    };
  }

  if (WINTER_PATTERN.test(original)) {
    return {
      original,
      intent: 'general',
      searchText: `${original}. Winter outerwear jacket coat waterproof warm layers hiking trail`,
    };
  }

  return { original, searchText: original, intent: 'general' };
}
