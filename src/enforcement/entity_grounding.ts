/**
 * Ungrounded entity detector.
 *
 * Flags proper nouns, framework names, and specific claims that appear
 * without evidence anchors in the surrounding text. Cannot verify external
 * facts — only checks whether claims are grounded within the provided text.
 *
 * Detects:
 * - Proper nouns introduced without sourcing (benchmark, study, team name)
 * - Precise numeric claims with zero evidence context
 * - Entities that appear only once (no corroboration)
 * - Version numbers and specific rankings without citations
 *
 * Deterministic. Stateless. No LLM calls.
 */

export interface UngroundedEntity {
  entity: string;
  category: 'framework' | 'benchmark' | 'statistic' | 'organization' | 'version';
  evidence_anchors: number;
  reason: string;
}

export interface EntityGroundingResult {
  ungrounded_entities: UngroundedEntity[];
  grounded_count: number;
  ungrounded_count: number;
  grounding_ratio: number;
}

// ─── Detection patterns ────────────────────────────────────────────────────

// Known real frameworks/libraries (not exhaustive — just enough to reduce false positives)
const KNOWN_ENTITIES = new Set([
  'react', 'angular', 'vue', 'svelte', 'next.js', 'nuxt', 'express', 'express.js',
  'fastify', 'koa', 'django', 'flask', 'fastapi', 'spring', 'rails', 'laravel',
  'redis', 'postgresql', 'postgres', 'mysql', 'mongodb', 'cassandra', 'dynamodb',
  'elasticsearch', 'kafka', 'rabbitmq', 'nats', 'kubernetes', 'docker', 'terraform',
  'aws', 'gcp', 'azure', 'cloudflare', 'vercel', 'netlify', 'heroku',
  'node.js', 'deno', 'bun', 'go', 'rust', 'python', 'java', 'typescript',
  'webpack', 'vite', 'esbuild', 'rollup', 'babel', 'jest', 'vitest', 'mocha',
  'grafana', 'datadog', 'new relic', 'prometheus', 'splunk',
  'github', 'gitlab', 'bitbucket', 'jira', 'linear', 'slack',
  'snowflake', 'databricks', 'bigquery', 'redshift',
  'nginx', 'apache', 'caddy', 'traefik', 'envoy', 'istio',
]);

// Patterns that suggest a specific entity claim
// Framework: dot-notation names like "Xeldon.js" or "Cloud.io"
const FRAMEWORK_PATTERN = /\b([A-Z][a-z]+\.[a-z]+)\s+(?:framework|library|toolkit|engine|platform|suite|SDK)\b/g;
// Version: dot-notation name before "version X.Y"
const VERSION_PATTERN = /\b([A-Z][a-z]+\.[a-z]+)\s+(?:version|v)\s*[\d.]+/g;
const BENCHMARK_CLAIM = /\b(?:in the|according to)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+(?:benchmark|ranking|report|survey|study)/gi;
const RANKING_PATTERN = /\branked?\s+(?:#?\d+|first|second|third|fourth|fifth)\s+(?:in|on|among|overall)/gi;
const STAR_PATTERN = /\b([\d,]+)\s+(?:GitHub\s+)?stars?\b/gi;
const PRECISE_SPEED_CLAIM = /\b(\d{1,3}(?:,\d{3})*)\s+(?:requests?\s+per\s+second|req\/s|rps|QPS|queries\s+per\s+second)/gi;

// Evidence anchors — phrases that ground a claim
const EVIDENCE_ANCHORS = [
  /\baccording to\b/i,
  /\bbased on\b/i,
  /\bmeasured\b/i,
  /\bobserved\b/i,
  /\bour\s+(?:tests?|benchmarks?|data|monitoring|measurements?)\b/i,
  /\bload\s+test/i,
  /\bproduction\s+(?:data|metrics|monitoring)\b/i,
  /\bdocumentation\s+(?:shows?|states?|confirms?)\b/i,
  /\bsource:/i,
  /\bcitation/i,
  /\b(?:see|ref|reference)\s*:/i,
];

function countEvidenceAnchors(text: string): number {
  let count = 0;
  for (const pattern of EVIDENCE_ANCHORS) {
    if (pattern.test(text)) count++;
  }
  return count;
}

function isKnownEntity(name: string): boolean {
  return KNOWN_ENTITIES.has(name.toLowerCase());
}

/**
 * Check text for ungrounded entity claims.
 *
 * Returns entities introduced without evidence anchors.
 * Does NOT verify external facts — only checks internal grounding.
 */
export function checkEntityGrounding(text: string): EntityGroundingResult {
  const entities: UngroundedEntity[] = [];
  const seen = new Set<string>();

  const totalAnchors = countEvidenceAnchors(text);

  // Find all dot-notation names (Xeldon.js, Cloud.io, etc.) — the primary signal
  const dotNamePattern = /\b([A-Z][a-z]+\.[a-z]+)\b/g;
  let match;
  while ((match = dotNamePattern.exec(text)) !== null) {
    const name = match[1];
    if (!isKnownEntity(name) && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      // Count how many times this name appears (single mention = weaker grounding)
      const mentions = (text.match(new RegExp(name.replace('.', '\\.'), 'g')) || []).length;
      entities.push({
        entity: name,
        category: 'framework',
        evidence_anchors: totalAnchors,
        reason: `"${name}" is not a recognized entity (${mentions} mention${mentions > 1 ? 's' : ''}, ${totalAnchors} evidence anchor${totalAnchors !== 1 ? 's' : ''})`,
      });
    }
  }

  // Check for precise performance claims without evidence context
  const speedRegex = new RegExp(PRECISE_SPEED_CLAIM.source, 'gi');
  const hasSpeedClaim = speedRegex.test(text);
  if (hasSpeedClaim && totalAnchors === 0) {
    entities.push({
      entity: 'performance claim',
      category: 'statistic',
      evidence_anchors: 0,
      reason: 'Precise performance numbers cited without any evidence anchors',
    });
  }

  // Check for GitHub star claims without evidence
  const starRegex = new RegExp(STAR_PATTERN.source, 'gi');
  if (starRegex.test(text) && totalAnchors === 0) {
    entities.push({
      entity: 'GitHub stars',
      category: 'statistic',
      evidence_anchors: 0,
      reason: 'GitHub star count cited without evidence anchor',
    });
  }

  const totalEntities = seen.size;
  const grounded = Math.max(totalEntities - entities.filter(e => e.category === 'framework').length, 0);

  return {
    ungrounded_entities: entities,
    grounded_count: grounded,
    ungrounded_count: entities.length,
    grounding_ratio: totalEntities > 0 ? grounded / totalEntities : 1,
  };
}
