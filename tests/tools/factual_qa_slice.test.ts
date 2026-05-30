/**
 * Factual-QA vertical slice — golden-path + adversarial tests.
 *
 * Verifies the deliverable loop: plan_checks → check_quote_grounding →
 * check_claim_coverage (advisory) → finalize_deliverable (re-executor).
 *
 * The discipline under test: BLOCK only on unforgeable within-request signals
 * (verbatim containment / re-execution); everything self-declared is WARNING.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handlePlanChecks } from '../../src/tools/plan_checks.js';
import { handleCheckQuoteGrounding } from '../../src/tools/check_quote_grounding.js';
import { handleCheckClaimCoverage } from '../../src/tools/check_claim_coverage.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures', 'factual_qa');
const loadGroundingInput = () =>
  JSON.parse(readFileSync(join(fixtures, 'golden_grounding.json'), 'utf8'));
const loadFinalizeInput = () =>
  JSON.parse(readFileSync(join(fixtures, 'golden_finalize.json'), 'utf8'));

const engine = new EnforcementEngine();

describe('plan_checks', () => {
  it('factual_qa + cited + low → quote_grounding is blocking and in finalize_required', () => {
    const out = handlePlanChecks({
      contract: { task_type: 'factual_qa', evidence_level: 'cited', risk_level: 'low' },
    });
    expect(out.status).toBe('PASS');
    const grounding = out.required.find(r => r.check === 'check_quote_grounding');
    expect(grounding?.severity_on_fail).toBe('blocking');
    expect(out.finalize_required).toContain('check_quote_grounding');
  });

  it('factual_qa + asserted → grounding is only a warning (not finalize_required)', () => {
    const out = handlePlanChecks({
      contract: { task_type: 'factual_qa', evidence_level: 'asserted', risk_level: 'low' },
    });
    const grounding = out.required.find(r => r.check === 'check_quote_grounding');
    expect(grounding?.severity_on_fail).toBe('warning');
    expect(out.finalize_required).not.toContain('check_quote_grounding');
  });

  it('claim_coverage never enters finalize_required (forgeable / advisory)', () => {
    const out = handlePlanChecks({
      contract: { task_type: 'factual_qa', evidence_level: 'rederived', risk_level: 'high' },
    });
    expect(out.finalize_required).not.toContain('check_claim_coverage');
  });
});

describe('check_quote_grounding', () => {
  it('golden path → PASS, grounded_ratio 1, witnesses minted', () => {
    const out = handleCheckQuoteGrounding(loadGroundingInput(), engine);
    expect(out.status).toBe('PASS');
    expect(out.grounded_ratio).toBe(1);
    expect(out.results[0].grounded).toBe(true);
    expect(out.results[0].claim_witness).toBeTruthy();
    expect(out.source_manifest_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fabricated span (not in source) → ENFORCEMENT_FAIL', () => {
    const input = loadGroundingInput();
    input.claims[0].quoted_span = 'Redis is fully multi-threaded by default';
    input.claims[0].supporting_token = 'multi-threaded';
    const out = handleCheckQuoteGrounding(input, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.description.includes('span_found_failure'))).toBe(true);
  });

  it('supporting_token not inside span → ENFORCEMENT_FAIL', () => {
    const input = loadGroundingInput();
    input.claims[0].supporting_token = 'multi-threaded';
    const out = handleCheckQuoteGrounding(input, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.description.includes('token_in_span_failure'))).toBe(true);
  });

  it('numeric claim with a swapped number → numeric_mismatch BLOCK', () => {
    const input = {
      sources: [{ id: 's1', text: 'The p99 latency is 100ms under nominal load.' }],
      claims: [
        {
          claim_id: 'n1',
          claim_text: 'p99 latency is 50ms',
          source_id: 's1',
          quoted_span: 'The p99 latency is 100ms under nominal load',
          supporting_token: '100ms',
          claim_kind: 'numeric',
        },
      ],
    };
    const out = handleCheckQuoteGrounding(input, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.description.includes('numeric_mismatch'))).toBe(true);
  });

  it('numeric claim with matching number → PASS', () => {
    const input = {
      sources: [{ id: 's1', text: 'The p99 latency is 100ms under nominal load.' }],
      claims: [
        {
          claim_id: 'n1',
          claim_text: 'p99 latency is 100ms',
          source_id: 's1',
          quoted_span: 'The p99 latency is 100ms under nominal load',
          supporting_token: '100ms',
          claim_kind: 'numeric',
        },
      ],
    };
    expect(handleCheckQuoteGrounding(input, engine).status).toBe('PASS');
  });

  it('causal/recommendation claims are weak support and never block', () => {
    const input = {
      sources: [{ id: 's1', text: 'High memory pressure correlates with increased eviction.' }],
      claims: [
        {
          claim_id: 'r1',
          claim_text: 'You should add memory because eviction rises under pressure',
          source_id: 's1',
          quoted_span: 'High memory pressure correlates with increased eviction',
          supporting_token: 'eviction',
          claim_kind: 'recommendation',
        },
      ],
    };
    const out = handleCheckQuoteGrounding(input, engine);
    expect(out.status).toBe('PASS');
    expect(out.results[0].support_strength).toBe('weak');
  });
});

describe('check_claim_coverage (advisory — never blocks)', () => {
  it('always returns PASS and surfaces unaccounted claim-like spans', () => {
    const out = handleCheckClaimCoverage({
      claims: [{ id: 'c1', text: 'Redis executes commands single-threaded' }],
      grounding_results: [{ claim_id: 'c1', grounded: true }],
      answer_text: 'Redis is single-threaded and handles 50000 ops/sec on a Mac Studio.',
    });
    expect(out.status).toBe('PASS');
    // "50000" is a claim-like number not present in any declared claim → flagged (warning).
    expect(out.auto_detected_unaccounted_claims.some(u => u.span.includes('50000'))).toBe(true);
    expect(out.declared_claim_coverage).toBe(1);
  });

  it('does not flag stop-listed numbers like "step 3"', () => {
    const out = handleCheckClaimCoverage({
      claims: [],
      answer_text: 'Follow step 3 and section 2 to configure it.',
      grounding_results: [],
    });
    expect(out.auto_detected_unaccounted_claims.length).toBe(0);
  });
});

describe('finalize_deliverable (re-executor)', () => {
  it('golden path → PASS, host_anchored, answer hash returned', () => {
    const out = handleFinalizeDeliverable(loadFinalizeInput(), engine);
    expect(out.status).toBe('PASS');
    expect(out.finalize_verdict).toBe('PASS');
    expect(out.contract_strength).toBe('host_anchored');
    expect(out.answer_text_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(out.required_checks).toContain('check_quote_grounding');
  });

  it('trimmed answer omitting a must_include string → BLOCK', () => {
    const input = loadFinalizeInput();
    input.answer_text = 'Redis handles commands in a way that affects blocking behaviour.'; // no "single-threaded"
    const out = handleFinalizeDeliverable(input, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'must_include')).toBe(true);
  });

  it('contract claim with no passing grounding on re-execution → BLOCK', () => {
    const input = loadFinalizeInput();
    input.contract.claims.push({ id: 'c2', text: 'Redis guarantees ACID across shards' });
    const out = handleFinalizeDeliverable(input, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'finalize_grounding')).toBe(true);
  });

  it('agent-authored contract → still re-executes, but warns weak_agent_declared', () => {
    const input = loadFinalizeInput();
    input.contract.contract_authority = 'agent';
    input.contract.profile_source = 'agent_declared';
    const out = handleFinalizeDeliverable(input, engine);
    expect(out.status).toBe('PASS');
    expect(out.contract_strength).toBe('weak_agent_declared');
    expect(out.enforcement?.warnings.some(w => w.includes('weak_agent_declared'))).toBe(true);
  });

  it('fabricated grounding span fails on re-execution (cannot be smuggled past finalize)', () => {
    const input = loadFinalizeInput();
    input.claims[0].quoted_span = 'Redis is fully multi-threaded';
    const out = handleFinalizeDeliverable(input, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
  });
});
