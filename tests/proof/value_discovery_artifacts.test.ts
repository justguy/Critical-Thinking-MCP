import { readFileSync } from 'node:fs';

import Ajv, { type AnySchema } from 'ajv';
import { describe, expect, it } from 'vitest';

function readJsonl(file: string): Array<Record<string, unknown>> {
  return readFileSync(file, 'utf8')
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function validateRecords(
  file: string,
  records: Array<Record<string, unknown>>,
  schemaPath: string,
): Array<{ index: number; errors: unknown }> {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(readJson(schemaPath) as AnySchema);
  const failures: Array<{ index: number; errors: unknown }> = [];
  records.forEach((record, index) => {
    if (!validate(record)) failures.push({ index, errors: validate.errors });
  });
  return failures.map(failure => ({ ...failure, file }));
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
  const report = readFileSync('VALUE_GAP_REPORT.md', 'utf8');
  const taskIds = new Set(tasks.map(task => task.task_id));
  const defectsByTask = new Map<string, Array<Record<string, unknown>>>();
  for (const defect of defects) {
    const taskId = String(defect.task_id);
    defectsByTask.set(taskId, [...(defectsByTask.get(taskId) ?? []), defect]);
  }

  it('validates all Tier 4A JSONL artifacts against executable schemas', () => {
    expect(validateRecords('benchmark/tasks/value_discovery_seed.jsonl', tasks, 'benchmark/schemas/value-task.schema.json')).toEqual([]);
    expect(validateRecords('benchmark/defects/value_discovery_seed.jsonl', defects, 'benchmark/schemas/value-defect.schema.json')).toEqual([]);
    expect(validateRecords('VALUE_BACKLOG.jsonl', backlog, 'benchmark/schemas/value-backlog.schema.json')).toEqual([]);
    expect(validateRecords('benchmark/results/value_discovery_seed.jsonl', results, 'benchmark/schemas/value-result.schema.json')).toEqual([]);
  });

  it('keeps every seed defect linked to a task record', () => {
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
      expect(typeof entry.value_score).toBe('number');
      expect(Number.isFinite(entry.value_score as number)).toBe(true);
      expect(entry.implementation_cost as number).toBeGreaterThan(0);
      expect(entry.preventability as number).toBeGreaterThanOrEqual(0);
      expect(entry.preventability as number).toBeLessThanOrEqual(1);
      expect(entry.confidence as number).toBeGreaterThanOrEqual(0);
      expect(entry.confidence as number).toBeLessThanOrEqual(1);

      const affectedTasks = entry.affected_tasks as string[];
      expect(affectedTasks.filter(taskId => !taskIds.has(taskId))).toEqual([]);

      if (affectedTasks.length === 0) {
        expect(entry).toHaveProperty('score_basis');
      } else {
        const escapeReasons = new Set(
          affectedTasks.flatMap(taskId => (defectsByTask.get(taskId) ?? []).map(defect => defect.escape_reason)),
        );
        expect((entry.failure_modes_addressed as string[]).some(mode => escapeReasons.has(mode))).toBe(true);
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
      expect(result.task_success as number).toBeLessThanOrEqual(result.task_count as number);
      expect(result.high_severity_defects_avoided as number).toBeLessThanOrEqual(
        (result.high_severity_defects as number) + (result.high_severity_defects_avoided as number),
      );

      if (result.average_latency_ms === null || result.average_tool_calls === null) {
        expect(result.seed_or_directional).toBe(true);
        expect(String(result.notes)).toMatch(/not captured/i);
      }
    }
  });

  it('does not let seed-sized corpora masquerade as product-value proof', () => {
    if (tasks.length < 150) {
      expect(results.every(result => result.seed_or_directional === true)).toBe(true);
      expect(report).toContain('not the final product-value benchmark');
      expect(report).toContain('should not be used to claim broad product value');
    }
  });
});
