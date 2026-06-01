/**
 * Host-enforcement layer: the deterministic gate that makes finalize PASS mandatory,
 * verifies the anti-swap hash, and hands back a corrective_prompt on reject.
 */
import { describe, it, expect } from 'vitest';

import { enforceDeliverable, type ContractSpec, type DeliverableArtifacts } from '../../src/host/enforcement_host.js';
import { sha256Hex } from '../../src/enforcement/utils.js';
import type { FinalizeOutput } from '../../src/tools/finalize_deliverable.js';

const factualSpec = (over: Partial<ContractSpec> = {}): ContractSpec => ({
  contract_id: 'h1',
  original_request_text: 'Is Redis single-threaded for command execution?',
  task_type: 'factual_qa',
  evidence_level: 'cited',
  risk_level: 'high',
  claims: [{ id: 'cl1', text: 'Redis executes commands single-threaded' }],
  ...over,
});

const groundedArtifacts = (answer = 'Redis executes commands single-threaded.'): DeliverableArtifacts => ({
  answer_text: answer,
  sources: [{ id: 's1', text: 'Redis is single-threaded for command execution.' }],
  claims: [
    { claim_id: 'cl1', claim_text: 'Redis executes commands single-threaded', source_id: 's1', quoted_span: 'Redis is single-threaded for command execution', supporting_token: 'single-threaded', claim_kind: 'status' },
  ],
});

const passingFinalize = (
  answerText: string,
  contractStrength: FinalizeOutput['contract_strength'],
): FinalizeOutput => ({
  status: 'PASS',
  finalize_verdict: 'PASS',
  answer_text_hash: sha256Hex(answerText),
  answer_text_length: answerText.length,
  required_checks: [],
  re_executed: [],
  contract_strength: contractStrength,
  context_used: false,
});

describe('enforceDeliverable', () => {
  it('RELEASES a clean, grounded, high-risk deliverable (verify-if-present fix holds end-to-end)', () => {
    const d = enforceDeliverable(factualSpec(), groundedArtifacts());
    expect(d.decision).toBe('RELEASE');
    expect(d.finalize_verdict).toBe('PASS');
    expect(d.contract_strength).toBe('host_anchored');
    expect(d.surfaced_answer_hash).toBe(d.answer_text_hash);
  });

  it('REJECTS (gate_block) a fabricated quote and surfaces a corrective_prompt', () => {
    const bad = groundedArtifacts();
    bad.claims![0].quoted_span = 'Redis uses multiple threads for command execution'; // not in source
    const d = enforceDeliverable(factualSpec({ claims: [{ id: 'cl1', text: 'Redis uses multiple threads' }] }), { ...bad, answer_text: 'Redis uses multiple threads.' });
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('gate_block');
    expect(d.corrective_prompt.length).toBeGreaterThan(0);
    expect(d.blocking_issues.length).toBeGreaterThan(0);
  });

  it('REJECTS (gate_block) when a required check\'s artifacts are missing', () => {
    const d = enforceDeliverable(factualSpec(), { answer_text: 'Redis executes commands single-threaded.' }); // no sources/claims
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('gate_block');
    expect(d.blocking_issues.some(i => i.mechanism === 'finalize_missing_inputs')).toBe(true);
  });

  it('REJECTS (hash_mismatch) when the surfaced answer differs from what was checked (anti-swap)', () => {
    const d = enforceDeliverable(factualSpec(), groundedArtifacts(), {
      surfaced_answer: 'Redis executes commands single-threaded. P.S. it is also the fastest database ever.',
    });
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('hash_mismatch');
    expect(d.surfaced_answer_hash).not.toBe(d.answer_text_hash);
  });

  it('RELEASES a correct high-risk numeric deliverable with NO constraints/freshness artifacts', () => {
    const d = enforceDeliverable(
      { contract_id: 'h2', original_request_text: 'What is 120 plus 30?', task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'high' },
      {
        answer_text: 'The total is 150.',
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
        arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 150 }],
      },
    );
    expect(d.decision).toBe('RELEASE');
  });

  it('REJECTS a wrong number (re-derivation mismatch)', () => {
    const d = enforceDeliverable(
      { contract_id: 'h3', original_request_text: 'What is 120 plus 30?', task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'high' },
      {
        answer_text: 'The total is 200.',
        inputs: [120, 30],
        conclusion_numbers: [{ value: 200, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
        arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 200 }],
      },
    );
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('gate_block');
  });

  it('REJECTS whitespace-significant surfaced swaps with exact anti-swap hash', () => {
    const d = enforceDeliverable(
      { contract_id: 'h4', original_request_text: 'Return exact Python snippet.', task_type: 'freeform', evidence_level: 'none', risk_level: 'low' },
      { answer_text: 'if is_admin:\n    allow()\nelse:\n    deny()' },
      { surfaced_answer: 'if is_admin: allow() else: deny()' },
    );
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('hash_mismatch');
  });

  it('REJECTS weak agent-declared finalize output in strict_release mode', () => {
    const answer = 'Weak contract answer.';
    const d = enforceDeliverable(
      factualSpec({ evidence_level: 'none', risk_level: 'low', claims: [] }),
      { answer_text: answer },
      { strict_release: true, finalize: () => passingFinalize(answer, 'weak_agent_declared') },
    );

    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('contract_not_host_anchored');
    expect(d.finalize_verdict).toBe('PASS');
    expect(d.blocking_issues.some(issue => issue.mechanism === 'strict_host_contract_required')).toBe(true);
    expect(d.corrective_prompt).toContain('host boundary');
  });

  it('REJECTS missing finalize contract strength in strict_release mode', () => {
    const answer = 'Missing contract strength answer.';
    const weakOutput = passingFinalize(answer, 'host_anchored') as Partial<FinalizeOutput>;
    delete weakOutput.contract_strength;

    const d = enforceDeliverable(
      factualSpec({ evidence_level: 'none', risk_level: 'low', claims: [] }),
      { answer_text: answer },
      { strict_release: true, finalize: () => weakOutput as FinalizeOutput },
    );

    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('contract_not_host_anchored');
    expect(d.blocking_issues.some(issue => issue.description.includes('undefined'))).toBe(true);
  });
});
