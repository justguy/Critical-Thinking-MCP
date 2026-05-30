// Shared MCP tool metadata, kept separate so server wiring stays small.

// Shared optional `context` property for the stateless iterative-enforcement protocol.
// Referenced by every tool that supports escalation/stall detection (deduped — was
// copy-pasted ~45 lines per tool).
const CONTEXT_PROPERTY = {
  type: 'object' as const,
  description: 'Optional caller-provided context for iterative enforcement. Include prior failure counts, iteration history, and previous response data to enable escalation and stall detection. Omit for one-shot usage.',
  properties: {
    iteration_number: { type: 'number' as const, description: 'Current iteration (1-based)' },
    failure_counts_by_mechanism: {
      type: 'object' as const,
      description: 'Map of mechanism name to prior failure count',
      additionalProperties: { type: 'number' as const },
    },
    prior_blocking_issues: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Mechanism names that blocked in prior iterations',
    },
    previous_response_text: { type: 'string' as const, description: 'Full text of prior response' },
    previous_response_hash: { type: 'string' as const, description: 'Hash of prior response for stall detection' },
    prior_corrective_prompt: { type: 'string' as const, description: 'Corrective prompt from prior iteration' },
    iteration_history: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          iteration_number: { type: 'number' as const },
          blocking_issues: { type: 'array' as const, items: { type: 'string' as const } },
          warnings: { type: 'array' as const, items: { type: 'string' as const } },
          response_hash: { type: 'string' as const },
          gap_summary: { type: 'array' as const, items: { type: 'string' as const } },
        },
      },
      description: 'History of prior iterations for loop/stall detection',
    },
    run_metadata: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string' as const },
        thread_id: { type: 'string' as const },
        scenario_id: { type: 'string' as const },
        condition: { type: 'string' as const },
      },
      description: 'Caller metadata for traceability (not used in enforcement logic)',
    },
  },
};

// Full tool set. The deliverable-centric leaf checks are kept as internal
// primitives (finalize_deliverable re-executes the blocking ones inline) and are
// filtered out of the public surface below — agents drive the layer through the
// plan_checks → finalize_deliverable spine. See INTERNAL_TOOL_NAMES.
const ALL_TOOLS = [
  {
    name: 'validate_reasoning_chain',
    description: `Map your reasoning to a directed graph and check it for logical errors: circular reasoning, unsupported conclusions, and orphaned claims.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"nodes":[{"id":"c1","label":"The API latency is acceptable","type":"claim"},{"id":"e1","label":"p99 benchmark shows 180ms","type":"evidence"},{"id":"cn1","label":"We should use this service","type":"conclusion"}],"edges":[{"from":"e1","to":"c1","relation":"supports"},{"from":"c1","to":"cn1","relation":"implies"}]}

Node types: "claim" | "evidence" | "conclusion" | "assumption"
Edge relations: "supports" | "implies" | "contradicts" | "requires"

Returns: cycles found, orphaned conclusions, grounding_score (evidence-to-conclusion reachability), and enforcement results.

Optionally pass "context" with prior iteration data for escalation and stall detection.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        nodes: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const, description: 'Unique node identifier' },
              label: { type: 'string' as const, description: 'Text content of the node' },
              type: {
                type: 'string' as const,
                enum: ['claim', 'evidence', 'conclusion', 'assumption'],
                description: 'Node category',
              },
            },
            required: ['id', 'label', 'type'],
          },
          minItems: 2,
          description: 'Graph nodes representing claims, evidence, conclusions, or assumptions',
        },
        edges: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              from: { type: 'string' as const, description: 'Source node id' },
              to: { type: 'string' as const, description: 'Target node id' },
              relation: {
                type: 'string' as const,
                enum: ['supports', 'implies', 'contradicts', 'requires'],
                description: 'Relationship type',
              },
            },
            required: ['from', 'to', 'relation'],
          },
          minItems: 1,
          description: 'Directed edges between nodes',
        },
        require_redundancy_for: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Optional: conclusion ids that must each be reachable from ≥2 vertex-disjoint, lexically-distinct evidence paths (else BLOCK).',
        },
        declared_support: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              conclusion_id: { type: 'string' as const },
              premise_ids: { type: 'array' as const, items: { type: 'string' as const } },
            },
            required: ['conclusion_id', 'premise_ids'],
          },
          description: 'Optional: declared premises per conclusion. Phantom (unreachable) or undeclared direct premises BLOCK; transitive omissions warn.',
        },
        context: CONTEXT_PROPERTY,
      },
      required: ['nodes', 'edges'],
    },
  },
  {
    name: 'check_numeric_claims',
    description: `Multi-signal numeric analysis: fabrication detection, outlier detection, and arithmetic verification.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"numbers":[12.5, 15.3, 14.8, 100.0, 13.2],"context":"Quarterly revenue figures in millions"}

Three analysis layers:
1. Fabrication detection (round-number ratio, spacing CV, precision CV, geometric ratio consistency)
2. Outlier detection (MAD-based for small samples, Z-score for larger sets)
3. Arithmetic verification (sum, product, compound growth, weighted average, ratio consistency)

Optional field: "context" (string) — describes the data. Enables compound growth detection when it mentions interest/growth/rate.

Optionally pass "context" with prior iteration data for escalation and stall detection.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        numbers: {
          type: 'array' as const,
          items: { type: 'number' as const },
          minItems: 2,
          description: 'Array of at least 2 numeric values to check',
        },
        description: {
          type: 'string' as const,
          description: 'Optional text describing the data. Enables compound growth detection when it mentions interest/growth/rate. Example: "Quarterly revenue figures in millions"',
        },
        context: CONTEXT_PROPERTY,
      },
      required: ['numbers'],
    },
  },
  {
    name: 'detect_drift',
    description: `Detect drift in a numeric sequence using CUSUM (Cumulative Sum) analysis with monotonic progress tracking.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"sequence":[0.72, 0.74, 0.73, 0.85, 0.91, 0.93],"drift_sensitivity":0.5}

CUSUM formula: S_i = max(0, S_{i-1} + x_i - omega). Drift detected when S_i > 5 * std(sequence).
Also reports monotonic progress: is_improving, is_stalling, is_declining.

Optional field: "drift_sensitivity" (number, default 0.5).

Optionally pass "context" with prior iteration data for escalation and stall detection.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        sequence: {
          type: 'array' as const,
          items: { type: 'number' as const },
          minItems: 3,
          description: 'Array of at least 3 numeric values in temporal order',
        },
        drift_sensitivity: {
          type: 'number' as const,
          description: 'CUSUM sensitivity parameter omega (default: 0.5)',
        },
        context: CONTEXT_PROPERTY,
      },
      required: ['sequence'],
    },
  },
  {
    name: 'evaluate_tradeoffs',
    description: `Compare options by computing Expected Utility (EU) for each, then rank them.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"options":[{"name":"Option A","outcomes":[{"description":"Success","probability":0.7,"utility":100},{"description":"Failure","probability":0.3,"utility":-20}]},{"name":"Option B","outcomes":[{"description":"Success","probability":0.5,"utility":150},{"description":"Failure","probability":0.5,"utility":-10}]}]}

