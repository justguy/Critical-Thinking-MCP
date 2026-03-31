/**
 * Layer A: Feature Extraction
 *
 * Extracts structural features from free-text LLM responses.
 * Used by the deterministic scorer (Layer B) to compute
 * specificity, logical_structure, and assumption_honesty scores.
 *
 * No LLM calls. Pure string analysis.
 */

export interface ExtractedFeatures {
  /** Count of numeric thresholds (e.g., ">500/s", "99.9%", "200ms") */
  thresholds: number;
  /** Count of measurement units (ms, %, req/s, GB, etc.) */
  units: number;
  /** Named components (Redis, BillingService, PostgreSQL, etc.) */
  component_names: string[];
  /** Count of conditional phrases (if/when/given/unless/provided that) */
  conditional_phrases: number;
  /** Count of hedge phrases (might/could/perhaps/possibly/may) */
  hedge_phrases: number;
  /** Count of explicitly stated assumptions */
  explicit_assumptions: number;
  /** Numeric confidence values found (e.g., 0.85, 90%) */
  confidence_mentions: number[];
  /** Count of stated falsification conditions */
  falsification_conditions: number;
  /** Count of claim/assertion markers */
  claim_markers: number;
  /** Count of evidence markers (data/study/benchmark/measured) */
  evidence_markers: number;
  /** Count of conclusion markers (therefore/thus/hence/conclude) */
  conclusion_markers: number;
}

// Patterns for feature detection
const UNIT_PATTERN = /\b\d+[\d.,]*\s*(?:ms|s|sec|min|hr|%|req\/s|rps|qps|GB|MB|KB|TB|USD|\$)\b/gi;
const THRESHOLD_PATTERN = /(?:[><]=?|above|below|exceeds?|under|over|at least|at most|more than|less than|within)\s*\d/gi;
const CONDITIONAL_PATTERN = /\b(?:if|when|given|unless|provided that|assuming|in the case|only when|except when)\b/gi;
const HEDGE_PATTERN = /\b(?:might|could|perhaps|possibly|may|probably|likely|unlikely|it depends|potentially|conceivably)\b/gi;
const ASSUMPTION_PATTERN = /\b(?:assum(?:e|ing|ption)|presuppos|presum|taken? (?:as|for) granted)\b/gi;
const CONFIDENCE_PATTERN = /(?:confidence|probability|likelihood|certainty)[:\s]+(\d+\.?\d*)\s*%?|\b(0\.\d+)\b(?=.*(?:confidence|certain|sure|likely))/gi;
const FALSIFICATION_PATTERN = /\b(?:fals(?:ified|ifiable|ification)|disproven?|refut(?:e|ed|able)|prove[sn]? wrong|invalidat(?:e|ed))\b/gi;
const CLAIM_PATTERN = /\b(?:claim|assert|argue|contend|maintain|hold that|propose that)\b/gi;
const EVIDENCE_PATTERN = /\b(?:data|study|studies|benchmark|measured|observed|experiment|empirical|survey|results show|evidence)\b/gi;
const CONCLUSION_PATTERN = /\b(?:therefore|thus|hence|consequently|conclude|in conclusion|it follows|as a result)\b/gi;

// Known technical component names (extensible)
const COMPONENT_PATTERN = /\b(?:Redis|PostgreSQL|Postgres|MySQL|MongoDB|Cassandra|Kafka|RabbitMQ|Kubernetes|Docker|Nginx|Apache|ElasticSearch|DynamoDB|S3|Lambda|CloudFront|Snowflake|Databricks|React|Node\.js|Express)\b/g;

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function extractComponentNames(text: string): string[] {
  const matches = text.match(COMPONENT_PATTERN);
  if (!matches) return [];
  return [...new Set(matches)];
}

function extractConfidenceValues(text: string): number[] {
  const values: number[] = [];
  let match;
  const pattern = /(?:confidence|probability|certainty)[:\s]+(\d+\.?\d*)\s*%?|(0\.\d+)(?=.*(?:confidence|certain))/gi;
  while ((match = pattern.exec(text)) !== null) {
    const val = parseFloat(match[1] || match[2]);
    if (!isNaN(val)) {
      values.push(val > 1 ? val / 100 : val);
    }
  }
  return values;
}

export function extractFeatures(text: string): ExtractedFeatures {
  return {
    thresholds: countMatches(text, THRESHOLD_PATTERN),
    units: countMatches(text, UNIT_PATTERN),
    component_names: extractComponentNames(text),
    conditional_phrases: countMatches(text, CONDITIONAL_PATTERN),
    hedge_phrases: countMatches(text, HEDGE_PATTERN),
    explicit_assumptions: countMatches(text, ASSUMPTION_PATTERN),
    confidence_mentions: extractConfidenceValues(text),
    falsification_conditions: countMatches(text, FALSIFICATION_PATTERN),
    claim_markers: countMatches(text, CLAIM_PATTERN),
    evidence_markers: countMatches(text, EVIDENCE_PATTERN),
    conclusion_markers: countMatches(text, CONCLUSION_PATTERN),
  };
}
