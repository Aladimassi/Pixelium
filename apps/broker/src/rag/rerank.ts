import type { SearchHit } from './vector-store.js';
import type { ExpandedQuery } from './query-expand.js';

const TRAIN_FALSE_POSITIVE =
  /\b(coach|gauge|hornby|railway|railroad|locomotive|mk1|sleeper car|train set|track set|emu|rail king)\b/i;

const SLEEP_POSITIVE =
  /\b(sleepy|sleep|pillow|plush|cushion|bear|comfort|relax|soft|bedtime|teddy|blanket|snuggle|calm|stress)\b/i;

const RUNNING_FOOTWEAR =
  /\b(shoe|sneaker|footwear|trainer|high-top|basketball|running)\b/i;

const OUTERWEAR =
  /\b(jacket|coat|parka|outerwear|waterproof|hiking)\b/i;

export function isSleepFalsePositive(name: string, description: string): boolean {
  const text = `${name} ${description}`.toLowerCase();
  return TRAIN_FALSE_POSITIVE.test(text) && !/\bsleepy\b/i.test(name);
}

/** Keep only footwear for running / athletic queries. */
export function filterRunningPicks<T extends { name: string; description?: string; category?: string }>(
  items: T[]
): T[] {
  return items.filter((p) => {
    const cat = (p.category ?? '').toLowerCase();
    if (cat === 'outerwear') return false;
    if (cat === 'footwear') return true;
    const text = `${p.name} ${p.description ?? ''}`.toLowerCase();
    return RUNNING_FOOTWEAR.test(text) && !OUTERWEAR.test(text);
  });
}

/** Boost real sleep/comfort items; demote hobby false positives like "Sleeping Car Coach". */
export function rerankHits(hits: SearchHit[], query: ExpandedQuery): SearchHit[] {
  if (query.intent === 'sleep') {
    return hits
      .map((hit) => {
        const { name, description } = hit.node.product;
        const text = `${name} ${description}`.toLowerCase();
        let score = hit.score;

        if (isSleepFalsePositive(name, description)) score -= 0.4;
        if (SLEEP_POSITIVE.test(text)) score += 0.12;
        if (/\bsleepy\b/i.test(name)) score += 0.25;
        if (/\bpillow\b/i.test(name)) score += 0.22;
        if (/\bcushion\b/i.test(name)) score += 0.15;
        if (/\b(bear|teddy)\b/i.test(name)) score += 0.1;

        return { ...hit, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  if (query.intent === 'running') {
    return hits
      .map((hit) => {
        const { name, description, category } = hit.node.product;
        const text = `${name} ${description} ${category}`.toLowerCase();
        let score = hit.score;

        if (category === 'footwear' || RUNNING_FOOTWEAR.test(text)) score += 0.4;
        if (OUTERWEAR.test(text) || category === 'outerwear') score -= 0.5;

        return { ...hit, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  return hits;
}

export function filterSleepPicks<T extends { name: string; description?: string }>(items: T[]): T[] {
  return items.filter((p) => !isSleepFalsePositive(p.name, p.description ?? ''));
}
