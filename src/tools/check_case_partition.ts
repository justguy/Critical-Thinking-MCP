/**
 * check_case_partition — MECE check on a declared case split.
 *
 * When the agent reasons by cases ("cache is warm | cold | evicting") it must supply
 * the partition as explicit intervals (numeric) or member sets (enum) over a stated
 * variable + domain. The tool checks the split is Mutually Exclusive (no overlap) and
 * Collectively Exhaustive (no gap over the domain).
 *
 * BLOCK (unforgeable — pure interval/set arithmetic): any overlap, any interior gap,
 * or a leading/trailing gap vs the declared domain.
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { BlockingIssue, EnforcementContext } from '../enforcement/types.js';

interface NumericCase {
  label: string;
  lo?: number;
  hi?: number;
  lo_inclusive?: boolean; // default true
  hi_inclusive?: boolean; // default false  (half-open [lo, hi) is the natural tiling)
}
interface EnumCase {
  label: string;
  members: string[];
}

export interface PartitionOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  is_mece: boolean;
  gaps: string[];
  overlaps: string[];
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

function validateInput(input: unknown): {
  type: 'numeric' | 'enum';
  min: number;
  max: number;
  values: string[];
  cases: any[];
} {
  if (input === null || typeof input !== 'object') {
    throw new Error('Input must be an object with "domain" {type,...} and "cases" [].');
  }
  const obj = input as Record<string, unknown>;
  const domain = obj.domain as Record<string, unknown> | undefined;
  if (!domain || (domain.type !== 'numeric' && domain.type !== 'enum')) {
    throw new Error('domain.type must be "numeric" or "enum".');
  }
  if (!Array.isArray(obj.cases) || obj.cases.length < 2) {
    throw new Error('Need at least 2 cases to check a partition.');
  }

  if (domain.type === 'numeric') {
    const min = typeof domain.min === 'number' ? domain.min : -Infinity;
    const max = typeof domain.max === 'number' ? domain.max : Infinity;
    // Reject NaN explicitly: NaN slips past `min >= max` and poisons the sort comparator
    // (non-deterministic output). ±Infinity is allowed.
    if (Number.isNaN(min) || Number.isNaN(max) || min >= max) {
      throw new Error(`domain.min (${min}) must be a number < domain.max (${max}).`);
    }
    for (let i = 0; i < obj.cases.length; i++) {
      const c = obj.cases[i] as Record<string, unknown>;
      if (typeof c.label !== 'string') throw new Error(`cases[${i}].label must be a string.`);
      if (c.lo !== undefined && (typeof c.lo !== 'number' || Number.isNaN(c.lo))) {
        throw new Error(`cases[${i}].lo must be a finite or ±Infinity number.`);
      }
      if (c.hi !== undefined && (typeof c.hi !== 'number' || Number.isNaN(c.hi))) {
        throw new Error(`cases[${i}].hi must be a finite or ±Infinity number.`);
      }
    }
    return { type: 'numeric', min, max, values: [], cases: obj.cases };
  }

  if (!Array.isArray(domain.values) || domain.values.length < 1) {
    throw new Error('enum domain requires non-empty domain.values (the universe).');
  }
  for (let i = 0; i < obj.cases.length; i++) {
    const c = obj.cases[i] as Record<string, unknown>;
    if (typeof c.label !== 'string') throw new Error(`cases[${i}].label must be a string.`);
    if (!Array.isArray(c.members)) throw new Error(`cases[${i}].members must be an array.`);
  }
  return { type: 'enum', min: 0, max: 0, values: domain.values as string[], cases: obj.cases };
}

function checkNumeric(min: number, max: number, rawCases: NumericCase[]): { gaps: string[]; overlaps: string[] } {
  const gaps: string[] = [];
  const overlaps: string[] = [];

  const cases = rawCases
    .map(c => ({
      label: c.label,
      lo: c.lo ?? -Infinity,
      hi: c.hi ?? Infinity,
      loInc: c.lo_inclusive ?? true,
      hiInc: c.hi_inclusive ?? false,
    }))
    .filter(c => {
      if (c.lo > c.hi || (c.lo === c.hi && !(c.loInc && c.hiInc))) {
        overlaps.push(`case "${c.label}" is an empty/invalid interval [${c.lo}, ${c.hi}]`);
        return false;
      }
      return true;
    })
    .sort((a, b) => (a.lo - b.lo) || (a.loInc === b.loInc ? 0 : a.loInc ? -1 : 1));

  if (cases.length === 0) return { gaps: ['no valid intervals'], overlaps };

  // leading gap
  const first = cases[0];
  if (first.lo > min || (first.lo === min && !first.loInc && min !== -Infinity)) {
    gaps.push(`leading gap: domain starts at ${min} but first case covers from ${first.lo}`);
  } else if (first.lo === -Infinity && min === -Infinity) {
    /* unbounded-below covered */
  }

  let reachHi = first.hi;
  let reachHiInc = first.hiInc;

  for (let i = 1; i < cases.length; i++) {
    const I = cases[i];
    if (I.lo > reachHi) {
      gaps.push(`gap between ${reachHi} and ${I.lo} (before case "${I.label}")`);
    } else if (I.lo === reachHi) {
      if (reachHiInc && I.loInc) {
        overlaps.push(`point overlap at ${I.lo} (case "${I.label}" and the prior case both include it)`);
      } else if (!reachHiInc && !I.loInc) {
        gaps.push(`point gap at ${I.lo} (neither the prior case nor "${I.label}" includes it)`);
      }
      // exactly one inclusive → perfect adjacency
    } else {
      overlaps.push(`overlap: case "${I.label}" starts at ${I.lo}, before prior coverage ends at ${reachHi}`);
    }
    if (I.hi > reachHi || (I.hi === reachHi && I.hiInc && !reachHiInc)) {
      reachHi = I.hi;
      reachHiInc = I.hiInc;
    }
  }

  // trailing gap
  if (reachHi < max || (reachHi === max && !reachHiInc && max !== Infinity)) {
    gaps.push(`trailing gap: coverage ends at ${reachHi} but domain extends to ${max}`);
  }

  return { gaps, overlaps };
}

