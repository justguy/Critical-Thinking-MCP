/**
 * Concurrency hazard pattern detector.
 *
 * Detects common concurrency anti-patterns in text descriptions
 * of system behavior. Uses keyword and structural pattern matching
 * — no LLM calls.
 *
 * Patterns detected:
 * - check-then-act on shared state
 * - read-modify-write without lock/version
 * - missing idempotency
 * - missing transaction boundary
 * - no ordering guarantee on async events
 * - missing period-boundary serialization
 * - no exactly-once / dedupe strategy
 */

export interface ConcurrencyHazard {
  pattern: string;
  description: string;
  severity: 'critical' | 'warning';
  evidence: string;
}

export interface ConcurrencyResult {
  hazards: ConcurrencyHazard[];
  hazard_count: number;
  critical_count: number;
  has_mitigation: boolean;
  mitigations_found: string[];
}

// ─── Pattern definitions ───────────────────────────────────────────────────

interface PatternDef {
  name: string;
  description: string;
  severity: 'critical' | 'warning';
  /** At least one trigger phrase must match */
  triggers: RegExp[];
  /** If any mitigation phrase is found, mark has_mitigation */
  mitigations: RegExp[];
}

const PATTERNS: PatternDef[] = [
  {
    name: 'check_then_act',
    description: 'Check-then-act on shared state without atomicity',
    severity: 'critical',
    triggers: [
      /\b(?:read|get|fetch|query|select)\s+(?:the\s+)?(?:state|row|record|value|balance|count|status)\b.*\b(?:then|before|and then|afterward)\b.*\b(?:update|write|set|insert|delete|modify|increment)\b/i,
      /\b(?:if|when)\b.*\b(?:exists?|available|ready|count|length|size)\b.*\b(?:then|and then)\b.*\b(?:create|add|insert|push|enqueue)\b/i,
    ],
    mitigations: [
      /\b(?:atomic|compare.?and.?swap|cas|test.?and.?set|lock|mutex|semaphore|synchronized)\b/i,
      /\bselect\s+.*\s+for\s+update\b/i,
      /\b(?:optimistic|pessimistic)\s+lock/i,
      /\b(?:version|etag|revision)\s+(?:check|field|column|header)\b/i,
    ],
  },
  {
    name: 'read_modify_write',
    description: 'Read-modify-write cycle without lock or version check',
    severity: 'critical',
    triggers: [
      /\breads?\b.*\b(?:computes?|calculates?|aggregates?|sums?|totals?)\b.*\bwrites?\b/i,
      /\b(?:fetch(?:es)?|loads?|quer(?:y|ies))\b.*\b(?:modif(?:y|ies)|transforms?|updates?|increments?)\b.*\b(?:saves?|stores?|persists?|writes?)\b/i,
      /\baggregat(?:e|es?|ion)\b.*\b(?:quer(?:y|ies))\b.*\b(?:concurrent|simultaneous|parallel)\b/i,
    ],
    mitigations: [
      /\b(?:transaction|begin|commit|rollback|serializable|repeatable.?read)\b/i,
      /\bselect\s+.*\s+for\s+update\b/i,
      /\b(?:row.?level|table.?level|advisory)\s+lock\b/i,
      /\b(?:atomic|atomically)\b/i,
    ],
  },
  {
    name: 'missing_idempotency',
    description: 'No idempotency key or deduplication strategy',
    severity: 'warning',
    triggers: [
      /\bretr(?:y|ies)\b(?!.*\bidempoten)/i,
      /\b(?:at.?least.?once|retr(?:y|ies).?on.?failure|automatic(?:ally)?.?retr(?:y|ies))\b/i,
      /\b(?:webhook|callback|event)\b.*\b(?:deliver|send|fire|emit|process|handler)\b(?!.*\b(?:idempoten|dedupe|dedup|exactly.?once))/i,
    ],
    mitigations: [
      /\bidempoten(?:t|cy)\b/i,
      /\b(?:dedupe|deduplicat|exactly.?once)\b/i,
      /\bidempotency.?key\b/i,
    ],
  },
  {
    name: 'missing_transaction_boundary',
    description: 'Multiple writes without transaction boundary',
    severity: 'critical',
    triggers: [
      /\b(?:update|insert|delete|write)\b.*\b(?:and|then|also|additionally)\b.*\b(?:update|insert|delete|write)\b/i,
      /\bmultiple\b.*\b(?:table|collection|store|database)\b.*\b(?:update|write|modif)\b/i,
    ],
    mitigations: [
      /\b(?:transaction|begin|commit|rollback|atomic)\b/i,
      /\bsaga\b/i,
      /\b(?:two.?phase|2pc|distributed.?transaction)\b/i,
    ],
  },
  {
    name: 'unordered_async_events',
    description: 'No ordering guarantee on async event processing',
    severity: 'warning',
    triggers: [
      /\b(?:event|message|queue)\b.*\b(?:process|consum|handl)\b.*\b(?:order|sequenc)\b/i,
      /\b(?:concurrent|parallel)\b.*\b(?:event|message|usage)\b.*\b(?:process|consum|handl)\b/i,
      /\bprocess(?:ed|ing)?\s+(?:in\s+order|sequentially)\b/i,
    ],
    mitigations: [
      /\b(?:partition|shard)\s+(?:key|by)\b/i,
      /\b(?:fifo|ordered)\s+(?:queue|topic|stream)\b/i,
      /\b(?:sequence|ordering)\s+(?:number|id|guarantee)\b/i,
      /\b(?:serializ(?:e|ation)|total.?order)\b/i,
    ],
  },
  {
    name: 'missing_period_boundary',
    description: 'Period-boundary operation without serialization',
    severity: 'critical',
    triggers: [
      /\b(?:billing|invoice|settlement|reconciliation)\s+(?:period|cycle|window|boundary)\b/i,
      /\b(?:period|cycle)\s+(?:close|end|boundary|transition|cutoff)\b/i,
    ],
    mitigations: [
      /\b(?:lock|mutex|fence|barrier)\b.*\b(?:period|boundary|cutoff)\b/i,
      /\b(?:freeze|drain|quiesce)\b/i,
      /\b(?:exclusive|write)\s+lock\b/i,
    ],
  },
];

