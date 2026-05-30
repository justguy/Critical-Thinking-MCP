/**
 * check_freshness — staleness of dated sources, by pure interval arithmetic.
 *
 * The server has NO trusted clock (reading one would break determinism/replay and
 * the clean-control record), so the caller supplies eval_time with an explicit
 * authority. The tool compares each source's published_at against eval_time.
 *
 * BLOCK (only when eval_time.authority === 'host' — the trust boundary is explicit):
 *   - a source published AFTER eval_time (a contradiction in the supplied data)
 *   - if requires_dated_sources: a stale or undated source
 * WARNING:
 *   - agent-supplied eval_time: any staleness/future/undated (self-graded time)
 *   - host eval_time without requires_dated_sources: stale/undated sources
 *
 * Honest limit: only as honest as the supplied eval_time and the dates the agent
 * attached. It catches a source older than the declared window — not whether the
 * date itself is truthful. No clock read, no LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { BlockingIssue, EnforcementContext } from '../enforcement/types.js';

interface SourceDate {
  id: string;
  published_at?: string;
}

export interface FreshnessResult {
  source_id: string;
  status: 'fresh' | 'stale' | 'future' | 'undated';
  age_seconds: number | null;
}

export interface FreshnessOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  eval_time_iso: string;
  authority: 'host' | 'agent';
  max_age_seconds: number;
  stale_ratio: number;
  results: FreshnessResult[];
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

/**
 * Parse epoch-ms or a fully-zoned ISO-8601 DATE-TIME. Returns ms or null.
 *
 * STRICT policy (Option A): the only accepted forms are epoch-ms (e.g. "1748563200000")
 * and a datetime WITH an explicit zone (e.g. "2026-05-30T00:00:00Z" / "...+05:30").
 * Rejected:
 *   - offset-less datetimes ("2026-05-30T00:00:00") — host-local, non-deterministic;
 *   - date-only values ("2026-05-30") — ambiguous (start vs end of day) and not a
 *     point in time. Callers must supply a precise instant.
 * This keeps freshness fully deterministic and the timestamp contract unambiguous.
 */
function parseInstant(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) return Number(trimmed); // epoch ms
    const hasTime = trimmed.includes('T');
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
    if (!hasTime || !hasZone) return null; // require a full zoned datetime
    const ms = Date.parse(trimmed);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function validateInput(input: unknown): {
  evalMs: number;
  evalRaw: string;
  authority: 'host' | 'agent';
  sources: SourceDate[];
  maxAge: number;
  requiresDated: boolean;
} {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "eval_time" {value, authority}, "sources" [{id, published_at?}], ' +
        'and "max_age_seconds".',
    );
  }
  const obj = input as Record<string, unknown>;

  const et = obj.eval_time as Record<string, unknown> | undefined;
  if (!et || typeof et !== 'object') {
    throw new Error('Missing "eval_time" object {value, authority}. The server has no clock — supply the time.');
  }
  const evalMs = parseInstant(et.value);
  if (evalMs === null) {
    throw new Error(
      'eval_time.value must be epoch-ms or a fully-zoned ISO-8601 datetime (e.g. 2026-05-30T00:00:00Z). ' +
        'Date-only and offset-less values are rejected (ambiguous / host-timezone-dependent).',
    );
  }
  const authority = et.authority === 'host' ? 'host' : et.authority === 'agent' ? 'agent' : null;
  if (authority === null) {
    throw new Error('eval_time.authority must be "host" or "agent".');
  }
  if (typeof obj.max_age_seconds !== 'number' || !isFinite(obj.max_age_seconds) || obj.max_age_seconds < 0) {
    throw new Error('"max_age_seconds" must be a non-negative number.');
  }
  if (!Array.isArray(obj.sources) || obj.sources.length < 1) {
    throw new Error('Missing "sources" (array of at least 1 {id, published_at?}).');
  }
  for (let i = 0; i < obj.sources.length; i++) {
    const s = obj.sources[i] as Record<string, unknown>;
    if (!s || typeof s.id !== 'string' || s.id.length === 0) {
      throw new Error(`sources[${i}] is missing a valid "id".`);
    }
    if (s.published_at !== undefined && parseInstant(s.published_at) === null) {
      throw new Error(
        `sources[${i}].published_at must be epoch-ms or a fully-zoned ISO-8601 datetime (date-only / offset-less rejected).`,
      );
    }
  }

  return {
    evalMs,
    evalRaw: typeof et.value === 'string' ? et.value : String(et.value),
    authority,
    sources: obj.sources as SourceDate[],
    maxAge: obj.max_age_seconds,
    requiresDated: obj.requires_dated_sources === true,
  };
}

export function handleCheckFreshness(input: unknown, engine: EnforcementEngine): FreshnessOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { evalMs, evalRaw, authority, sources, maxAge, requiresDated } = validateInput(input);

  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];
  const results: FreshnessResult[] = [];

  const block = (desc: string) =>
    blockingIssues.push({ mechanism: 'freshness', description: desc, severity: 'blocking' });

  let staleish = 0;
  for (const s of sources) {
    if (s.published_at === undefined) {
      results.push({ source_id: s.id, status: 'undated', age_seconds: null });
      staleish++;
      if (requiresDated) {
        if (authority === 'host') block(`Source "${s.id}" is undated but requires_dated_sources is set.`);
        else warnings.push(`Source "${s.id}" is undated (agent-supplied eval_time → warning).`);
      }
      continue;
    }

    const pubMs = parseInstant(s.published_at)!;
    const ageSeconds = (evalMs - pubMs) / 1000;

    if (ageSeconds < 0) {
      results.push({ source_id: s.id, status: 'future', age_seconds: ageSeconds });
      staleish++;
      if (authority === 'host') {
        block(`Source "${s.id}" is dated AFTER eval_time — a contradiction in the supplied data.`);
      } else {
        warnings.push(`Source "${s.id}" is dated after the agent-supplied eval_time (warning).`);
      }
    } else if (ageSeconds > maxAge) {
      results.push({ source_id: s.id, status: 'stale', age_seconds: ageSeconds });
      staleish++;
      if (authority === 'host' && requiresDated) {
        block(`Source "${s.id}" is stale: ${Math.round(ageSeconds)}s old > max ${maxAge}s.`);
      } else {
        warnings.push(`Source "${s.id}" is stale: ${Math.round(ageSeconds)}s old > max ${maxAge}s.`);
      }
    } else {
      results.push({ source_id: s.id, status: 'fresh', age_seconds: ageSeconds });
    }
  }

  const staleRatio = sources.length === 0 ? 0 : staleish / sources.length;

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'check_freshness', undefined, context)
    : '';

  const output: FreshnessOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    eval_time_iso: evalRaw,
    authority,
    max_age_seconds: maxAge,
    stale_ratio: Math.round(staleRatio * 1000) / 1000,
    results,
    context_used: !!context,
  };

  if (hasFail || warnings.length > 0) {
    output.enforcement = { blocking_issues: blockingIssues, warnings, corrective_prompt: correctivePrompt };
  }

  return output;
}
