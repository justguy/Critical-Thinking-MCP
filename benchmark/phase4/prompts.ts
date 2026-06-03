/**
 * Phase 4 — the FROZEN system-prompt set for the four-arm ablation (§5, §9
 * frozen-invariant #6). All four arms differ ONLY along the dimension the prereg
 * isolates; every other byte is held equal so the ablation is ceteris-paribus.
 *
 *   SHARED_COT_SYS — chain-of-thought elicitation. Given to BOTH arm A and arm C
 *                    so the A-vs-C contrast isolates ENFORCEMENT, not thinking
 *                    volume (§5 "Chain-of-thought elicitation"). Honest: it makes
 *                    NO claim that any tool enforces the steps.
 *   BIND_SYS       — drives the real ct-mcp tools and the finalize binding. Carries
 *                    a WORKED EXAMPLE bundle PROVEN offline to RELEASE through the
 *                    real gate (tests/benchmark/phase4_prompts.test.ts). Arm B.
 *   NOBIND_SYS     — byte-identical to BIND_SYS EXCEPT the finalize/binding clause
 *                    is replaced with "do NOT call finalize_deliverable; state your
 *                    final answer directly". Arm D. The ONLY diff is the binding
 *                    clause (§5 "System-prompt byte control").
 *
 * CHECKLIST_SYS is NOT here — it is RENDERED FROM the real tool-description source
 * by render_checklist_sys.ts (the negative control must track what B's tools
 * surface, §5/§9). See that file.
 *
 * Honesty (CLAUDE.md §1, prereg §0): these prompts never claim a tool "forces
 * correct reasoning". BIND_SYS says the gate RE-EXECUTES declared checks and binds
 * the answer to the ledger — which is what finalize_deliverable actually does — not
 * that passing proves the answer true.
 *
 * Pure string constants. No model calls, no I/O.
 */

// ── The required final-answer sentinel (shared by all arms; §1 grading) ───────
//
// gradeWithOracle reads the FINAL ANSWER: sentinel on A/C and the finalize-bound
// field on B/D, so EVERY arm must end with this exact line (parseStreamJson's
// FINAL_ANSWER_RE matches it). Phrased identically across prompts.
const SENTINEL_CLAUSE =
  "End your reply with exactly one line in this form, and nothing after it:\n" +
  'FINAL ANSWER: <value>';

// ── A/C: chain-of-thought elicitation (no enforcement claim) ──────────────────
export const SHARED_COT_SYS = [
  'Work the problem carefully and show your reasoning.',
  '- Show every derivation step: state each intermediate number and the operation that produced it.',
  '- Quote any source you rely on verbatim.',
  '- Restate the constraints the answer must satisfy before you give it.',
  '- Re-check your final number by recomputing it a second way before you commit.',
  '',
  SENTINEL_CLAUSE,
].join('\n');

// ── The WORKED EXAMPLE shared by BIND_SYS and NOBIND_SYS ──────────────────────
//
// This is the literal artifact bundle that tests/benchmark/phase4_prompts.test.ts
// proves RELEASEs through the real finalize gate (and whose wrong-number mutation
// BLOCKs). It teaches the SHAPE of a re-executable credit-weighted mean: a
// weighted_average final node over raw input grades with credit weights, plus the
// matching arithmetic_checks, plus the final number traced verbatim into the
// answer. A competent model can replicate this shape for its own numbers.
//
// Because NOBIND_SYS forces the SAME non-finalize artifacts, this example lives in
// a shared constant — the binding clause is the ONLY thing that differs (§5).
const WORKED_EXAMPLE = [
  'WORKED EXAMPLE (study the SHAPE, then build your own for THIS task).',
  'Suppose the task were: "Courses graded credit-weighted — 3 credits @ 80, 4 credits @ 70,',
  '2 credits @ 95. Give the credit-weighted average, two decimals." The correct method is the',
  'credit-weighted mean = (80*3 + 70*4 + 95*2) / (3+4+2) = 710 / 9 = 78.89 (NOT the plain',
  'mean 81.67). Declare it so the gate can RE-EXECUTE it:',
  '',
  '  numeric_derivation = {',
  '    "nodes": [',
  '      {"id":"g1","role":"input","value":80},',
  '      {"id":"g2","role":"input","value":70},',
  '      {"id":"g3","role":"input","value":95},',
  '      {"id":"cwa","role":"final","value":78.89,"op":"weighted_average",',
  '       "input_refs":["g1","g2","g3"],"weights":[3,4,2]}',
  '    ],',
  '    "final_refs": ["cwa"]',
  '  }',
  '  arithmetic_checks = [',
  '    {"claim_type":"weighted_average","values":[80,70,95],"weights":[3,4,2],',
  '     "claimed_result":78.89,"tolerance":0.01}',
  '  ]',
  '',
  'Rules the gate enforces, so follow them:',
  '- Every raw input node value must appear in the task text (do not invent or pre-compute inputs).',
  '- The final node\'s op must actually recompute its declared value from its input_refs.',
  '- Every number in your answer text must be one of these declared/derived values (untraced',
  '  numbers BLOCK), and the final value must appear verbatim in the answer text.',
  '- Pick the op that matches the asked method (weighted_average for a credit/size-weighted mean,',
  '  NOT plain mean) — a self-consistent DAG that uses the wrong method still BLOCKs.',
].join('\n');

