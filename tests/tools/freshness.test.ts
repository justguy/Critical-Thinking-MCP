/**
 * check_freshness — pure interval arithmetic over caller-supplied eval_time.
 * BLOCK only when authority='host'; agent-supplied time is warning-only.
 */

import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleCheckFreshness } from '../../src/tools/check_freshness.js';
import { handlePlanChecks } from '../../src/tools/plan_checks.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';

const engine = new EnforcementEngine();
const HOST = (value: string) => ({ value, authority: 'host' as const });
const AGENT = (value: string) => ({ value, authority: 'agent' as const });
const DAY = 86400;

describe('check_freshness', () => {
  it('fresh source within the window → PASS', () => {
    const out = handleCheckFreshness(
      {
        eval_time: HOST('2026-05-30T00:00:00Z'),
        max_age_seconds: 30 * DAY,
        requires_dated_sources: true,
        sources: [{ id: 's1', published_at: '2026-05-20T00:00:00Z' }],
      },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.results[0].status).toBe('fresh');
  });

  it('stale source under host authority + requires_dated → BLOCK', () => {
    const out = handleCheckFreshness(
      {
        eval_time: HOST('2026-05-30T00:00:00Z'),
        max_age_seconds: 7 * DAY,
        requires_dated_sources: true,
        sources: [{ id: 's1', published_at: '2026-01-01T00:00:00Z' }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.results[0].status).toBe('stale');
  });

  it('same stale source under AGENT authority → WARNING, not blocked', () => {
    const out = handleCheckFreshness(
      {
        eval_time: AGENT('2026-05-30T00:00:00Z'),
        max_age_seconds: 7 * DAY,
        requires_dated_sources: true,
        sources: [{ id: 's1', published_at: '2026-01-01T00:00:00Z' }],
      },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.enforcement?.warnings.length).toBeGreaterThan(0);
  });

  it('future-dated source under host authority → BLOCK (contradiction)', () => {
    const out = handleCheckFreshness(
      {
        eval_time: HOST('2026-05-30T00:00:00Z'),
        max_age_seconds: 365 * DAY,
        sources: [{ id: 's1', published_at: '2027-01-01T00:00:00Z' }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.results[0].status).toBe('future');
  });

  it('undated source: host + requires_dated → BLOCK; without requires_dated → warning', () => {
    const blocked = handleCheckFreshness(
      { eval_time: HOST('2026-05-30T00:00:00Z'), max_age_seconds: DAY, requires_dated_sources: true, sources: [{ id: 's1' }] },
      engine,
    );
    expect(blocked.status).toBe('ENFORCEMENT_FAIL');
    const warned = handleCheckFreshness(
      { eval_time: HOST('2026-05-30T00:00:00Z'), max_age_seconds: DAY, sources: [{ id: 's1' }] },
      engine,
    );
    expect(warned.status).toBe('PASS');
  });

  it('accepts epoch-ms eval_time and dates', () => {
    const out = handleCheckFreshness(
      { eval_time: HOST('1000000000000'), max_age_seconds: 10, sources: [{ id: 's1', published_at: '999999999000' }] },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.results[0].status).toBe('fresh');
  });

  it('unparseable eval_time → validation error', () => {
    expect(() =>
      handleCheckFreshness(
        { eval_time: HOST('not-a-date'), max_age_seconds: DAY, sources: [{ id: 's1' }] },
        engine,
      ),
    ).toThrow(/epoch-ms/);
  });

  it('STRICT timestamp policy (Option A): only epoch-ms or a fully-zoned datetime is accepted', () => {
    // offset-less datetime → rejected (host-timezone-dependent)
    expect(() =>
      handleCheckFreshness(
        { eval_time: HOST('2026-05-30T00:00:00'), max_age_seconds: DAY, sources: [{ id: 's1', published_at: '2026-05-29T00:00:00Z' }] },
        engine,
      ),
    ).toThrow(/zoned|rejected/);
    // date-only → rejected (ambiguous, not a point in time)
    expect(() =>
      handleCheckFreshness(
        { eval_time: HOST('2026-05-30'), max_age_seconds: 365 * DAY, sources: [{ id: 's1', published_at: '2026-05-01T00:00:00Z' }] },
        engine,
      ),
    ).toThrow(/zoned|rejected/);
    // offset-less published_at → rejected
    expect(() =>
      handleCheckFreshness(
        { eval_time: HOST('2026-05-30T00:00:00Z'), max_age_seconds: DAY, sources: [{ id: 's1', published_at: '2026-05-29T12:00:00' }] },
        engine,
      ),
    ).toThrow(/zoned|rejected/);
    // a fully-zoned datetime and epoch-ms are accepted
    expect(
      handleCheckFreshness(
        { eval_time: HOST('2026-05-30T00:00:00Z'), max_age_seconds: 365 * DAY, sources: [{ id: 's1', published_at: '2026-05-01T00:00:00+05:30' }] },
        engine,
      ).status,
    ).toBe('PASS');
  });
});

describe('planner + finalize freshness integration', () => {
  it('freshness with requires_dated_sources → check_freshness blocking + in finalize_required', () => {
    const plan = handlePlanChecks({
      contract: {
        task_type: 'factual_qa',
        evidence_level: 'none',
        risk_level: 'low',
        freshness: { max_age_seconds: 30 * DAY, requires_dated_sources: true },
      },
    });
    const fr = plan.required.find(r => r.check === 'check_freshness');
    expect(fr?.severity_on_fail).toBe('blocking');
    expect(plan.finalize_required).toContain('check_freshness');
  });

  it('finalize re-runs freshness inline → PASS on a fresh source', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: {
          contract_id: 'f1',
          contract_authority: 'host',
          profile_source: 'host_supplied',
          original_request_text: 'What is the latest pricing?',
          task_type: 'factual_qa',
          evidence_level: 'none',
          risk_level: 'low',
          freshness: { max_age_seconds: 30 * DAY, requires_dated_sources: true },
        },
        answer_text: 'Current pricing is $20/mo as of this month.',
        eval_time: HOST('2026-05-30T00:00:00Z'),
        sources: [{ id: 's1', text: 'Pricing: $20/mo.', published_at: '2026-05-20T00:00:00Z' }],
      },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.re_executed).toContain('check_freshness');
  });

  it('finalize BLOCKS a stale source', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: {
          contract_id: 'f1',
          contract_authority: 'host',
          profile_source: 'host_supplied',
          original_request_text: 'What is the latest pricing?',
          task_type: 'factual_qa',
          evidence_level: 'none',
          risk_level: 'low',
          freshness: { max_age_seconds: 7 * DAY, requires_dated_sources: true },
        },
        answer_text: 'Pricing is $20/mo.',
        eval_time: HOST('2026-05-30T00:00:00Z'),
        sources: [{ id: 's1', text: 'Pricing: $20/mo.', published_at: '2026-01-01T00:00:00Z' }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
  });

  it('finalize BLOCKS when freshness is required but eval_time is missing', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: {
          contract_id: 'f1',
          contract_authority: 'host',
          profile_source: 'host_supplied',
          original_request_text: 'latest pricing?',
          task_type: 'factual_qa',
          evidence_level: 'none',
          risk_level: 'low',
          freshness: { max_age_seconds: 7 * DAY, requires_dated_sources: true },
        },
        answer_text: 'Pricing is $20/mo.',
        sources: [{ id: 's1', text: 'x', published_at: '2026-05-20T00:00:00Z' }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'finalize_missing_inputs')).toBe(true);
  });
});