Each option's outcome probabilities must sum to 1.0 (within +/-0.01). Minimum 2 options.
Returns INDETERMINATE (recommended=null) when top-2 EU scores differ by < 0.05.

Optionally pass "context" with prior iteration data for escalation and stall detection.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        options: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const, description: 'Option name' },
              outcomes: {
                type: 'array' as const,
                items: {
                  type: 'object' as const,
                  properties: {
                    description: { type: 'string' as const, description: 'Outcome description' },
                    probability: { type: 'number' as const, description: 'Probability (0-1)' },
                    utility: { type: 'number' as const, description: 'Utility value' },
                  },
                  required: ['description', 'probability', 'utility'],
                },
                minItems: 1,
                description: 'Possible outcomes with probabilities summing to 1.0',
              },
            },
            required: ['name', 'outcomes'],
          },
          minItems: 2,
          description: 'Array of at least 2 options to compare',
        },
        context: CONTEXT_PROPERTY,
      },
      required: ['options'],
    },
  },
  {
    name: 'check_plan_validity',
    description: `Validate a plan's logical structure: detect circular dependencies, missing prerequisites, and resource conflicts.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"steps":[{"id":"s1","description":"Set up database schema","dependencies":[],"resources":["database"]},{"id":"s2","description":"Build API endpoints","dependencies":["s1"],"resources":["api-server"]},{"id":"s3","description":"Deploy to staging","dependencies":["s2"],"resources":["staging-env"]}]}

Each step requires: id, description, dependencies (string[] of step IDs, use [] if none).
Optional: resources (string[]) — detects conflicts when multiple unordered steps use the same resource.
Returns: circular_dependencies, missing_prerequisites, resource_conflicts, completeness_score, critical_path.

Optionally pass "context" with prior iteration data for escalation and stall detection.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        steps: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const, description: 'Unique step identifier' },
              description: { type: 'string' as const, description: 'What this step does' },
              dependencies: {
                type: 'array' as const,
                items: { type: 'string' as const },
                description: 'IDs of steps that must complete before this one',
              },
              resources: {
                type: 'array' as const,
                items: { type: 'string' as const },
                description: 'Optional resource identifiers this step uses',
              },
              on_failure: {
                type: 'object' as const,
                description: 'Optional failure branch (used when require_failure_branches is true).',
                properties: {
                  action: { type: 'string' as const, enum: ['abort', 'retry', 'rollback', 'compensate', 'goto'] },
                  target: { type: 'string' as const, description: 'Step id to jump to (for goto/rollback/compensate).' },
                  detect: { type: 'string' as const, description: 'How the failure is detected (should carry a measurable signal).' },
                  max_attempts: { type: 'number' as const, description: 'Bound for retry/goto loops; absence of a bound on a loop is warned.' },
                },
                required: ['action'],
              },
            },
            required: ['id', 'description', 'dependencies'],
          },
          minItems: 2,
          description: 'Array of at least 2 plan steps',
        },
        require_failure_branches: {
          type: 'boolean' as const,
          description: 'Opt-in: require every effect-bearing step to declare an on_failure branch; dangling targets and on_failure cycles BLOCK.',
        },
        context: CONTEXT_PROPERTY,
      },
      required: ['steps'],
    },
  },
  {
    name: 'score_response_quality',
    description: `Score a response across four quality dimensions: substance, specificity, hedge avoidance, and structure.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"response_text":"The full text of the response you want to evaluate for quality. It should be at least 10 characters.","claims":["Optional array of explicit claims"],"evidence":["Optional array of evidence items"]}

