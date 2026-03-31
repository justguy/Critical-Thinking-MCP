/**
 * Claim classifier — routes claims to appropriate enforcement mechanisms.
 *
 * Classifies text into claim types so the right deterministic check runs:
 * - arithmetic: formula, sum, product, growth, ratio claims
 * - empirical: measurement, benchmark, observation claims
 * - forecast: prediction, projection, estimate claims
 * - tradeoff: comparison, pros/cons, alternative analysis claims
 * - safety: concurrency, race condition, failure mode claims
 * - architectural: design decision, pattern, technology choice claims
 *
 * Deterministic. Stateless. No LLM calls.
 */

export type ClaimType =
  | 'arithmetic'
  | 'empirical'
  | 'forecast'
  | 'tradeoff'
  | 'safety'
  | 'architectural'
  | 'unknown';

export interface ClaimClassification {
  text: string;
  primary_type: ClaimType;
  secondary_type: ClaimType | null;
  confidence: number;
  suggested_tools: string[];
}

// ─── Pattern matchers per claim type ────────────────────────────────────────

const TYPE_PATTERNS: Record<ClaimType, RegExp[]> = {
  arithmetic: [
    /\b\d+\s*[+\-×÷*/]\s*\d+\s*=\s*\d+/,
    /\$[\d,]+.*=.*\$[\d,]+/,
    /\b(?:sum|total|product|average|mean|compound|interest|growth|rate)\b.*\b\d+/i,
    /\b\d+\s*%\b.*\b(?:of|increase|decrease|growth|decline|annual|year)\b/i,
    /\b(?:FTE|capacity|utilization|throughput)\b.*\b\d+/i,
    /\b(?:equals?|results? in|comes? to|totals?)\b.*\b\d+/i,
    /\b\d+\s*\^\s*\d+/,
    /\b(?:weighted|unweighted)\s+(?:average|mean|sum)\b/i,
    /\b\d+\s+(?:at|@)\s+\d+%/i,
  ],
  empirical: [
    /\b(?:measured|observed|recorded|benchmarked|tested|showed|demonstrated)\b/i,
    /\bp\d{2,3}\s+(?:latency|response|time)/i,
    /\b(?:load test|stress test|benchmark|profiling|monitoring)\b/i,
    /\b(?:incident|outage|failure)\s+(?:ID|report|log)\b/i,
    /\b(?:APM|Grafana|Datadog|CloudWatch|New Relic)\b/i,
  ],
  forecast: [
    /\b(?:predict|project|forecast|estimate|expect|anticipate)\b/i,
    /\b(?:will|should|would)\s+(?:handle|support|scale|process|achieve)\b/i,
    /\b(?:by|within|before)\s+(?:Q[1-4]|202\d|next|end of)\b/i,
    /\b(?:projected|estimated|expected)\s+(?:cost|revenue|growth|traffic)\b/i,
  ],
  tradeoff: [
    /\b(?:vs|versus|compared to|alternatively|on the other hand)\b/i,
    /\b(?:pro|con|advantage|disadvantage|benefit|drawback|tradeoff)\b/i,
    /\b(?:option [A-Z]|alternative \d|approach \d)\b/i,
    /\b(?:utility|expected value|weighted score)\b/i,
    /\b(?:better|worse|prefer|recommend)\b.*\b(?:because|since|given)\b/i,
  ],
  safety: [
    /\b(?:race condition|deadlock|livelock|starvation)\b/i,
    /\b(?:concurrent|parallel|simultaneous)\b.*\b(?:access|write|read|update|modify)\b/i,
    /\b(?:lock|mutex|semaphore|transaction|atomic)\b/i,
    /\b(?:idempoten|exactly.?once|at.?least.?once|at.?most.?once)\b/i,
    /\b(?:rollback|failover|circuit.?breaker|retry|timeout)\b/i,
    /\b(?:TOCTOU|check.?then.?act|read.?modify.?write)\b/i,
  ],
  architectural: [
    /\b(?:microservice|monolith|event.?sourc|CQRS|saga|CRUD)\b/i,
    /\b(?:service mesh|API gateway|load balancer|CDN|cache layer)\b/i,
    /\b(?:deploy|migration|rewrite|refactor)\b.*\b(?:strategy|approach|plan)\b/i,
    /\b(?:horizontal|vertical)\s+scal/i,
    /\b(?:blue.?green|canary|rolling)\s+(?:deploy|release|update)\b/i,
  ],
  unknown: [],
};

const TOOL_MAPPING: Record<ClaimType, string[]> = {
  arithmetic: ['check_numeric_claims'],
  empirical: ['check_numeric_claims', 'score_response_quality'],
  forecast: ['validate_confidence', 'score_response_quality'],
  tradeoff: ['evaluate_tradeoffs'],
  safety: ['validate_reasoning_chain', 'score_response_quality'],
  architectural: ['validate_reasoning_chain', 'evaluate_tradeoffs'],
  unknown: ['score_response_quality'],
};

function scoreType(text: string, type: ClaimType): number {
  const patterns = TYPE_PATTERNS[type];
  if (patterns.length === 0) return 0;
  let matches = 0;
  for (const p of patterns) {
    if (p.test(text)) matches++;
  }
  return matches / patterns.length;
}

/**
 * Classify a claim or text passage by type.
 *
 * Returns primary and optional secondary type, with suggested
 * enforcement tools for each.
 */
export function classifyClaim(text: string): ClaimClassification {
  const types: ClaimType[] = [
    'arithmetic', 'empirical', 'forecast',
    'tradeoff', 'safety', 'architectural',
  ];

  const scores = types.map(t => ({ type: t, score: scoreType(text, t) }));
  scores.sort((a, b) => b.score - a.score);

  const primary = scores[0].score > 0 ? scores[0].type : 'unknown';
  const secondary = scores[1].score > 0.1 ? scores[1].type : null;

  return {
    text: text.slice(0, 200),
    primary_type: primary,
    secondary_type: secondary,
    confidence: scores[0].score,
    suggested_tools: [
      ...TOOL_MAPPING[primary],
      ...(secondary ? TOOL_MAPPING[secondary] : []),
    ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
  };
}

/**
 * Classify multiple claims and return suggested tool routing.
 */
export function classifyClaims(claims: string[]): ClaimClassification[] {
  return claims.map(classifyClaim);
}
