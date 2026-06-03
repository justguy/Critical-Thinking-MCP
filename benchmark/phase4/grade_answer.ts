/**
 * Phase 4 — Amendment B1: type-aware grading helper.
 *
 * Round-1 calibration (benchmark/phase4/calibration_run.json) showed the
 * "defects" were dominated by GRADING bugs, not model error: a verbose CoT
 * transcript carrying a correct `FINAL ANSWER:` sentinel was mis-extracted; a
 * constraint answer's JSON was buried in prose under SHARED_COT_SYS so nothing
 * parsed. This helper grades the INTENDED answer per the prereg §5 grading row
 * ("graded on the FINAL ANSWER sentinel; dry-run-assert extraction for every arm
 * shape"), per oracle kind:
 *
 *   • gold_answer (numeric)  — grade the FINAL ANSWER sentinel VALUE when present
 *                              (avoids picking an intermediate number from verbose
 *                              CoT); else fall back to final_text.
 *   • structured_constraint  — extract the JSON OBJECT (prefer a fenced ```json
 *                              block, else the LAST balanced object literal in
 *                              final_text or after `FINAL ANSWER:`) and grade THAT.
 *   • source_span            — grade the full final_text (post-fix oracle is
 *                              currency/punctuation-robust; the gold/distractor
 *                              predicates need the whole prose).
 *
 * A REFUSAL / non-answer (no sentinel, no JSON, empty) is reported HONESTLY as a
 * real failure to deliver — a `no_answer` DEFECT, never silently dropped.
 *
 * NO model / CLI calls — pure deterministic grading over an already-captured
 * ArmTranscript.
 */

import type { Phase4Task } from './corpus.js';
import type { ArmTranscript } from './arm_adapter.js';
import { gradeWithOracle, type OracleVerdict } from '../oracles.js';

const FINAL_ANSWER_MARKER = /FINAL ANSWER:/i;

/** A non-answer DEFECT verdict — reported, never silently dropped. */
function noAnswer(oracle_kind: OracleVerdict['oracle_kind']): OracleVerdict {
  return { correct: false, high_sev_defects: 1, reasons: ['no_answer'], oracle_kind };
}

/**
 * Find the LAST balanced `{...}` object literal in `text`. Scans for a closing
 * `}` and walks back to its matching `{` by brace depth (string/escape aware), so
 * a JSON object buried after verbose CoT is recovered even when other braces
 * appear earlier. Returns the literal substring (incl. braces) or null.
 */
export function lastBalancedObject(text: string): string | null {
  for (let end = text.length - 1; end >= 0; end--) {
    if (text[end] !== '}') continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = end; i >= 0; i--) {
      const ch = text[i];
      if (inStr) {
        // walking backwards: a quote closes the (reverse) string unless escaped.
        if (ch === '"' && !esc) inStr = false;
        esc = ch === '\\' ? !esc : false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        esc = false;
        continue;
      }
      if (ch === '}') depth++;
      else if (ch === '{') {
        depth--;
        if (depth === 0) return text.slice(i, end + 1);
      }
    }
  }
  return null;
}

/**
 * Extract the JSON-object string a constraint answer intends, in priority order:
 *   1. a fenced ```json … ``` (or bare ``` … ```) code block,
 *   2. the LAST balanced object literal AFTER a `FINAL ANSWER:` marker,
 *   3. the LAST balanced object literal anywhere in the text.
 * Returns the object substring (to be parsed/graded) or null.
 */
export function extractConstraintObjectString(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const inner = lastBalancedObject(fence[1]);
    if (inner) return inner;
  }
  const marker = text.match(FINAL_ANSWER_MARKER);
  if (marker && typeof marker.index === 'number') {
    const after = lastBalancedObject(text.slice(marker.index));
    if (after) return after;
  }
  return lastBalancedObject(text);
}

/**
 * Grade one arm's transcript against its task oracle, extracting the INTENDED
 * answer per oracle kind (prereg §5 grading row). A non-answer is a `no_answer`
 * DEFECT, reported honestly.
 */
export function gradeArmAnswer(task: Phase4Task, transcript: ArmTranscript): OracleVerdict {
  const kind = task.oracle.kind;
  const finalText = transcript.final_text ?? '';
  const sentinel = transcript.final_answer_sentinel;

  switch (kind) {
    case 'gold_answer': {
      // Grade the FINAL ANSWER sentinel value when present (avoids picking an
      // intermediate number out of verbose CoT); else fall back to final_text.
      const answer = sentinel != null && sentinel.trim() !== '' ? sentinel : finalText;
      if (answer.trim() === '') return noAnswer(kind);
      return gradeWithOracle(task.oracle, answer);
    }

    case 'structured_constraint': {
      const objStr = extractConstraintObjectString(finalText);
      if (objStr == null) return noAnswer(kind);
      return gradeWithOracle(task.oracle, objStr);
    }

    case 'source_span': {
      // The grounding predicate needs the whole prose; grade the full final_text
      // (post-fix oracle is currency/punctuation-robust). A sentinel-only
      // fallback keeps a one-line answer gradeable.
      const answer = finalText.trim() !== '' ? finalText : sentinel ?? '';
      if (answer.trim() === '') return noAnswer(kind);
      return gradeWithOracle(task.oracle, answer);
    }
  }
}
