/**
 * Loop governor — stall detection across iterative reasoning.
 *
 * Stall = same gap text appearing (>75% Jaccard similarity) across 3+ iterations.
 * Max iterations: 5 (hard limit).
 *
 * Stall types:
 *   knowledge_gap — LLM lacks domain knowledge
 *   scope_gap     — prerequisite question needed
 *
 * Provides reframe prompts to break stalls.
 */

import type { LoopGovernorEntry, LoopGovernorResult } from './types.js';
import { jaccardSimilarity } from './utils.js';

const MAX_ITERATIONS = 5;
const STALL_SIMILARITY_THRESHOLD = 0.75;
const MIN_STALL_COUNT = 3;

/**
 * Classify the stall type by inspecting the recurring gap text.
 *
 * Heuristic:
 *   - If the gap mentions data, knowledge, information, documentation,
 *     benchmarks, metrics → knowledge_gap
 *   - Otherwise → scope_gap (question needs decomposition)
 */
function classifyStall(gapText: string): 'knowledge_gap' | 'scope_gap' {
  const lower = gapText.toLowerCase();
  const knowledgeSignals =
    /\b(?:data|knowledge|information|documentation|benchmark|metric|measurement|evidence|research|study|source)\b/;
  return knowledgeSignals.test(lower) ? 'knowledge_gap' : 'scope_gap';
}

const REFRAME_PROMPTS: Record<string, string> = {
  knowledge_gap:
    'What information would you need to answer this? Name the specific data.',
  scope_gap:
    'What simpler question, if answered first, would let you address this?',
};

/**
 * Find the longest run of mutually-similar gap texts (Jaccard > threshold).
 * Returns the indices of the run.
 */
function findLongestSimilarRun(
  entries: LoopGovernorEntry[],
): { start: number; length: number } {
  if (entries.length === 0) return { start: 0, length: 0 };

  let bestStart = 0;
  let bestLen = 1;
  let curStart = 0;
  let curLen = 1;

  for (let i = 1; i < entries.length; i++) {
    const sim = jaccardSimilarity(entries[i].gap_text, entries[curStart].gap_text);
    if (sim > STALL_SIMILARITY_THRESHOLD) {
      curLen++;
    } else {
      curStart = i;
      curLen = 1;
    }
    if (curLen > bestLen) {
      bestStart = curStart;
      bestLen = curLen;
    }
  }

  return { start: bestStart, length: bestLen };
}

/**
 * Find the iteration with the best score (lowest = best if scores are
 * enforcement scores, highest = best if they are quality scores).
 * We assume higher is better; if no scores are present, return the last iteration.
 */
function findBestIteration(entries: LoopGovernorEntry[]): number {
  let bestIdx = entries.length - 1;
  let bestScore = -Infinity;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].score !== undefined && entries[i].score! > bestScore) {
      bestScore = entries[i].score!;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Check iterative reasoning for stalls and enforce the hard iteration limit.
 */
export function checkLoop(
  iterations: LoopGovernorEntry[],
): LoopGovernorResult {
  const remaining = Math.max(0, MAX_ITERATIONS - iterations.length);

  if (iterations.length === 0) {
    return { stalled: false, iterations_remaining: MAX_ITERATIONS };
  }

  // Hard limit
  if (iterations.length >= MAX_ITERATIONS) {
    const stallType = classifyStall(iterations[iterations.length - 1].gap_text);
    return {
      stalled: true,
      stall_type: stallType,
      stall_diagnosis: `Hard iteration limit (${MAX_ITERATIONS}) reached.`,
      best_iteration: findBestIteration(iterations),
      reframe_prompt: REFRAME_PROMPTS[stallType],
      iterations_remaining: 0,
    };
  }

  // Stall detection
  const run = findLongestSimilarRun(iterations);
  if (run.length >= MIN_STALL_COUNT) {
    const stallGap = iterations[run.start].gap_text;
    const stallType = classifyStall(stallGap);
    return {
      stalled: true,
      stall_type: stallType,
      stall_diagnosis:
        `Same gap recurring for ${run.length} iterations (Jaccard > ${STALL_SIMILARITY_THRESHOLD}).`,
      best_iteration: findBestIteration(iterations),
      reframe_prompt: REFRAME_PROMPTS[stallType],
      iterations_remaining: remaining,
    };
  }

  return {
    stalled: false,
    best_iteration: findBestIteration(iterations),
    iterations_remaining: remaining,
  };
}