Dimensions:
- substance_score: Shannon entropy on word frequencies (lexical diversity)
- specificity_score: Density of concrete, quantitative markers
- hedge_density: Proportion of hedging language (lower is better)
- structure_score: Presence of claim->evidence->conclusion pattern
- overall_score: Weighted average (substance 0.3, specificity 0.3, 1-hedge 0.2, structure 0.2)

Returns the weakest dimension with targeted improvement advice.

Optionally pass "context" with prior iteration data for escalation and stall detection.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        response_text: {
          type: 'string' as const,
          minLength: 10,
          description: 'The response text to evaluate (min 10 characters)',
        },
        claims: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Optional explicit claims to check for',
        },
        evidence: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Optional evidence items to check for',
        },
        context: CONTEXT_PROPERTY,
      },
      required: ['response_text'],
    },
  },
  {
    name: 'validate_confidence',
    description: `Check whether your claimed confidence is mathematically supported by your assumptions.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"assumptions":[{"description":"Redis will respond within 50ms under normal load","confidence":0.85,"falsification_condition":"Fails when Redis response time exceeds 50ms for >1% of requests in a 5-minute window"}],"response_text":"The full text of the response whose confidence you are validating"}

Each assumption needs: description, confidence (0.0-1.0), falsification_condition. If you cannot state a falsification_condition, set confidence to 0.3 or below.

Computes dependency-weighted honest confidence ceiling. Flags inflation when claimed confidence exceeds ceiling by >0.15. Checks falsifiability of stated conditions.

Optionally pass "context" with prior iteration data for escalation and stall detection.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        assumptions: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              description: { type: 'string' as const, description: 'What you are assuming' },
              confidence: {
                type: 'number' as const,
                minimum: 0,
                maximum: 1,
                description: 'Your confidence in this assumption (0.0-1.0)',
              },
              falsification_condition: {
                type: 'string' as const,
                description: 'How this assumption could be proven wrong',
              },
            },
            required: ['description', 'confidence'],
          },
          minItems: 1,
          description: 'Array of at least 1 assumption',
        },
        response_text: {
          type: 'string' as const,
          minLength: 10,
          description: 'The response text being validated (min 10 characters)',
        },
        strict: {
          type: 'boolean' as const,
          description: 'Opt-in: enforce the confidence/hedge contradiction as a BLOCK (claimed ≥0.9 + heavy hedging). Default false → warning only.',
        },
        context: CONTEXT_PROPERTY,
      },
      required: ['assumptions', 'response_text'],
    },
  },
  {
    name: 'verify_arithmetic',
    description: `Verify that a claimed arithmetic result matches the actual computation. Supports: sum, weighted_average, percentage, growth, product.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"claim_type":"weighted_average","values":[100,80,60],"weights":[0.5,0.3,0.2],"claimed_result":84}

Claim types and required fields:
- "sum": values[], claimed_result
- "weighted_average": values[], weights[], claimed_result
- "percentage": part, whole, claimed_result
- "growth": values[] (principal), rate, periods, claimed_result
- "product": values[], claimed_result