function checkEnum(universe: string[], rawCases: EnumCase[]): { gaps: string[]; overlaps: string[] } {
  const gaps: string[] = [];
  const overlaps: string[] = [];
  const universeSet = new Set(universe);
  const seen = new Map<string, string>(); // member → first case label

  for (const c of rawCases) {
    // Dedup within a case — a member listed twice in ONE case is harmless (set semantics),
    // not a cross-case exclusivity violation.
    for (const m of new Set(c.members)) {
      if (!universeSet.has(m)) {
        overlaps.push(`case "${c.label}" lists "${m}" which is not in the domain universe`);
      }
      if (seen.has(m)) {
        overlaps.push(`member "${m}" appears in both "${seen.get(m)}" and "${c.label}"`);
      } else {
        seen.set(m, c.label);
      }
    }
  }
  for (const m of universe) {
    if (!seen.has(m)) gaps.push(`uncovered member "${m}"`);
  }
  return { gaps, overlaps };
}

export function handleCheckCasePartition(input: unknown, engine: EnforcementEngine): PartitionOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { type, min, max, values, cases } = validateInput(input);

  const { gaps, overlaps } =
    type === 'numeric' ? checkNumeric(min, max, cases as NumericCase[]) : checkEnum(values, cases as EnumCase[]);

  const blockingIssues: BlockingIssue[] = [];
  for (const g of gaps) {
    blockingIssues.push({ mechanism: 'partition_gap', description: `Not exhaustive — ${g}.`, severity: 'blocking' });
  }
  for (const o of overlaps) {
    blockingIssues.push({ mechanism: 'partition_overlap', description: `Not exclusive — ${o}.`, severity: 'blocking' });
  }

  const isMece = gaps.length === 0 && overlaps.length === 0;
  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, [], 'check_case_partition', undefined, context)
    : '';

  const output: PartitionOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    is_mece: isMece,
    gaps,
    overlaps,
    context_used: !!context,
  };
  if (hasFail) {
    output.enforcement = { blocking_issues: blockingIssues, warnings: [], corrective_prompt: correctivePrompt };
  }
  return output;
}
