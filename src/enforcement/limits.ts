/**
 * Resource limits + diagnostic truncation.
 *
 * Two protections, applied at the dispatcher (the single serialization choke point):
 *   1. INPUT caps — reject pathologically large requests before any handler runs, so a
 *      huge/malformed input cannot blow up memory regardless of which tool is called.
 *   2. OUTPUT caps — truncate unbounded diagnostic arrays (and an over-long corrective
 *      prompt) deterministically, and REPORT the truncation, so a valid-but-large input
 *      produces a bounded response instead of a multi-megabyte payload.
 *
 * Pure, deterministic, no LLM. Input is bounded ⇒ every linear-ish check's output is
 * bounded; output caps are defense-in-depth + clean, capped diagnostics for display.
 */

export const LIMITS = {
  /** Max serialized size of a single tool-call's arguments. */
  MAX_INPUT_BYTES: 5_000_000,
  /** Max items in any single input array. */
  MAX_ARRAY_ITEMS: 5_000,
  /** Max length of any single input string. */
  MAX_STRING_CHARS: 1_000_000,
  /** Max input nesting depth. */
  MAX_DEPTH: 64,
  /** Max items returned in any diagnostic list. */
  MAX_DIAGNOSTICS: 100,
  /** Max length of the returned corrective prompt. */
  MAX_PROMPT_CHARS: 20_000,
} as const;

/** Diagnostic ("list of problems/notes") fields safe to truncate for display. */
const DIAGNOSTIC_FIELDS = new Set([
  'blocking_issues', 'warnings', 'gaps', 'overlaps', 'violations',
  'auto_detected_unaccounted_claims', 'untraced_answer_numbers', 'suspected_downgrades',
  'missing_prerequisites', 'circular_dependencies', 'resource_conflicts',
  'missing_required_fields', 'flagged_uncovered_fields', 'unfalsifiable',
  'hedged_sentences', 'ungrounded_entities', 'cycles', 'orphaned_conclusions', 'outliers',
]);

/**
 * Reject pathologically large input. Throws a validation Error (mapped to InvalidParams
 * by the dispatcher) — never silently truncates input, so behavior stays deterministic.
 */
export function enforceInputLimits(args: unknown): void {
  let json: string;
  try {
    json = JSON.stringify(args) ?? '';
  } catch {
    throw new Error('Input is not serializable.');
  }
  if (json.length > LIMITS.MAX_INPUT_BYTES) {
    throw new Error(`Input exceeds the maximum size of ${LIMITS.MAX_INPUT_BYTES} bytes.`);
  }
  const walk = (v: unknown, depth: number): void => {
    if (depth > LIMITS.MAX_DEPTH) throw new Error('Input nesting exceeds the maximum depth.');
    if (typeof v === 'string') {
      if (v.length > LIMITS.MAX_STRING_CHARS) {
        throw new Error(`A string field exceeds the maximum of ${LIMITS.MAX_STRING_CHARS} characters.`);
      }
      return;
    }
    if (Array.isArray(v)) {
      if (v.length > LIMITS.MAX_ARRAY_ITEMS) {
        throw new Error(`An input array exceeds the maximum of ${LIMITS.MAX_ARRAY_ITEMS} items.`);
      }
      for (const x of v) walk(x, depth + 1);
      return;
    }
    if (v && typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1);
    }
  };
  walk(args, 0);
}

export interface TruncationInfo {
  [field: string]: { returned: number; total: number };
}

function capObject(obj: Record<string, unknown>, info: TruncationInfo, prefix: string): void {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val) && DIAGNOSTIC_FIELDS.has(key) && val.length > LIMITS.MAX_DIAGNOSTICS) {
      info[prefix + key] = { returned: LIMITS.MAX_DIAGNOSTICS, total: val.length };
      obj[key] = val.slice(0, LIMITS.MAX_DIAGNOSTICS);
    }
    if (key === 'corrective_prompt' && typeof val === 'string' && val.length > LIMITS.MAX_PROMPT_CHARS) {
      info[prefix + key] = { returned: LIMITS.MAX_PROMPT_CHARS, total: val.length };
      obj[key] = val.slice(0, LIMITS.MAX_PROMPT_CHARS) + '\n…[truncated]';
    }
  }
}

/**
 * Cap diagnostic arrays (top-level and under `enforcement`) and the corrective prompt,
 * in place. Returns a map of what was truncated (empty if nothing was). Substantive
 * per-item arrays (e.g. `results`, `ranked_options`, `critical_path`) are NOT capped —
 * they are bounded by the input caps and carry the actual answer.
 */
export function capDiagnostics(result: unknown): TruncationInfo {
  const info: TruncationInfo = {};
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const r = result as Record<string, unknown>;
    capObject(r, info, '');
    if (r.enforcement && typeof r.enforcement === 'object' && !Array.isArray(r.enforcement)) {
      capObject(r.enforcement as Record<string, unknown>, info, 'enforcement.');
    }
  }
  return info;
}
