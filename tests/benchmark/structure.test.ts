/**
 * LAYER 1A: Structural integrity tests
 *
 * Proves: "The benchmark infrastructure is correctly assembled."
 * These tests verify that scenarios, rubric, and runner are internally consistent.
 * No LLM calls. No benchmark execution. Pure structural checks.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BENCHMARK_DIR = resolve(__dirname, '../../benchmark');

function loadJSON(filename: string): unknown {
  const path = resolve(BENCHMARK_DIR, filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('Scenario structure', () => {
  const raw = loadJSON('scenarios.json') as {
    scenario_count: number;
    scenarios: Array<{
      id: string;
      category: string;
      tool: string;
      input: unknown;
      ground_truth: unknown;
      is_clean_control: boolean;
    }>;
  };

  it('scenario_count matches actual array length', () => {
    expect(raw.scenario_count).toBe(raw.scenarios.length);
  });

  it('every scenario has required fields', () => {
    for (const s of raw.scenarios) {
      expect(s.id).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(s.tool).toBeTruthy();
      expect(s.input).toBeTruthy();
      expect(s.ground_truth).toBeTruthy();
      expect(typeof s.is_clean_control).toBe('boolean');
    }
  });

  it('no duplicate scenario IDs', () => {
    const ids = raw.scenarios.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least 6 clean control scenarios', () => {
    const controls = raw.scenarios.filter(s => s.is_clean_control);
    expect(controls.length).toBeGreaterThanOrEqual(6);
  });

  it('has at least 21 defect scenarios', () => {
    const defects = raw.scenarios.filter(s => !s.is_clean_control);
    expect(defects.length).toBeGreaterThanOrEqual(21);
  });

  it('every scenario tool is a known tool handler', () => {
    const knownTools = [
      'validate_reasoning_chain',
      'check_numeric_claims',
      'detect_drift',
      'evaluate_tradeoffs',
      'check_plan_validity',
      'score_response_quality',
      'validate_confidence',
      'verify_arithmetic',
      'detect_concurrency_patterns',
    ];
    for (const s of raw.scenarios) {
      expect(knownTools).toContain(s.tool);
    }
  });
});

describe('Rubric structure', () => {
  const rubric = loadJSON('rubric.json') as {
    dimensions: Array<{ id: string; weight: number; levels: Record<string, string> }>;
    max_score_per_dimension: number;
    max_total_score: number;
  };

  it('has exactly 6 dimensions', () => {
    expect(rubric.dimensions.length).toBe(6);
  });

  it('dimension weights sum to 1.0', () => {
    const sum = rubric.dimensions.reduce((acc, d) => acc + d.weight, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('max_total_score equals dimensions * max_score_per_dimension', () => {
    expect(rubric.max_total_score).toBe(
      rubric.dimensions.length * rubric.max_score_per_dimension,
    );
  });

  it('every dimension has levels 0-3', () => {
    for (const d of rubric.dimensions) {
      expect(Object.keys(d.levels).sort()).toEqual(['0', '1', '2', '3']);
    }
  });

  it('dimension IDs match expected set', () => {
    const ids = rubric.dimensions.map(d => d.id).sort();
    expect(ids).toEqual([
      'assumption_honesty',
      'correctness',
      'logical_structure',
      'safety_readiness',
      'specificity',
      'tradeoff_quality',
    ]);
  });
});
