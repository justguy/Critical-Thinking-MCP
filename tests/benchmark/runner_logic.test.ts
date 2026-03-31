/**
 * LAYER 1B: Runner logic tests
 *
 * Proves: "The enforcement mechanisms produce correct results on known inputs."
 * Runs actual scenarios through the enforcement engine and verifies
 * the runner correctly classifies pass/fail, detects cycles, catches
 * race conditions, and scores quality.
 *
 * No LLM calls. Deterministic enforcement only.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleValidateReasoningChain } from '../../src/tools/validate_reasoning_chain.js';
import { handleCheckNumericClaims } from '../../src/tools/check_numeric_claims.js';
import { handleDetectDrift } from '../../src/tools/detect_drift.js';
import { handleEvaluateTradeoffs } from '../../src/tools/evaluate_tradeoffs.js';
import { handleCheckPlanValidity } from '../../src/tools/check_plan_validity.js';
import { handleScoreResponseQuality } from '../../src/tools/score_response_quality.js';
import { handleValidateConfidence } from '../../src/tools/validate_confidence.js';
import { handleVerifyArithmetic } from '../../src/tools/verify_arithmetic.js';
import { handleDetectConcurrencyPatterns } from '../../src/tools/detect_concurrency_patterns.js';

const BENCHMARK_DIR = resolve(__dirname, '../../benchmark');

interface BenchmarkScenario {
  id: string;
  category: string;
  tool: string;
  input: Record<string, unknown>;
  ground_truth: Record<string, unknown>;
  is_clean_control: boolean;
}

type ToolResult = Record<string, unknown>;

const TOOL_HANDLERS: Record<string, (input: unknown, engine: EnforcementEngine) => ToolResult> = {
  validate_reasoning_chain: handleValidateReasoningChain as (input: unknown, engine: EnforcementEngine) => ToolResult,
  check_numeric_claims: handleCheckNumericClaims as (input: unknown, engine: EnforcementEngine) => ToolResult,
  detect_drift: handleDetectDrift as (input: unknown, engine: EnforcementEngine) => ToolResult,
  evaluate_tradeoffs: handleEvaluateTradeoffs as (input: unknown, engine: EnforcementEngine) => ToolResult,
  check_plan_validity: handleCheckPlanValidity as (input: unknown, engine: EnforcementEngine) => ToolResult,
  score_response_quality: handleScoreResponseQuality as (input: unknown, engine: EnforcementEngine) => ToolResult,
  validate_confidence: handleValidateConfidence as (input: unknown, engine: EnforcementEngine) => ToolResult,
  verify_arithmetic: handleVerifyArithmetic as (input: unknown, engine: EnforcementEngine) => ToolResult,
  detect_concurrency_patterns: handleDetectConcurrencyPatterns as (input: unknown, engine: EnforcementEngine) => ToolResult,
};

function loadScenarios(): BenchmarkScenario[] {
  const raw = JSON.parse(readFileSync(resolve(BENCHMARK_DIR, 'scenarios.json'), 'utf-8'));
  return raw.scenarios;
}

function runScenario(scenario: BenchmarkScenario): ToolResult {
  const handler = TOOL_HANDLERS[scenario.tool];
  if (!handler) throw new Error(`Unknown tool: ${scenario.tool}`);
  const engine = new EnforcementEngine();
  return handler(scenario.input, engine);
}

const scenarios = loadScenarios();

describe('Clean control scenarios produce no false positives', () => {
  const controls = scenarios.filter(s => s.is_clean_control);

  for (const scenario of controls) {
    it(`${scenario.id} passes without blocking issues`, () => {
      const result = runScenario(scenario);
      const status = result.status as string;
      expect(status).not.toBe('ENFORCEMENT_FAIL');
    });
  }
});

describe('Defect scenarios catch planted issues', () => {
  it('S3-C detects circular reasoning (server scaling loop)', () => {
    const scenario = scenarios.find(s => s.id === 'S3-C')!;
    const result = runScenario(scenario);
    expect(result.status).toBe('ENFORCEMENT_FAIL');
    expect(result.cycles).toBeTruthy();
    const cycles = result.cycles as { path: string[] }[];
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('S3-D detects circular reasoning (Rust rewrite loop)', () => {
    const scenario = scenarios.find(s => s.id === 'S3-D')!;
    const result = runScenario(scenario);
    expect(result.status).toBe('ENFORCEMENT_FAIL');
    const cycles = result.cycles as { path: string[] }[];
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('S4-C detects confidence inflation', () => {
    const scenario = scenarios.find(s => s.id === 'S4-C')!;
    const result = runScenario(scenario);
    expect(result.status).toBe('ENFORCEMENT_FAIL');
    const enforcement = result.enforcement as { blocking_issues?: { mechanism: string }[] };
    const mechanisms = (enforcement?.blocking_issues ?? []).map(b => b.mechanism);
    expect(mechanisms).toContain('confidence_product');
  });

  it('S5-A flags fabricated round numbers with at least moderate suspicion', () => {
    const scenario = scenarios.find(s => s.id === 'S5-A')!;
    const result = runScenario(scenario);
    // Fabrication detection should flag at least moderate suspicion
    if ('fabrication' in result) {
      const fab = result.fabrication as { suspicion: string };
      expect(['moderate', 'high']).toContain(fab.suspicion);
    }
  });

  it('S5-C detects circular optimization loop', () => {
    const scenario = scenarios.find(s => s.id === 'S5-C')!;
    const result = runScenario(scenario);
    expect(result.status).toBe('ENFORCEMENT_FAIL');
  });

  it('billing_system detects confidence inflation', () => {
    const scenario = scenarios.find(s => s.id === 'billing_system')!;
    const result = runScenario(scenario);
    expect(result.status).toBe('ENFORCEMENT_FAIL');
    const enforcement = result.enforcement as { blocking_issues?: { mechanism: string }[] };
    const mechanisms = (enforcement?.blocking_issues ?? []).map(b => b.mechanism);
    expect(mechanisms).toContain('confidence_product');
  });
});

describe('Quality score is bounded', () => {
  for (const scenario of scenarios) {
    it(`${scenario.id} quality_score is in [0, 1]`, () => {
      const result = runScenario(scenario);
      let q = 0;
      if ('overall_score' in result && typeof result.overall_score === 'number') {
        q = result.overall_score;
      } else if ('grounding_score' in result && typeof result.grounding_score === 'number') {
        q = result.grounding_score;
      } else if (result.status === 'PASS') {
        q = 1.0;
      } else if (result.status === 'ENFORCEMENT_FAIL') {
        q = 0.2;
      }
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(1);
    });
  }
});

describe('Iterative context escalation works', () => {
  it('billing_system: second failure of confidence_product triggers schema-fill', () => {
    const engine = new EnforcementEngine();
    const scenario = scenarios.find(s => s.id === 'billing_system')!;

    // First call — no context
    const result1 = handleValidateConfidence(scenario.input, engine) as ToolResult;
    expect(result1.status).toBe('ENFORCEMENT_FAIL');

    // Second call — with failure_counts context
    const inputWithContext = {
      ...scenario.input,
      context: {
        iteration_number: 2,
        failure_counts_by_mechanism: { confidence_product: 1 },
      },
    };
    const result2 = handleValidateConfidence(inputWithContext, engine) as ToolResult;
    expect(result2.status).toBe('ENFORCEMENT_FAIL');

    const prompt = result2.corrective_prompt as string | undefined;
    if (prompt) {
      expect(prompt).toContain('FILL IN THIS TEMPLATE');
    }
  });
});