Strict by default — matches to 2 decimal places. Optional "tolerance" for relative tolerance.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        claim_type: {
          type: 'string' as const,
          enum: ['sum', 'weighted_average', 'percentage', 'growth', 'product'],
          description: 'Type of arithmetic claim to verify',
        },
        values: {
          type: 'array' as const,
          items: { type: 'number' as const },
          description: 'Input values (for sum: addends, for growth: [principal], etc.)',
        },
        weights: {
          type: 'array' as const,
          items: { type: 'number' as const },
          description: 'Weights for weighted_average (same length as values)',
        },
        claimed_result: {
          type: 'number' as const,
          description: 'The result being verified',
        },
        tolerance: {
          type: 'number' as const,
          description: 'Optional relative tolerance (e.g., 0.01 for 1%). Default: strict 2-decimal match.',
        },
        rate: { type: 'number' as const, description: 'Growth rate for "growth" claim type' },
        periods: { type: 'number' as const, description: 'Number of periods for "growth" claim type' },
        part: { type: 'number' as const, description: 'Numerator for "percentage" claim type' },
        whole: { type: 'number' as const, description: 'Denominator for "percentage" claim type' },
      },
      required: ['claim_type', 'claimed_result'],
    },
  },
  {
    name: 'detect_concurrency_patterns',
    description: `Detect common concurrency hazard patterns in a structured operation description.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"steps":["Read current balance","If balance >= cost, approve","Write updated balance"],"shared_resources":["balance"],"protections":[]}

Detects: check-then-act, read-modify-write, missing idempotency, ordering assumptions.

Optional fields:
- "shared_resources" (string[]) — named shared state
- "protections" (string[]) — locks, transactions, idempotency keys, etc.
- "delivery_model" — "at_least_once" | "at_most_once" | "exactly_once"
- "retry_behavior" — "none" | "automatic" | "manual"`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        steps: {
          type: 'array' as const,
          items: { type: 'string' as const },
          minItems: 2,
          description: 'Ordered sequence of operation steps',
        },
        shared_resources: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Named shared state or resources accessed by multiple steps',
        },
        protections: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Concurrency protections in place (locks, transactions, idempotency keys)',
        },
        delivery_model: {
          type: 'string' as const,
          enum: ['at_least_once', 'at_most_once', 'exactly_once'],
          description: 'Message delivery guarantee',
        },
        retry_behavior: {
          type: 'string' as const,
          enum: ['none', 'automatic', 'manual'],
          description: 'Retry behavior on failure',
        },
      },
      required: ['steps'],
    },
  },

  // ─── Deliverable-centric factual-QA slice ──────────────────────────────────
  {
    name: 'plan_checks',
    description: `Deterministic planner for the deliverable gate. Given a deliverable_contract (task_type, evidence_level, risk_level), returns the obligations this deliverable must satisfy: finalize_required lists the checks finalize_deliverable will RE-EXECUTE inline at the gate (missing their artifacts is a BLOCK); finalize_verify_if_present lists checks (e.g. freshness/constraints pulled in at high risk) finalize re-runs ONLY if you supply their artifacts — absent artifacts never block; plus advisory 'optional' considerations. Those checks are internal to finalize — you do NOT call them separately; use this to learn which artifacts to prepare for finalize_deliverable (sources+claims for grounding, inputs+conclusion_numbers for number tracing, constraints+structured_answer, eval_time for freshness). Pure lookup + policy — NEVER blocks.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"contract":{"task_type":"factual_qa","evidence_level":"cited","risk_level":"low"}}

task_type: factual_qa | numeric_analysis | planning | decision | concurrency_design | reasoning | freeform
evidence_level: none | asserted | cited | rederived
risk_level: low | medium | high`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        contract: {
          type: 'object' as const,
          description: 'Deliverable contract (or pass task_type/evidence_level/risk_level at the top level).',
          properties: {
            task_type: { type: 'string' as const, enum: ['factual_qa', 'numeric_analysis', 'planning', 'decision', 'concurrency_design', 'reasoning', 'freeform'] },
            evidence_level: { type: 'string' as const, enum: ['none', 'asserted', 'cited', 'rederived'] },
            risk_level: { type: 'string' as const, enum: ['low', 'medium', 'high'] },
          },
          required: ['task_type', 'evidence_level', 'risk_level'],
        },
      },
      required: ['contract'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const },
        task_type: { type: 'string' as const },
        required: { type: 'array' as const, items: { type: 'object' as const } },
        optional: { type: 'array' as const, items: { type: 'object' as const } },
        finalize_required: { type: 'array' as const, items: { type: 'string' as const } },
        finalize_verify_if_present: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['status', 'required', 'finalize_required'],
    },
  },
  {
    name: 'check_quote_grounding',
    description: `Verify every factual claim against a supplied source by VERBATIM substring containment. For each claim copy the exact source span you relied on and name a supporting token inside it. BLOCKS when a span is not a verbatim substring of its source, the token is not inside the span, or (for numeric/date/entity/status claims) the key token is absent from the claim. Cannot verify external truth — only internal grounding against the supplied corpus.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"sources":[{"id":"s1","text":"Redis is single-threaded for command execution."}],"claims":[{"claim_id":"c1","claim_text":"Redis executes commands single-threaded","source_id":"s1","quoted_span":"Redis is single-threaded for command execution","supporting_token":"single-threaded","claim_kind":"status"}]}

claim_kind: numeric | date | entity | status | comparison | causal | recommendation`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        sources: {
          type: 'array' as const,
          minItems: 1,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const },
              text: { type: 'string' as const },
              origin: { type: 'string' as const, enum: ['host_supplied', 'user_supplied', 'agent_supplied', 'retrieved_by_host'] },
              authority_tier: { type: 'string' as const, enum: ['primary', 'official', 'secondary', 'unknown'] },
              retrieved_at: { type: 'string' as const },
              published_at: { type: 'string' as const },
            },
            required: ['id', 'text'],
          },
        },
        claims: {
          type: 'array' as const,
          minItems: 1,
          items: {
            type: 'object' as const,
            properties: {
              claim_id: { type: 'string' as const },
              claim_text: { type: 'string' as const },
              source_id: { type: 'string' as const },
              quoted_span: { type: 'string' as const },
              supporting_token: { type: 'string' as const },
              claim_kind: { type: 'string' as const, enum: ['numeric', 'date', 'entity', 'status', 'comparison', 'causal', 'recommendation'] },
            },
            required: ['claim_id', 'claim_text', 'source_id', 'quoted_span', 'supporting_token', 'claim_kind'],
          },
        },
      },
      required: ['sources', 'claims'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const },
        grounded_ratio: { type: 'number' as const },
        source_manifest_hash: { type: 'string' as const },
        results: { type: 'array' as const, items: { type: 'object' as const } },
      },
      required: ['status', 'grounded_ratio', 'source_manifest_hash', 'results'],
    },
  },
  {
    name: 'check_claim_coverage',
    description: `ADVISORY coverage report (never blocks). Reports how many declared claims have a grounding pass (self-reported) and flags claim-like spans in the answer that map to no declared claim. The unforgeable coverage gate lives in finalize_deliverable, which re-runs grounding.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"claims":[{"id":"c1","text":"Redis executes commands single-threaded"}],"grounding_results":[{"claim_id":"c1","grounded":true}],"answer_text":"...your full answer..."}`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        claims: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: { id: { type: 'string' as const }, text: { type: 'string' as const } },
            required: ['id', 'text'],
          },
        },
        grounding_results: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: { claim_id: { type: 'string' as const }, grounded: { type: 'boolean' as const } },
            required: ['claim_id', 'grounded'],
          },
        },
        answer_text: { type: 'string' as const, minLength: 1 },
      },
      required: ['claims', 'answer_text'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const },
        declared_claim_coverage: { type: ['number', 'null'] as const },
        auto_detected_unaccounted_claims: { type: 'array' as const, items: { type: 'object' as const } },
        coverage_honest_limit: { type: 'string' as const },
      },
      required: ['status', 'auto_detected_unaccounted_claims', 'coverage_honest_limit'],
    },
  },
  {
    name: 'finalize_deliverable',
    description: `Keystone gate. RE-EXECUTES the contract's finalize_required checks inline over the supplied artifacts and PASSES only on unforgeable within-request signals: grounding re-runs (every contract claim must ground), must_include strings present / must_not_include absent in answer_text, numeric criteria values present verbatim. A supplied optional case_partition {domain,cases} is re-verified MECE inline (BLOCKS on overlap/gap); a profile-downgrade WARNING flags a declared task_type weaker than the request/answer shape. Returns answer_text_hash as a binding token so the host can confirm the surfaced answer matches. Proves declared obligations were discharged — not that the answer is true.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"contract":{"contract_id":"q1","contract_authority":"host","profile_source":"host_supplied","original_request_text":"...","task_type":"factual_qa","evidence_level":"cited","risk_level":"low","claims":[{"id":"c1","text":"..."}],"must_include":["..."]},"answer_text":"...","sources":[{"id":"s1","text":"..."}],"claims":[{"claim_id":"c1","claim_text":"...","source_id":"s1","quoted_span":"...","supporting_token":"...","claim_kind":"status"}]}`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        contract: {
          type: 'object' as const,
          properties: {
            contract_id: { type: 'string' as const },
            contract_authority: { type: 'string' as const, enum: ['host', 'user', 'derived', 'agent'] },
            profile_source: { type: 'string' as const, enum: ['host_supplied', 'inferred', 'agent_declared'] },
            original_request_text: { type: 'string' as const },
            task_type: { type: 'string' as const, enum: ['factual_qa', 'numeric_analysis', 'planning', 'decision', 'concurrency_design', 'reasoning', 'freeform'] },
            evidence_level: { type: 'string' as const, enum: ['none', 'asserted', 'cited', 'rederived'] },
            risk_level: { type: 'string' as const, enum: ['low', 'medium', 'high'] },
            claims: { type: 'array' as const, items: { type: 'object' as const } },
            acceptance_criteria: { type: 'array' as const, items: { type: 'object' as const } },
            must_include: { type: 'array' as const, items: { type: 'string' as const } },
            must_not_include: { type: 'array' as const, items: { type: 'string' as const } },
          },
          required: ['contract_id', 'original_request_text', 'task_type', 'evidence_level', 'risk_level'],
        },
        answer_text: { type: 'string' as const, minLength: 1 },
        sources: { type: 'array' as const, items: { type: 'object' as const } },
        claims: { type: 'array' as const, items: { type: 'object' as const } },
      },
      required: ['contract', 'answer_text'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const },
        finalize_verdict: { type: 'string' as const },
        answer_text_hash: { type: 'string' as const },
        answer_text_length: { type: 'number' as const },
        required_checks: { type: 'array' as const, items: { type: 'string' as const } },
        re_executed: { type: 'array' as const, items: { type: 'string' as const } },
        contract_strength: { type: 'string' as const },
      },
      required: ['status', 'finalize_verdict', 'answer_text_hash', 'contract_strength'],
    },
  },
  {
    name: 'trace_conclusion_numbers',
    description: `Verify every number in a conclusion traces to a supplied input. Each conclusion number declares its derivation (literal/identity → equals an input; derived → recompute via sum/diff/product/ratio/pct_of/mean over input indices). The tool RE-DERIVES each and BLOCKS any that fails. Unforgeable: a fabricated number won't reconcile against the separately-supplied inputs.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"inputs":[120,30],"conclusion_numbers":[{"value":150,"origin":"derived","op":"sum","input_refs":[0,1]}],"answer_text":"Total is 150/mo, a 25% saving."}

origin: literal | identity | derived. op (for derived): sum | diff | product | ratio | pct_of | mean.
Optional "answer_text" enables a WARNING for numbers present in the answer but not declared.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        inputs: { type: 'array' as const, items: { type: 'number' as const }, minItems: 1 },
        conclusion_numbers: {
          type: 'array' as const,
          minItems: 1,
          items: {
            type: 'object' as const,
            properties: {
              value: { type: 'number' as const },
              origin: { type: 'string' as const, enum: ['literal', 'identity', 'derived'] },
              op: { type: 'string' as const, enum: ['sum', 'diff', 'product', 'ratio', 'pct_of', 'mean'] },
              input_refs: { type: 'array' as const, items: { type: 'number' as const } },
            },
            required: ['value', 'origin', 'input_refs'],
          },
        },
        answer_text: { type: 'string' as const },
        tolerance: { type: 'number' as const, description: 'Relative tolerance (default 0.005).' },
      },
      required: ['inputs', 'conclusion_numbers'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const },
        traced_ratio: { type: 'number' as const },
        results: { type: 'array' as const, items: { type: 'object' as const } },
        untraced_answer_numbers: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['status', 'traced_ratio', 'results'],
    },
  },
  {
    name: 'check_answer_against_constraints',
    description: `Restate-and-diff. Restate the question's hard constraints as predicates {field, op, value, source_quote} and supply the answer as structured key→value data. The tool evaluates every predicate against the data. BLOCKS on a violated constraint, an absent field, a numeric bound that is not present in its own source_quote, or a missing required_field. Anchor source_quote to the original request so constraints can't be quietly weakened.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"answer":{"status":"ok","price":80},"constraints":[{"field":"price","op":"<","value":100,"source_quote":"price under 100"}],"original_request_text":"Return JSON with status and a price under 100."}

