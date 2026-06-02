/**
 * GateUnderTest — the interface the injected-defect scorer needs (plan §10
 * "Block accounting", §8 "the gate works / blocker coverage").
 *
 * The scorer treats the enforcement gate as a BLACK BOX that, given an answer
 * bundle, decides whether to BLOCK it and (when blocking) emits exactly one §7
 * blocker code. That is the entire surface the scorer depends on:
 *
 *     GateUnderTest = (bundle) -> { blocked, blocker_code }
 *
 * ── WIRING STATUS (read this) ─────────────────────────────────────────────────
 * The REAL gate lives in src/ (host enforcement). A parallel agent is currently
 * MODIFYING src/, so we do NOT call the live gate this pass — a moving target gives
 * meaningless precision/recall. Instead we ship:
 *
 *   1. This interface, so the scorer and its tests are written against a stable
 *      contract.
 *   2. A clearly-marked ORACLE-BACKED STUB (`oracleStubGate`) that lets the scorer
 *      be unit-tested offline with deterministic, fully-controlled behavior. The
 *      stub is NOT a measurement of the real gate; it is a test double.
 *
 * DONE (dvp-p1a-run): `realEnforcementGate` (below) drives the ACTUAL settled gate —
 * the §9 Cat-1 bundle gates (final-answer↔artifact drift, requirement coverage, strong
 * source-span grounding) and the contract constraint gate — over an ArtifactBundle /
 * grounding / constraint payload built per base in bundle_cases.ts. It imports from
 * src/ and does NOT modify src/. The emitted blocking `mechanism` is mapped to its §7
 * code via the REAL src/enforcement/blocker_taxonomy.ts (taxonomyForMechanism), so the
 * scorer's blocker_code_accuracy compares the gate's own code to the C label.
 *
 * The `oracleStubGate` below remains a TEST DOUBLE for the scorer-arithmetic unit
 * tests only — it is NEVER a measurement of the real gate's value.
 */

import { gradeWithOracle, type Oracle } from './oracles.js';
import type { BlockerCode } from './mutators.js';

import { EnforcementEngine } from '../src/enforcement/index.js';
import { renderAnswer } from '../src/enforcement/answer_renderer.js';
import { detectFinalAnswerDrift, checkRequirementCoverage } from '../src/enforcement/drift_detector.js';
import { checkStrongGrounding } from '../src/tools/check_quote_grounding.js';
import { handleCheckAnswerAgainstConstraints } from '../src/tools/check_answer_against_constraints.js';
import { stampTaxonomy, type BlockerTaxonomyCode } from '../src/enforcement/blocker_taxonomy.js';
import type { BlockingIssue } from '../src/enforcement/types.js';
import type { GatePayload } from './bundle_cases.js';

/**
 * The unit a gate judges: a model answer plus the oracle context describing what a
 * correct answer requires. The real gate will derive its own checks from the host
 * contract; the oracle here stands in for that contract during offline scoring.
 */
export interface GateBundle {
  /** Stable id of the underlying base/mutant (for transcripts). */
  id: string;
  /** The (possibly mutated) answer text the gate must judge. */
  answer: string;
  /** The oracle / contract context for this task. */
  oracle: Oracle;
}

export interface GateDecision {
  /** True iff the gate would BLOCK release of this answer. */
  blocked: boolean;
  /**
   * The §7 blocker code, present iff blocked. Exactly one code per block (§7).
   * Null when the gate passed the answer.
   */
  blocker_code: BlockerCode | null;
}

/** The black-box contract the scorer depends on. */
export type GateUnderTest = (bundle: GateBundle) => GateDecision;

/**
 * Map an oracle KIND to the §7 blocker code its primary defect produces. This is
 * the stub's taxonomy mapping; the REAL gate emits its own code and the scorer
 * compares the two (blocker_code_accuracy).
 *
 * NOTE: a single oracle kind can produce more than one §7 code (e.g. source_span
 * yields UNSUPPORTED_CLAIM for a fabrication but SOURCE_SPAN_MISMATCH for a missing
 * grounded fact). The stub disambiguates from the oracle verdict reasons below.
 */
function stubBlockerCodeFor(oracle: Oracle, reasons: string[]): BlockerCode {
  switch (oracle.kind) {
    case 'gold_answer':
      return 'NUMERIC_MISMATCH';
    case 'source_span':
      // A missing grounded fact is a span mismatch; an asserted fabrication is an
      // unsupported claim. If both, prefer the fabrication code (more severe).
      if (reasons.some((r) => r.startsWith('asserted_unsupported'))) {
        return 'UNSUPPORTED_CLAIM';
      }
      return 'SOURCE_SPAN_MISMATCH';
    case 'structured_constraint':
      // A missing requirement (no object at all, or a REQUIRED FIELD ABSENT — the
      // oracle reports the latter as a violation with "got undefined") maps to
      // MISSING_REQUIREMENT; a present-but-out-of-bound/enum value is a
      // CONSTRAINT_VIOLATION. The `got undefined` substring is the deterministic
      // "field absent" signal from oracles.ts.
      if (
        reasons.includes('no_structured_object_parsed') ||
        reasons.some((r) => r.includes('got undefined'))
      ) {
        return 'MISSING_REQUIREMENT';
      }
      return 'CONSTRAINT_VIOLATION';
  }
}

