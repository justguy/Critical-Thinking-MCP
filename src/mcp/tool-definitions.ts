// Shared MCP tool metadata, kept separate so server wiring stays small.

export const TOOLS = [
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
        context: {
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
        },
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
        context: {
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
        },
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

Optionally pass "context" with prior iteration data for escalation and stall detection. Numeric-series drift only; NOT a retry-contract drift detector (see Phalanx R-8).`,
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
        context: {
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
        },
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
        context: {
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
        },
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
            },
            required: ['id', 'description', 'dependencies'],
          },
          minItems: 2,
          description: 'Array of at least 2 plan steps',
        },
        context: {
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
        },
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

Optionally pass "context" with prior iteration data for escalation and stall detection. Entity grounding here is scoped to response-text entities; NOT repo-level seam, symbol, or file-existence checking (see Phalanx R-5).`,
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
        context: {
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
        },
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
        context: {
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
        },
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
  {
    name: 'integrate_phalanx_check',
    description: 'Normalized Phalanx integration envelope: accepts a PhalanxCtCall and returns a CtVerdict by routing to the appropriate ct-mcp tools. Supply at least one of: assumptions (validate_confidence), claims (validate_reasoning_chain), steps (check_plan_validity), or operations (detect_concurrency_patterns).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        call_id: {
          type: 'string' as const,
          description: 'Unique identifier for this call, used for deterministic objection_id derivation',
        },
        phase: {
          type: 'string' as const,
          enum: ['planning', 'blueprint_convergence', 'execution_retry', 'verification', 'closeout'],
          description: 'Phalanx pipeline phase that initiated this check',
        },
        piece_id: {
          type: ['string', 'null'] as unknown as 'string',
          description: 'Piece identifier (string or null)',
        },
        run_id: {
          type: 'string' as const,
          description: 'Run identifier for traceability',
        },
        payload: {
          type: 'object' as const,
          description: 'Check payload — supply at least one of: assumptions, claims, steps, or operations',
          properties: {
            assumptions: {
              type: 'object' as const,
              description: 'Confidence check payload (validate_confidence)',
              properties: {
                assumptions: {
                  type: 'array' as const,
                  items: {
                    type: 'object' as const,
                    properties: {
                      description: { type: 'string' as const },
                      confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
                      falsification_condition: { type: 'string' as const },
                    },
                    required: ['description', 'confidence'],
                  },
                  minItems: 1,
                },
                response_text: { type: 'string' as const, minLength: 10 },
              },
              required: ['assumptions', 'response_text'],
            },
            claims: {
              type: 'object' as const,
              description: 'Reasoning chain payload (validate_reasoning_chain)',
              properties: {
                nodes: {
                  type: 'array' as const,
                  items: {
                    type: 'object' as const,
                    properties: {
                      id: { type: 'string' as const },
                      label: { type: 'string' as const },
                      type: {
                        type: 'string' as const,
                        enum: ['claim', 'evidence', 'conclusion', 'assumption'],
                      },
                    },
                    required: ['id', 'label', 'type'],
                  },
                  minItems: 2,
                },
                edges: {
                  type: 'array' as const,
                  items: {
                    type: 'object' as const,
                    properties: {
                      from: { type: 'string' as const },
                      to: { type: 'string' as const },
                      relation: {
                        type: 'string' as const,
                        enum: ['supports', 'implies', 'contradicts', 'requires'],
                      },
                    },
                    required: ['from', 'to', 'relation'],
                  },
                  minItems: 1,
                },
              },
              required: ['nodes', 'edges'],
            },
            steps: {
              type: 'object' as const,
              description: 'Plan validity check payload (check_plan_validity)',
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
                    },
                    required: ['id', 'description', 'dependencies'],
                  },
                  minItems: 2,
                  description: 'Array of plan steps (at least 2 to match check_plan_validity minimum)',
                },
              },
              required: ['steps'],
            },
            operations: {
              type: 'object' as const,
              description: 'Concurrency hazard check payload (detect_concurrency_patterns)',
              properties: {
                steps: {
                  type: 'array' as const,
                  items: { type: 'string' as const },
                  minItems: 1,
                  description: 'Ordered sequence of operation steps (strings)',
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
        },
      },
      required: ['call_id', 'phase', 'piece_id', 'run_id', 'payload'],
    },
  },
];
