/**
 * Phase 4 — CHECKLIST_SYS rendered FROM the real ct-mcp tool-description source.
 *
 * Arm C is the negative control / kill switch (§1, §5): "structure as prose only".
 * Its instruction CONTENT must match what arm B's tools surface — so it is RENDERED
 * from the SAME source those tools advertise (src/mcp/tool-definitions.ts, the 11
 * public TOOLS), not hand-authored. That neutralizes the "C over/under-helped"
 * confound that would bias the C ≈ B kill (§5 "System-prompt byte control").
 *
 * The ONLY semantic delta vs BIND_SYS is the enforcement frame: BIND_SYS says
 * "you have tools that RE-EXECUTE this"; CHECKLIST_SYS says "do this yourself".
 * No tool calls are mentioned and NO claim is made that anything enforces the
 * checklist (it is the no-enforcement control — prereg §0/§1 honesty).
 *
 * Per §5 the rendered prompt must sit within a ±15% LENGTH band of BIND_SYS.
 * checklistLengthRatio() computes that ratio; renderChecklistSys() throws if it
 * leaves the band, so a source-description edit that drifts the length out of band
 * fails loudly at render time (and in the Deliverable-4 test) rather than silently.
 *
 * Pure: imports the static tool definitions; no model calls, no network.
 */

import { TOOLS } from '../../src/mcp/tool-definitions.js';
import { BIND_SYS } from './prompts.js';

/**
 * The checks the deliverable gate surfaces, in the order plan_checks → finalize
 * present them, mapped to the dimension each enforces. We render the prose item
 * for each from the matching tool's REAL description (first sentence), so the
 * checklist content tracks the live tool surface. The dimensions mirror §5's
 * "claims+provenance, derivations, options, assumptions, requirement coverage,
 * strong-grounding citations, the finalize step".
 */
interface ChecklistItem {
  /** The dimension label shown to the model. */
  dimension: string;
  /** The tool whose real description sources this item's content. */
  sourceTool: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { dimension: 'Plan', sourceTool: 'plan_checks' },
  { dimension: 'Claims + provenance', sourceTool: 'check_numeric_claims' },
  { dimension: 'Derivations', sourceTool: 'verify_arithmetic' },
  { dimension: 'Options', sourceTool: 'evaluate_tradeoffs' },
  { dimension: 'Assumptions', sourceTool: 'validate_confidence' },
  { dimension: 'Reasoning chain', sourceTool: 'validate_reasoning_chain' },
  { dimension: 'Finalize', sourceTool: 'finalize_deliverable' },
];

const SENTINEL_CLAUSE =
  'End your reply with exactly one line in this form, and nothing after it:\n' +
  'FINAL ANSWER: <value>';

/**
 * The human prose of a tool description — the text BEFORE the machine-oriented
 * "REQUIRED INPUT FORMAT" block (which is a JSON schema example, not instruction
 * content). This is the content arm B's tool surface advertises in prose form.
 */
function toolProse(name: string): string {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool || typeof tool.description !== 'string') {
    throw new Error(`render_checklist_sys: tool "${name}" not found in the public TOOLS surface.`);
  }
  return tool.description.split('REQUIRED INPUT FORMAT')[0].replace(/\s+/g, ' ').trim();
}

// Phrase-level reframes from the ENFORCEMENT voice ("a tool RE-EXECUTES / BLOCKS")
// into the no-enforcement CHECKLIST voice ("check this yourself"). Phrase-level
// (not single-word) so the result reads as clean prose, never garbled fragments.
// Applied in order; each pair is [enforcement phrasing, checklist phrasing].
const REFRAME_PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bKeystone gate\b/gi, 'Final self-review'],
  [/\bfinalize_deliverable\b/g, 'your final self-review'],
  [/\bplan_checks\b/g, 'your own planning'],
  [/missing their artifacts is a BLOCK/gi, 'missing them means the work is not done'],
  [/BLOCKS on failure/gi, 'means the step is not satisfied'],
  [/\bBLOCKS\b/g, 'is not satisfied'],
  [/\bBLOCK\b/g, 'a failed check'],
  [/absent artifacts never block/gi, 'absent ones are not a problem'],
  [/NEVER blocks/gi, 'is just guidance'],
  [/\bRE-EXECUTES\b/g, 're-derive'],
  [/re-executed/gi, 're-derived'],
  [/\bre-runs?\b/gi, 're-do'],
  [/\bre-executes?\b/gi, 're-derive'],
  [/\bthe gate\b/gi, 'this checklist'],
  [/\bunforgeable\b/gi, 'verifiable'],
];