// The contract shape both bound and non-bound arms declare for a numeric task.
const CONTRACT_CLAUSE = [
  'Build a deliverable_contract for the task: contract_id (any string), task_type',
  '("numeric_analysis" for a calculation), evidence_level "rederived", risk_level "high",',
  'original_request_text = the task verbatim, and must_include = [your final number as a string].',
].join('\n');

// The shared opening + artifact-construction body (identical in BIND and NOBIND).
const ARTIFACT_BODY = [
  'You are answering under a verification protocol with access to the ct-mcp tools.',
  '',
  'Steps:',
  '1. Call plan_checks with your contract to learn which checks the gate will re-execute',
  '   (for a numeric task: trace_conclusion_numbers and verify_arithmetic).',
  '2. Build the artifacts the plan asks for. ' + CONTRACT_CLAUSE,
  '   For numbers, build a numeric_derivation {nodes, final_refs} and arithmetic_checks',
  '   exactly in the shape below so the gate can RE-EXECUTE and confirm your arithmetic.',
  '',
  WORKED_EXAMPLE,
].join('\n');

// ── B: forced artifacts + finalize binding (the full proof-carrying spine) ────
//
// BINDING CLAUSE (the §5-controlled delta vs NOBIND_SYS). Honest: it states what
// finalize does (re-executes the declared checks; binds the surfaced answer to the
// ledger via answer_text_hash), never that PASS proves the answer is true.
const BIND_CLAUSE = [
  '3. Call finalize_deliverable with your contract, answer_text, numeric_derivation, and',
  '   arithmetic_checks. finalize RE-EXECUTES the contract\'s required checks inline and, on',
  '   PASS, returns an answer_text_hash that BINDS your surfaced answer to the checked ledger.',
  '   If it BLOCKs, read the blocking_issues, fix the named artifact, and call it again — do not',
  '   change the answer to dodge the check; make the derivation correct. Only surface an answer',
  '   that finalize_deliverable has PASSED.',
].join('\n');

// ── D: forced artifacts WITHOUT binding (no finalize advertised, NOBIND_SYS) ──
//
// Replaces ONLY the binding clause. Same artifact work (plan_checks + the
// derivation/arithmetic artifacts), but no finalize call and no answer_text_hash
// binding — so final-answer↔ledger drift cannot be enforced (§1 arm D).
const NOBIND_CLAUSE = [
  '3. Do NOT call finalize_deliverable. After building and self-checking your numeric_derivation',
  '   and arithmetic_checks, state your final answer directly in your reply.',
].join('\n');

export const BIND_SYS = [
  ARTIFACT_BODY,
  '',
  BIND_CLAUSE,
  '',
  SENTINEL_CLAUSE,
].join('\n');

export const NOBIND_SYS = [
  ARTIFACT_BODY,
  '',
  NOBIND_CLAUSE,
  '',
  SENTINEL_CLAUSE,
].join('\n');

/**
 * The structured worked-example bundle embedded (as text) in BIND_SYS / NOBIND_SYS,
 * exported so the offline proof test (Deliverable 4) re-runs THIS bundle through the
 * real finalize gate and asserts RELEASE — i.e. the example we hand the model is the
 * exact one proven to pass. Keep in lockstep with WORKED_EXAMPLE above.
 */
export const WORKED_EXAMPLE_BUNDLE = {
  contract: {
    contract_id: 'cwa-worked-example',
    contract_authority: 'host' as const,
    profile_source: 'host_supplied' as const,
    original_request_text:
      'Courses graded credit-weighted — 3 credits @ 80, 4 credits @ 70, 2 credits @ 95. ' +
      'Give the credit-weighted average, two decimals.',
    task_type: 'numeric_analysis' as const,
    evidence_level: 'rederived' as const,
    risk_level: 'high' as const,
    must_include: ['78.89'],
  },
  answer_text: 'The credit-weighted average grade is 78.89.\nFINAL ANSWER: 78.89',
  numeric_derivation: {
    nodes: [
      { id: 'g1', role: 'input' as const, value: 80 },
      { id: 'g2', role: 'input' as const, value: 70 },
      { id: 'g3', role: 'input' as const, value: 95 },
      {
        id: 'cwa',
        role: 'final' as const,
        value: 78.89,
        op: 'weighted_average' as const,
        input_refs: ['g1', 'g2', 'g3'],
        weights: [3, 4, 2],
      },
    ],
    final_refs: ['cwa'],
  },
  arithmetic_checks: [
    { claim_type: 'weighted_average' as const, values: [80, 70, 95], weights: [3, 4, 2], claimed_result: 78.89, tolerance: 0.01 },
  ],
};