// ─── Mitigation keywords (general) ─────────────────────────────────────────

const GENERAL_MITIGATIONS = [
  /\bmutex\b/i,
  /\bsync\.mutex\b/i,
  /\block\(\)/i,
  /\bunlock\(\)/i,
  /\bsemaphore\b/i,
  /\bselect\s+for\s+update\b/i,
  /\bserialized?\b/i,
  /\batomic(?:ally)?\b/i,
  /\btransaction\b/i,
  /\bidempoten/i,
  /\bexactly.?once\b/i,
];

/**
 * Check text for concurrency hazard patterns.
 *
 * Returns detected hazards with severity and evidence.
 * If mitigations are mentioned alongside hazards, flags them.
 */
export function checkConcurrencyHazards(text: string): ConcurrencyResult {
  const hazards: ConcurrencyHazard[] = [];
  const mitigationsFound: string[] = [];

  // Check general mitigations
  for (const pattern of GENERAL_MITIGATIONS) {
    const match = text.match(pattern);
    if (match) {
      mitigationsFound.push(match[0]);
    }
  }

  // Check each hazard pattern
  for (const patternDef of PATTERNS) {
    for (const trigger of patternDef.triggers) {
      const match = text.match(trigger);
      if (match) {
        // Check if any specific mitigation for this pattern exists
        const hasMitigation = patternDef.mitigations.some(m => m.test(text));

        if (!hasMitigation) {
          hazards.push({
            pattern: patternDef.name,
            description: patternDef.description,
            severity: patternDef.severity,
            evidence: match[0].slice(0, 100),
          });
        }
        break; // one match per pattern is enough
      }
    }
  }

  return {
    hazards,
    hazard_count: hazards.length,
    critical_count: hazards.filter(h => h.severity === 'critical').length,
    has_mitigation: mitigationsFound.length > 0,
    mitigations_found: [...new Set(mitigationsFound)],
  };
}
