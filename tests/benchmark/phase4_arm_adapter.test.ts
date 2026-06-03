import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { billedTokens, parseStreamJson, type ArmTranscript } from '../../benchmark/phase4/arm_adapter.js';

// NO model calls anywhere in this suite. parseStreamJson + billedTokens are
// PURE and are exercised against the REAL captured arm-B transcript from STEP-1
// (benchmark/phase4/step1_smoke_B_raw.jsonl). Assertions mirror the values
// recorded in STEP1_FINDINGS.md so a parser regression is caught immediately.

const fixturePath = fileURLToPath(new URL('../../benchmark/phase4/step1_smoke_B_raw.jsonl', import.meta.url));
const raw = readFileSync(fixturePath, 'utf-8');
const t: ArmTranscript = parseStreamJson(raw);

describe('parseStreamJson against the STEP-1 arm-B fixture', () => {
  it('reports ct-mcp connected', () => {
    const ct = t.mcp_servers.find(s => s.name === 'ct-mcp');
    expect(ct?.status).toBe('connected');
  });

  it('advertises exactly 11 ct-mcp tools (arm B surface)', () => {
    expect(t.advertised_ct_tools).toHaveLength(11);
    expect(t.advertised_ct_tools).toContain('mcp__ct-mcp__finalize_deliverable');
  });

  it('fires at least one check_numeric_claims tool_use', () => {
    const numeric = t.tool_uses.filter(u => u.name.includes('check_numeric_claims'));
    expect(numeric.length).toBeGreaterThanOrEqual(1);
  });

  it('captures every finalize_deliverable result, incl. the bound one', () => {
    // STEP-1 emitted 22 finalize calls (many errored pre-binding) — all captured.
    const bound = t.finalize_bindings.filter(b => b.answer_text_hash && b.plan_token);
    expect(bound.length).toBeGreaterThanOrEqual(1);
    const first = bound[0];
    expect(first.answer_text_hash).toMatch(/^39fad8f4/);
    expect(first.plan_token).toMatch(/^ctmcp\.plan_token\.v1\./);
  });

  it('recovers the authoritative top-level usage ledger (Amendment A3)', () => {
    expect(t.usage.output_tokens).toBe(14890);
    expect(t.usage.cache_read_input_tokens).toBe(1380230);
    expect(t.usage.input_tokens).toBe(194);
    expect(t.usage.cache_creation_input_tokens).toBe(83244);
  });

  it('recovers num_turns and an empty permission_denials', () => {
    expect(t.num_turns).toBe(25);
    expect(t.permission_denials).toEqual([]);
  });

  it('extracts the FINAL ANSWER sentinel and a success subtype', () => {
    expect(t.final_answer_sentinel).toBe('78.89');
    expect(t.result_subtype).toBe('success');
  });
});

describe('billedTokens discount weighting', () => {
  it('charges the cache-read tail far below the raw sum (efficiency guard)', () => {
    const rawSum =
      t.usage.input_tokens +
      t.usage.output_tokens +
      t.usage.cache_creation_input_tokens +
      t.usage.cache_read_input_tokens;
    const billed = billedTokens(t.usage);
    // Default weights (cache_read 0.1×, cache_creation 1.25×) must discount the
    // 1.38M-token cache_read tail far below face value.
    expect(billed).toBeLessThan(rawSum);
    expect(billed).toBeLessThan(rawSum * 0.5);
  });

  it('honors custom weights', () => {
    const allOnes = billedTokens(t.usage, { cacheReadWeight: 1, cacheCreationWeight: 1 });
    const rawSum =
      t.usage.input_tokens +
      t.usage.output_tokens +
      t.usage.cache_creation_input_tokens +
      t.usage.cache_read_input_tokens;
    expect(allOnes).toBeCloseTo(rawSum, 6);
  });
});
