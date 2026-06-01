import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function readJsonl(file: string): Array<Record<string, unknown>> {
  return readFileSync(file, 'utf8')
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

const REQUIRED_RESULT_FIELDS = [
  'run_id',
  'mode',
  'ablation_id',
  'corpus_version',
  'oracle',
  'seed_or_directional',
  'task_count',
  'task_success',
  'task_success_delta',
  'high_severity_defects',
  'medium_severity_defects',
  'high_severity_defects_avoided',
  'medium_severity_defects_avoided',
  'unsupported_claims',
  'wrong_numbers',
  'constraint_violations',
  'false_done',
  'avoided_false_done',
  'false_blocks',
  'false_block_rate_clean_controls',
  'artifact_formatting_failures',
  'revision_count',
  'excessive_revision_loops',
  'average_latency_ms',
  'latency_penalty',
  'average_tool_calls',
  'correction_success_rate',
  'net_value',
] as const;

const REQUIRED_BACKLOG_FIELDS = [
  'intervention',
  'failure_modes_addressed',
  'affected_tasks',
  'critical_count',
  'high_count',
  'medium_count',
  'low_count',
  'preventability',
  'confidence',
  'affected_workflow_importance',
  'implementation_cost',
  'friction_risk',
  'value_score',
  'recommended_action',
  'minimum_viable_change',
] as const;

describe('value discovery artifact contracts', () => {
  const tasks = readJsonl('benchmark/tasks/value_discovery_seed.jsonl');
  const defects = readJsonl('benchmark/defects/value_discovery_seed.jsonl');
  const backlog = readJsonl('VALUE_BACKLOG.jsonl');
  const results = readJsonl('benchmark/results/value_discovery_seed.jsonl');

  it('keeps every seed defect linked to a task record', () => {
    const taskIds = new Set(tasks.map(task => task.task_id));

    expect(tasks.length).toBeGreaterThanOrEqual(6);
    expect(defects.map(defect => defect.task_id).filter(taskId => !taskIds.has(taskId))).toEqual([]);
  });

  it('keeps backlog entries machine-readable and provenance-labeled', () => {
    expect(backlog.length).toBeGreaterThanOrEqual(5);

    for (const entry of backlog) {
      for (const field of REQUIRED_BACKLOG_FIELDS) expect(entry).toHaveProperty(field);

      expect(Array.isArray(entry.failure_modes_addressed)).toBe(true);
      expect(Array.isArray(entry.affected_tasks)).toBe(true);
      expect(['build', 'prototype', 'defer', 'kill']).toContain(entry.recommended_action);

      if ((entry.affected_tasks as unknown[]).length === 0) {
        expect(entry).toHaveProperty('score_basis');
      }
    }
  });

  it('keeps benchmark result rows aligned with the Tier 4A result schema', () => {
    expect(results.length).toBeGreaterThanOrEqual(2);

    for (const result of results) {
      for (const field of REQUIRED_RESULT_FIELDS) expect(result).toHaveProperty(field);

      expect(result.ablation_id).toBe('enforced_current');
      expect(result.seed_or_directional).toBe(true);
      expect(typeof result.net_value).toBe('number');
    }
  });
});