/**
 * Reframe the source prose into the no-enforcement CHECKLIST voice. This is the ONE
 * semantic delta vs BIND_SYS (§8 decision tree: the C ≈ B kill rests on it): the
 * CONTENT is identical, the frame is "do this yourself" not "a tool enforces this".
 * No tool is named and nothing is claimed to enforce the steps — prose-only control.
 */
function deEnforce(prose: string): string {
  let out = prose;
  for (const [pattern, replacement] of REFRAME_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Render CHECKLIST_SYS body items from the live tool descriptions. Each item is
 * imperative prose built from the SAME description content arm B's tools advertise,
 * reframed into the no-enforcement voice. We do NOT name the tools or claim anything
 * enforces the steps; this is the prose-only control.
 */
function renderItems(): string[] {
  return CHECKLIST_ITEMS.map(item => {
    const content = deEnforce(toolProse(item.sourceTool));
    return `- ${item.dimension}: ${content}`;
  });
}

const PREAMBLE = 'Work the problem and satisfy each item of this checklist yourself before you answer.';
const COVERAGE_LINE =
  '- Requirement coverage: restate every requirement in the request and confirm your answer ' +
  'addresses each one.';
const GROUNDING_LINE =
  '- Strong-grounding citations: for any factual claim, quote the exact source span it rests on.';
const RECHECK_LINE =
  '- Re-check: recompute your final number a second way and confirm every number in your answer ' +
  'is one you derived.';

/**
 * Compute the rendered CHECKLIST_SYS string from the current tool-description source.
 * Deterministic for a fixed source.
 */
function buildChecklistSys(): string {
  return [
    PREAMBLE,
    '',
    ...renderItems(),
    COVERAGE_LINE,
    GROUNDING_LINE,
    RECHECK_LINE,
    '',
    SENTINEL_CLAUSE,
  ].join('\n');
}

/** CHECKLIST_SYS length as a fraction of BIND_SYS length (1.0 == identical length). */
export function checklistLengthRatio(checklist: string = buildChecklistSys()): number {
  return checklist.length / BIND_SYS.length;
}

/** Byte-level diff archive entry: the lengths and the ratio, for the freeze hash (§9 #6). */
export function checklistByteDiff(checklist: string = buildChecklistSys()): {
  bind_sys_length: number;
  checklist_sys_length: number;
  ratio: number;
} {
  return {
    bind_sys_length: BIND_SYS.length,
    checklist_sys_length: checklist.length,
    ratio: checklistLengthRatio(checklist),
  };
}

const LENGTH_BAND = 0.15;

/**
 * Render CHECKLIST_SYS, asserting the §5 ±15% length band vs BIND_SYS. Throws if the
 * live tool descriptions render a checklist outside the band — a loud signal that the
 * negative control drifted out of parity and the run would be invalid.
 */
export function renderChecklistSys(): string {
  const checklist = buildChecklistSys();
  const ratio = checklistLengthRatio(checklist);
  if (Math.abs(ratio - 1) > LENGTH_BAND) {
    throw new Error(
      `render_checklist_sys: CHECKLIST_SYS length ${checklist.length} is ${(ratio * 100).toFixed(1)}% of ` +
        `BIND_SYS length ${BIND_SYS.length}, outside the ±${LENGTH_BAND * 100}% parity band (§5).`,
    );
  }
  return checklist;
}

/** The computed CHECKLIST_SYS (frozen at module load from the current source). */
export const CHECKLIST_SYS = renderChecklistSys();
