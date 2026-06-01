import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const cliPath = fileURLToPath(new URL('../../src/host/cli.ts', import.meta.url));

const releaseInput = {
  spec: {
    contract_id: 'cli-freeform-1',
    original_request_text: 'Return ok.',
    task_type: 'freeform',
    evidence_level: 'none',
    risk_level: 'low',
  },
  artifacts: {
    answer_text: 'ok',
  },
};

function runCli(input: unknown, args: string[] = []): { status: number | null; stdout: string; stderr: string; json: any } {
  const result = spawnSync(process.execPath, ['--import', 'tsx', cliPath, ...args], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: JSON.parse(result.stdout),
  };
}

describe('ct-enforce CLI', () => {
  it('returns RELEASE JSON with exit 0 for a strict host-anchored success path', () => {
    const result = runCli(releaseInput);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.json.decision).toBe('RELEASE');
    expect(result.json.reason).toBe('released');
    expect(result.json.contract_strength).toBe('host_anchored');
  });

  it('returns gate-block JSON with exit 1 when required artifacts are missing', () => {
    const result = runCli({
      spec: {
        contract_id: 'cli-factual-1',
        original_request_text: 'Is Redis single-threaded for command execution?',
        task_type: 'factual_qa',
        evidence_level: 'cited',
        risk_level: 'high',
        claims: [{ id: 'cl1', text: 'Redis executes commands single-threaded' }],
      },
      artifacts: {
        answer_text: 'Redis executes commands single-threaded.',
      },
    });

    expect(result.status).toBe(1);
    expect(result.json.decision).toBe('REJECT');
    expect(result.json.reason).toBe('gate_block');
    expect(result.json.blocking_issues.some((issue: any) => issue.mechanism === 'finalize_missing_inputs')).toBe(true);
  });

  it('returns hash-mismatch JSON with exit 3 when surfaced answer differs', () => {
    const result = runCli({
      ...releaseInput,
      surfaced_answer: 'ok plus unchecked text',
    });

    expect(result.status).toBe(3);
    expect(result.json.decision).toBe('REJECT');
    expect(result.json.reason).toBe('hash_mismatch');
    expect(result.json.surfaced_answer_hash).not.toBe(result.json.answer_text_hash);
  });

  it('returns input-error JSON with exit 2 for missing host-authored spec', () => {
    const result = runCli({
      artifacts: {
        answer_text: 'ok',
      },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toBe('');
    expect(result.json.decision).toBe('ERROR');
    expect(result.json.reason).toBe('input_error');
    expect(result.json.error.code).toBe('invalid_input');
  });

  it('returns invalid-json JSON with exit 2', () => {
    const result = runCli('{not-json');

    expect(result.status).toBe(2);
    expect(result.json.decision).toBe('ERROR');
    expect(result.json.error.code).toBe('invalid_json');
  });
});