/**
 * ORACLE-BACKED STUB GATE — a test double, NOT the real enforcement gate.
 *
 * It blocks exactly the answers the objective oracle deems wrong, and emits the §7
 * code implied by the oracle's failure reason. This is a PERFECT gate by
 * construction (recall = 1, false-block = 0 on oracle-graded inputs); its only
 * purpose is to make the scorer's arithmetic unit-testable with known ground truth.
 *
 * It must NEVER be presented as a measurement of the real gate's value. The real
 * gate (TODO above) will block a SUBSET of these and may emit different codes — that
 * delta is exactly what the deferred live run measures.
 */
export const oracleStubGate: GateUnderTest = (bundle) => {
  const verdict = gradeWithOracle(bundle.oracle, bundle.answer);
  if (verdict.correct) {
    return { blocked: false, blocker_code: null };
  }
  return {
    blocked: true,
    blocker_code: stubBlockerCodeFor(bundle.oracle, verdict.reasons),
  };
};

/**
 * Build an arbitrary gate from a decision function — convenience for tests that
 * want to model an IMPERFECT gate (misses, false blocks, wrong codes) and assert
 * the scorer reports the right precision/recall.
 */
export function gateFrom(fn: GateUnderTest): GateUnderTest {
  return fn;
}

// ── REAL gate (the settled enforcement gate, driven over bundle payloads) ────────

/** The decision the real gate makes on one bundle/grounding/constraint payload. */
export interface RealGateDecision {
  blocked: boolean;
  /** §7 code from the FIRST blocking issue, via the real taxonomy. Null when passed. */
  blocker_code: BlockerTaxonomyCode | null;
  /** Internal mechanism of the first block (for transcripts/honesty). */
  mechanism: string | null;
  /** Every blocking mechanism emitted (a payload may trip more than one). */
  all_mechanisms: string[];
}

/** The black-box contract the bundle scorer depends on. */
export type RealGate = (payload: GatePayload) => RealGateDecision;

const ENGINE = new EnforcementEngine();

/** Stamp the §7 taxonomy onto blocking issues and read off the first code. */
function decide(issues: BlockingIssue[]): RealGateDecision {
  const blocking = issues.filter((i) => i.severity === 'blocking');
  if (blocking.length === 0) {
    return { blocked: false, blocker_code: null, mechanism: null, all_mechanisms: [] };
  }
  stampTaxonomy(blocking); // real src/ mechanism → §7 code mapping
  const first = blocking[0];
  return {
    blocked: true,
    blocker_code: first.taxonomy ?? null,
    mechanism: first.mechanism,
    all_mechanisms: blocking.map((i) => i.mechanism),
  };
}

/**
 * realEnforcementGate — calls the ACTUAL settled gate code (src/, imported not
 * reimplemented) for the §9 Cat-1 gate this payload targets:
 *   - bundle + bundle_gate 'drift'                → renderAnswer + detectFinalAnswerDrift
 *   - bundle + bundle_gate 'requirement_coverage' → checkRequirementCoverage
 *   - grounding                                   → checkStrongGrounding
 *   - constraintCheck                             → handleCheckAnswerAgainstConstraints
 * The emitted mechanism → §7 code mapping is the real blocker_taxonomy.ts.
 */
export const realEnforcementGate: RealGate = (payload) => {
  if (payload.bundle) {
    if (payload.bundle_gate === 'requirement_coverage') {
      return decide(checkRequirementCoverage(payload.bundle).blocking_issues);
    }
    // default: final-answer↔artifact drift over the rendered ledger.
    const rendered = renderAnswer(payload.bundle);
    return decide(detectFinalAnswerDrift(rendered.rendered_fields).blocking_issues);
  }
  if (payload.grounding) {
    const { sources, claims } = payload.grounding;
    return decide(checkStrongGrounding(sources, claims, ENGINE).blocking_issues);
  }
  if (payload.constraintCheck) {
    const out = handleCheckAnswerAgainstConstraints(
      {
        answer: payload.constraintCheck.answer,
        constraints: payload.constraintCheck.constraints,
        original_request_text: payload.constraintCheck.original_request_text,
      },
      ENGINE,
    );
    return decide(out.enforcement?.blocking_issues ?? []);
  }
  // An empty payload is a harness bug — fail loud rather than silently "pass".
  throw new Error('realEnforcementGate: payload has no bundle/grounding/constraintCheck.');
};