op: < | <= | > | >= | == | != | in | not_in | subset_of`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        answer: { type: 'object' as const, description: 'Structured key→value answer data.' },
        constraints: {
          type: 'array' as const,
          minItems: 1,
          items: {
            type: 'object' as const,
            properties: {
              field: { type: 'string' as const },
              op: { type: 'string' as const, enum: ['<', '<=', '>', '>=', '==', '!=', 'in', 'not_in', 'subset_of'] },
              value: {},
              source_quote: { type: 'string' as const },
            },
            required: ['field', 'op', 'value'],
          },
        },
        original_request_text: { type: 'string' as const },
        required_fields: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['answer', 'constraints'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const },
        violations: { type: 'array' as const, items: { type: 'object' as const } },
        missing_required_fields: { type: 'array' as const, items: { type: 'string' as const } },
        flagged_uncovered_fields: { type: 'array' as const, items: { type: 'string' as const } },
        satisfied_count: { type: 'number' as const },
      },
      required: ['status', 'violations'],
    },
  },
  {
    name: 'check_freshness',
    description: `Check staleness of dated sources by pure interval arithmetic. The server has NO clock — supply eval_time {value, authority}. Compares each source's published_at against eval_time vs max_age_seconds. BLOCKS only when authority="host": a source dated after eval_time (contradiction), or — if requires_dated_sources — a stale/undated source. Agent-supplied time yields warnings only. Cannot verify a date is truthful; catches "current" answers built on stale evidence.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"eval_time":{"value":"2026-05-30T00:00:00Z","authority":"host"},"max_age_seconds":2592000,"requires_dated_sources":true,"sources":[{"id":"s1","published_at":"2026-05-20T00:00:00Z"}]}

