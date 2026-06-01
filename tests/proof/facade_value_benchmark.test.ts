import { describe, expect, it } from 'vitest';

import {
  DEBUG_RAW_TOOL_SURFACE,
  PRODUCT_FACADE_TOOL_SURFACE,
  PRODUCT_VALUE_MODES,
  getFacadeBenchmarkCorpus,
  getToolSurface,
  runFacadeValueBenchmark,
  scoreFacadeCandidate,
} from '../../benchmark/proof/facade_value_benchmark.js';

const REQUIRED_METRICS = [
  'task_success_rate',
  'high_sev_defects_per_task',
  'unsupported_claims_per_task',
  'wrong_numbers_per_task',
  'constraint_violations_per_task',
  'false_done_rate',
  'false_block_rate_clean_controls',
  'artifact_formatting_failures_per_task',
  'avg_revision_count',
  'excessive_revision_loops_per_task',
  'correction_success_rate',
  'task_success_delta_vs_baseline',
  'avoided_high_sev_defects_per_task',
  'avoided_false_done_rate',
  'net_value',
  'avg_latency_ms',
  'avg_tool_calls',
  'avg_tool_choice_confusions',
  'exposed_tools_count',
] as const;

describe('facade value benchmark corpus', () => {
  it('has a fixed no-LLM corpus with clean and adversarial cases', () => {
    const corpus = getFacadeBenchmarkCorpus();
    expect(corpus.length).toBeGreaterThanOrEqual(5);
    expect(corpus.some(t => !t.adversarial)).toBe(true);
    expect(corpus.some(t => t.adversarial)).toBe(true);
    expect(corpus.map(t => t.id)).toEqual([
      'N_clean_sum',
      'N_wrong_sum',
      'F_unsupported_reset',
      'C_price_constraint',
      'H_anti_swap',
    ]);
  });

  it('uses objective fixture scoring without model judgment', () => {
    const resetTask = getFacadeBenchmarkCorpus().find(t => t.id === 'F_unsupported_reset')!;
    const bad = scoreFacadeCandidate(
      resetTask,
      'The service allows 100 requests per minute, and the limit resets every minute.',
    );
    const good = scoreFacadeCandidate(
      resetTask,
      'The service rate limit is 100 requests per minute. The source does not state how often the limit resets.',
    );

    expect(bad.unsupported_claims).toBeGreaterThan(0);
    expect(bad.task_success).toBe(false);
    expect(good).toMatchObject({
      task_success: true,
      unsupported_claims: 0,
      wrong_numbers: 0,
      constraint_violations: 0,
    });
  });
});

describe('facade value benchmark runner', () => {
  it('is deterministic and reports the required product-value modes and metrics', () => {
    const first = runFacadeValueBenchmark();
    const second = runFacadeValueBenchmark();

    expect(first).toEqual(second);
    expect(first.modes).toEqual([...PRODUCT_VALUE_MODES]);
    expect(first.proof_boundary.oracle).toBe('deterministic_fixture_grader_no_llm');
    expect(first.proof_boundary.correctness_proof_claim).toContain('gate mechanics');
    expect(first.proof_boundary.product_value_claim).toContain('fixed no-LLM corpus');
    expect(first.proof_boundary.product_value_claim).toContain('not live agent product-value proof');

    for (const mode of PRODUCT_VALUE_MODES) {
      for (const key of REQUIRED_METRICS) {
        expect(first.metrics_by_mode[mode]).toHaveProperty(key);
      }
    }
  });

  it('keeps the raw debug surface out of product-value modes', () => {
    const report = runFacadeValueBenchmark();
    const rawOnly = new Set([
      'check_quote_grounding',
      'check_claim_coverage',
      'trace_conclusion_numbers',
      'check_answer_against_constraints',
      'check_freshness',
      'check_case_partition',
    ]);

    expect(report.diagnostic_conditions).toEqual([]);
    expect(DEBUG_RAW_TOOL_SURFACE.length).toBe(17);
    expect([...PRODUCT_FACADE_TOOL_SURFACE]).toEqual(['plan_checks', 'finalize_deliverable']);

    for (const mode of PRODUCT_VALUE_MODES) {
      expect(getToolSurface(mode).some(tool => rawOnly.has(tool))).toBe(false);
      expect(report.metrics_by_mode[mode].exposed_tools_count).toBeLessThan(DEBUG_RAW_TOOL_SURFACE.length);
    }
  });

  it('shows host-contract fixture mode reduces false done relative to weaker fixture modes', () => {
    const report = runFacadeValueBenchmark();

    expect(report.metrics_by_mode.enforced_host_contract.false_done_rate)
      .toBeLessThan(report.metrics_by_mode.baseline.false_done_rate);
    expect(report.metrics_by_mode.enforced_host_contract.false_done_rate)
      .toBeLessThan(report.metrics_by_mode.enforced.false_done_rate);
    expect(report.metrics_by_mode.enforced_host_contract.unsupported_claims_per_task)
      .toBeLessThan(report.metrics_by_mode.baseline.unsupported_claims_per_task);
    expect(report.metrics_by_mode.enforced_host_contract.constraint_violations_per_task)
      .toBeLessThan(report.metrics_by_mode.enforced.constraint_violations_per_task);
    expect(report.metrics_by_mode.enforced_host_contract.net_value)
      .toBeGreaterThan(report.metrics_by_mode.baseline.net_value);
  });

  it('preserves the enforced vs host-contract distinction with weak contracts and anti-swap', () => {
    const report = runFacadeValueBenchmark();
    const weakReset = report.results.find(r => r.mode === 'enforced' && r.task_id === 'F_unsupported_reset')!;
    const weakConstraint = report.results.find(r => r.mode === 'enforced' && r.task_id === 'C_price_constraint')!;
    const hostSwap = report.results.find(r => r.mode === 'enforced_host_contract' && r.task_id === 'H_anti_swap')!;

    expect(weakReset.released).toBe(true);
    expect(weakReset.false_done).toBe(true);
    expect(weakReset.contract_strength).toBe('weak_agent_declared');
    expect(weakConstraint.released).toBe(true);
    expect(weakConstraint.false_done).toBe(true);

    expect(hostSwap.released).toBe(false);
    expect(hostSwap.release_decision).toBe('REJECT');
    expect(hostSwap.reject_reason).toBe('hash_mismatch');
    expect(hostSwap.false_done).toBe(false);
  });

  it('keeps raw/debug as a separate diagnostic condition and measures facade confusion only there', () => {
    const report = runFacadeValueBenchmark({ includeDebugRaw: true });

    expect(report.modes).toEqual([...PRODUCT_VALUE_MODES, 'debug_raw']);
    expect(report.diagnostic_conditions).toEqual(['debug_raw']);
    expect(report.tool_surfaces.debug_raw).toEqual(DEBUG_RAW_TOOL_SURFACE);
    expect(report.metrics_by_mode.debug_raw.exposed_tools_count).toBe(17);
    expect(report.metrics_by_mode.debug_raw.avg_tool_choice_confusions)
      .toBeGreaterThan(report.metrics_by_mode.enforced_host_contract.avg_tool_choice_confusions);
    expect(report.metrics_by_mode.debug_raw.avg_tool_calls)
      .toBeGreaterThan(report.metrics_by_mode.enforced_host_contract.avg_tool_calls);
  });
});