eval_time.value: ISO-8601 (UTC) or epoch-ms. authority: host | agent.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        eval_time: {
          type: 'object' as const,
          properties: {
            value: { type: 'string' as const, description: 'ISO-8601 UTC or epoch-ms (string).' },
            authority: { type: 'string' as const, enum: ['host', 'agent'] },
          },
          required: ['value', 'authority'],
        },
        max_age_seconds: { type: 'number' as const, minimum: 0 },
        requires_dated_sources: { type: 'boolean' as const },
        sources: {
          type: 'array' as const,
          minItems: 1,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const },
              published_at: { type: 'string' as const, description: 'ISO-8601 UTC or epoch-ms.' },
            },
            required: ['id'],
          },
        },
      },
      required: ['eval_time', 'max_age_seconds', 'sources'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const },
        eval_time_iso: { type: 'string' as const },
        authority: { type: 'string' as const },
        stale_ratio: { type: 'number' as const },
        results: { type: 'array' as const, items: { type: 'object' as const } },
      },
      required: ['status', 'stale_ratio', 'results'],
    },
  },
  {
    name: 'check_case_partition',
    description: `Check that a declared case split is MECE (Mutually Exclusive, Collectively Exhaustive) over a stated variable + domain. Supply the partition as explicit numeric intervals or enum member-sets — not prose. BLOCKS on any overlap, interior gap, or leading/trailing gap vs the domain (pure interval/set arithmetic).

REQUIRED INPUT FORMAT (numeric):
{"variable":"cpu_load","domain":{"type":"numeric","min":0,"max":100},"cases":[{"label":"low","lo":0,"hi":50},{"label":"high","lo":50,"hi":100,"hi_inclusive":true}]}

REQUIRED INPUT FORMAT (enum):
{"variable":"cache_state","domain":{"type":"enum","values":["warm","cold","evicting"]},"cases":[{"label":"hit","members":["warm"]},{"label":"miss","members":["cold","evicting"]}]}

Numeric cases default to half-open [lo, hi); set lo_inclusive/hi_inclusive to override. Omitted lo/hi mean ±Infinity.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        variable: { type: 'string' as const },
        domain: {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const, enum: ['numeric', 'enum'] },
            min: { type: 'number' as const },
            max: { type: 'number' as const },
            values: { type: 'array' as const, items: { type: 'string' as const } },
          },
          required: ['type'],
        },
        cases: {
          type: 'array' as const,
          minItems: 2,
          items: {
            type: 'object' as const,
            properties: {
              label: { type: 'string' as const },
              lo: { type: 'number' as const },
              hi: { type: 'number' as const },
              lo_inclusive: { type: 'boolean' as const },
              hi_inclusive: { type: 'boolean' as const },
              members: { type: 'array' as const, items: { type: 'string' as const } },
            },
            required: ['label'],
          },
        },
      },
      required: ['domain', 'cases'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const },
        is_mece: { type: 'boolean' as const },
        gaps: { type: 'array' as const, items: { type: 'string' as const } },
        overlaps: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['status', 'is_mece', 'gaps', 'overlaps'],
    },
  },
  {
    name: 'check_profile_downgrade',
    description: `Detect when a declared task_type is weaker than the request/answer shape implies — the easiest way for a rushed agent to dodge the stricter check profile. WARNING-ONLY (status always PASS); a host strict mode may reject a flagged downgrade.

REQUIRED INPUT FORMAT — copy this structure exactly:
{"original_request_text":"Which option should we choose?","declared_task_type":"freeform","answer_text":"You should choose option B because..."}

declared_task_type: factual_qa | numeric_analysis | planning | decision | concurrency_design | reasoning | freeform`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        original_request_text: { type: 'string' as const },
        declared_task_type: { type: 'string' as const, enum: ['factual_qa', 'numeric_analysis', 'planning', 'decision', 'concurrency_design', 'reasoning', 'freeform'] },
        answer_text: { type: 'string' as const },
      },
      required: ['original_request_text', 'declared_task_type', 'answer_text'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string' as const },
        declared_task_type: { type: 'string' as const },
        inferred_task_type: { type: 'string' as const },
        suspected_downgrades: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['status', 'suspected_downgrades'],
    },
  },
];

// Output schemas for the original 9 tools (the 9 new tools declare theirs inline).
// Conservative: `required: ['status']` only; extra fields (enforcement, context_used,
// truncation) are permitted (JSON Schema additionalProperties defaults to true).
const NUM = { type: 'number' as const };
const STR = { type: 'string' as const };
const BOOL = { type: 'boolean' as const };
const ARR = { type: 'array' as const };
const OBJ = { type: 'object' as const };
const ORIGINAL_OUTPUT_SCHEMAS: Record<string, object> = {
  validate_reasoning_chain: {
    type: 'object', required: ['status'],
    properties: { status: STR, cycles: ARR, orphaned_conclusions: ARR, grounding_score: NUM, node_count: NUM, edge_count: NUM },
  },
  check_numeric_claims: {
    type: 'object', required: ['status'],
    properties: { status: STR, fabrication: OBJ, outliers: ARR, arithmetic: OBJ, monotonicity: OBJ, count: NUM },
  },
  detect_drift: {
    type: 'object', required: ['status'],
    properties: { status: STR, drift_detected: BOOL, drift_point: { type: ['number', 'null'] as const }, cusum_max: NUM, threshold: NUM, cusum_series: ARR, monotonic_progress: OBJ },
  },
  evaluate_tradeoffs: {
    type: 'object', required: ['status'],
    properties: { status: STR, ranked_options: ARR, recommended: { type: ['string', 'null'] as const }, is_indeterminate: BOOL, eu_spread: NUM },
  },
  check_plan_validity: {
    type: 'object', required: ['status'],
    properties: { status: STR, is_valid: BOOL, circular_dependencies: ARR, missing_prerequisites: ARR, resource_conflicts: ARR, completeness_score: NUM, critical_path: ARR, step_count: NUM, failure_branch_coverage: NUM },
  },
  score_response_quality: {
    type: 'object', required: ['status'],
    properties: { status: STR, overall_score: NUM, substance_score: NUM, specificity_score: NUM, hedge_density: NUM, structure_score: NUM, improvement_prompt: STR },
  },
  validate_confidence: {
    type: 'object', required: ['status'],
    properties: { status: STR, honest_ceiling: NUM, claimed_confidence: { type: ['number', 'null'] as const }, gap: NUM, inflation_detected: BOOL, dependency_weights: ARR, falsifiability: OBJ, assumption_count: NUM },
  },
  verify_arithmetic: {
    type: 'object', required: ['status'],
    properties: { status: STR, claim_type: STR, computed_result: NUM, claimed_result: NUM, difference: NUM, within_tolerance: BOOL },
  },
  detect_concurrency_patterns: {
    type: 'object', required: ['status'],
    properties: { status: STR, patterns_detected: ARR, hazard_count: NUM, critical_count: NUM, has_protections: BOOL },
  },
};

for (const tool of ALL_TOOLS) {
  const t = tool as { name: string; outputSchema?: object };
  if (!t.outputSchema && ORIGINAL_OUTPUT_SCHEMAS[t.name]) {
    t.outputSchema = ORIGINAL_OUTPUT_SCHEMAS[t.name];
  }
}

// Deliverable-centric leaf checks: internal primitives, NOT part of the public
// MCP surface. finalize_deliverable re-executes the blocking ones (grounding,
// number tracing, constraints, freshness) inline; the advisory ones
// (claim_coverage, profile_downgrade) and case_partition remain available to the
// engine but are not separately agent-callable. Public surface = 9 benchmarked
// analyzers + the plan_checks → finalize_deliverable spine = 11 tools.
const INTERNAL_TOOL_NAMES = new Set<string>([
  'check_quote_grounding',
  'check_claim_coverage',
  'trace_conclusion_numbers',
  'check_answer_against_constraints',
  'check_freshness',
  'check_case_partition',
  'check_profile_downgrade',
]);

export const TOOLS = ALL_TOOLS.filter(tool => !INTERNAL_TOOL_NAMES.has(tool.name));
