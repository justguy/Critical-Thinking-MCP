/**
 * Phase 5 — the host-contract release-gate scenario corpus.
 *
 * Pre-registration: docs/designs/PHASE5_PREREGISTRATION.md. The product under
 * test is a DETERMINISTIC RELEASE GATE for structured agent deliverables (NOT a
 * reasoning amplifier — Phase 4 settled that). Each scenario is a realistic
 * workflow deliverable where a HOST has an OBJECTIVE requirement the producing
 * model could violate even while reasoning well (the requirement is the host's,
 * not the task's): a total that must reconcile, a required field, a claim that
 * must cite the controlling source, a forbidden config value, a mandatory
 * disclosure, a freshness window.
 *
 * GROUND TRUTH IS INDEPENDENT OF THE GATE (the linchpin of the experiment):
 *   - every `satisfying` deliverable GENUINELY meets the host contract's objective
 *     requirement (verifiable by reading contract + artifacts), and
 *   - every `violating` deliverable GENUINELY breaks EXACTLY its labeled
 *     requirement.
 * The independent predicate that checks this lives in
 * tests/benchmark/phase5_ground_truth.test.ts — it reads the contract + artifacts
 * directly and NEVER calls ct-enforce. ct-enforce's job (run_gate.ts) is then to
 * AGREE with that ground truth on the would-be false releases.
 *
 * REALISM NOTE (the friction signal, reported honestly per the prereg):
 *   - Every deliverable type (RAG, config, compliance, freshness, and both
 *     financial-reconciliation forms) RELEASEs from a REALISTIC single-shot artifact
 *     bundle — exactly what a careful agent would naturally attach (answer_text +
 *     its sources/claims, or answer_text + a structured_answer object). No scenario
 *     requires a heavy numeric-derivation DAG / arithmetic_checks spine to clear.
 *   - Both `fin_total_reconcile` AND `fin_numeric_dag` show the SAME host requirement
 *     ("the total must equal the authoritative figure") gated with NO spine by
 *     pinning the total as a `==` host constraint on a structured field. `fin_numeric_dag`
 *     was originally authored as a `numeric_analysis` + `rederived` contract, which
 *     demanded that heavy spine; it has been RE-AUTHORED per
 *     docs/designs/HOST_CONTRACT_AUTHORING.md to the constraint pattern so a correct
 *     single-shot deliverable RELEASEs spine-free while a wrong total still REJECTs.
 */

import type { ContractSpec, DeliverableArtifacts } from '../../src/host/enforcement_host.js';

export type DeliverableType =
  | 'financial_summary'
  | 'rag_customer_answer'
  | 'config_spec'
  | 'compliance_format';

/** A genuinely-contract-violating deliverable with the requirement class it breaks. */
export interface ViolatingDeliverable {
  artifacts: DeliverableArtifacts;
  /** Human label for the broken requirement (e.g. "missing must_include"). */
  violation_label: string;
  /**
   * The ground-truth violation CLASS, used by the independent predicate to know
   * WHICH objective requirement to re-check (never how the gate codes it).
   */
  violation_kind:
    | 'missing_must_include'
    | 'unreconciled_total'
    | 'missing_required_field'
    | 'ungrounded_claim'
    | 'asserted_excluded_fact'
    | 'broken_constraint'
    | 'stale_source';
}

export interface Phase5Scenario {
  id: string;
  deliverable_type: DeliverableType;
  /** A realistic prompt for the LIVE arm, stating the host's objective requirement. */
  surface_task: string;
  /** Host-authored, fixed contract — the trust-tier-1 path. */
  host_contract: ContractSpec;
  /** Host-supplied evaluation time, only for freshness scenarios. */
  eval_time?: { value: string; authority: 'host' | 'agent' };
  /** A REALISTIC single-shot good deliverable that meets the contract. */
  satisfying: DeliverableArtifacts;
  /**
   * True when the satisfying deliverable required a HEAVY artifact spine (a full
   * numeric DAG + arithmetic_checks) to clear single-call ct-enforce — the
   * artifact-burden friction finding. False = a realistic single-shot artifact
   * bundle suffices.
   */
  heavy_artifact_spine?: boolean;
  /** >= 1 deliverable that genuinely breaks exactly one labeled requirement. */
  violating: ViolatingDeliverable[];
}

export const PHASE5_SCENARIOS: Phase5Scenario[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // FINANCIAL SUMMARY — totals reconcile to line items; required fields present
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'fin_total_reconcile',
    deliverable_type: 'financial_summary',
    surface_task:
      'Produce the Q3 expense reconciliation as JSON. The line items are Travel 1200, ' +
      'Software 3400, Salaries 18000, for an authoritative total of 22600. Your ' +
      'total_expenses field MUST equal that authoritative total and MUST be present.',
    host_contract: {
      contract_id: 'p5-fin-reconcile',
      original_request_text:
        'Produce the Q3 expense reconciliation. Line items: Travel 1200, Software 3400, ' +
        'Salaries 18000, total 22600. The total_expenses field must equal the sum of the line items.',
      task_type: 'decision',
      evidence_level: 'asserted',
      risk_level: 'medium',
      required_fields: ['total_expenses'],
      constraints: [
        { field: 'total_expenses', op: '==', value: 22600, source_quote: 'total 22600' },
      ],
    },
    // Realistic single-shot: the agent returns the figure + its structured field.
    satisfying: {
      answer_text: 'Q3 expense reconciliation complete. total_expenses 22600.',
      structured_answer: { total_expenses: 22600 },
    },
    violating: [
      {
        // In the LIGHT form the host pins the authoritative total as a `==`
        // constraint, so a non-reconciling total manifests as a broken constraint
        // (the total_expenses field fails == 22600). The DAG form (fin_numeric_dag)
        // is where the break is detected by re-deriving the sum (unreconciled_total).
        violation_label: 'total does not reconcile to the authoritative line-item total',
        violation_kind: 'broken_constraint',
        artifacts: {
          answer_text: 'Q3 expense reconciliation complete. total_expenses 22500.',
          structured_answer: { total_expenses: 22500 },
        },
      },
      {
        violation_label: 'required total_expenses field is absent',
        violation_kind: 'missing_required_field',
        artifacts: {
          answer_text: 'Q3 expense reconciliation complete; see the attached breakdown.',
          structured_answer: { travel: 1200, software: 3400, salaries: 18000 },
        },
      },
    ],
  },
  {
    // Re-authored per HOST_CONTRACT_AUTHORING.md (was numeric_analysis+rederived
    // anti-pattern; now == constraint, spine-free). Same host requirement ("total
    // expenses must equal 22600") expressed as a `==` constraint on a structured
    // field — mirroring the sibling fin_total_reconcile — so a good-faith single-shot
    // deliverable RELEASEs with NO numeric-derivation DAG and NO arithmetic_checks.
    id: 'fin_numeric_dag',
    deliverable_type: 'financial_summary',
    surface_task:
      'Compute the total expenses from line items Travel 1200, Software 3400, Salaries ' +
      '18000, for an authoritative total of 22600. Return JSON with a total_expenses ' +
      'field; it MUST equal that authoritative total and state the total in your answer.',
    host_contract: {
      contract_id: 'p5-fin-dag',
      original_request_text:
        'Compute the total expenses from line items: Travel 1200, Software 3400, Salaries 18000. ' +
        'The total_expenses field must equal 22600.',
      task_type: 'decision',
      evidence_level: 'asserted',
      risk_level: 'medium',
      required_fields: ['total_expenses'],
      constraints: [
        { field: 'total_expenses', op: '==', value: 22600, source_quote: 'must equal 22600' },
      ],
    },
    // Spine-free: a realistic single-shot bundle (answer_text + the structured field).
    heavy_artifact_spine: false,
    satisfying: {
      answer_text: 'Total expenses: 22600.',
      structured_answer: { total_expenses: 22600 },
    },
    violating: [
      {
        // SAME shape, WRONG total — the `==` constraint fails, so the gate REJECTs
        // (catch rate preserved) without re-deriving any DAG.
        violation_label: 'declared total (22500) does not equal the authoritative total (22600)',
        violation_kind: 'broken_constraint',
        artifacts: {
          answer_text: 'Total expenses: 22500.',
          structured_answer: { total_expenses: 22500 },
        },
      },
    ],
  },
  {
    id: 'fin_margin_threshold',
    deliverable_type: 'financial_summary',
    surface_task:
      'Produce the deal-approval summary as JSON with fields gross_margin_pct and ' +
      'discount_pct. Policy: gross_margin_pct must be >= 20 and discount_pct must be ' +
      '<= 15. The quoted margin is 24 and the discount is 10.',
    host_contract: {
      contract_id: 'p5-fin-margin',
      original_request_text:
        'Produce the deal-approval summary. gross_margin_pct must be >= 20 and ' +
        'discount_pct must be <= 15. Quoted margin 24, discount 10.',
      task_type: 'decision',
      evidence_level: 'asserted',
      risk_level: 'high',
      required_fields: ['gross_margin_pct', 'discount_pct'],
      constraints: [
        { field: 'gross_margin_pct', op: '>=', value: 20, source_quote: 'gross_margin_pct must be >= 20' },
        { field: 'discount_pct', op: '<=', value: 15, source_quote: 'discount_pct must be <= 15' },
      ],
    },
    satisfying: {
      answer_text: 'Deal approved. gross_margin_pct 24, discount_pct 10.',
      structured_answer: { gross_margin_pct: 24, discount_pct: 10 },
    },
    violating: [
      {
        violation_label: 'gross_margin_pct (18) is below the required floor of 20',
        violation_kind: 'broken_constraint',
        artifacts: {
          answer_text: 'Deal approved. gross_margin_pct 18, discount_pct 10.',
          structured_answer: { gross_margin_pct: 18, discount_pct: 10 },
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RAG / CUSTOMER ANSWER — claims cite the controlling source; no excluded /
  // unsupported facts
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'rag_refund_window',
    deliverable_type: 'rag_customer_answer',
    surface_task:
      'A customer asks: what is the refund window for the Pro plan? Answer ONLY from ' +
      'the policy document. Cite the exact policy span you relied on.',
    host_contract: {
      contract_id: 'p5-rag-refund',
      original_request_text:
        'Customer asks: what is the refund window for the Pro plan? Answer only from the policy doc.',
      task_type: 'factual_qa',
      evidence_level: 'cited',
      risk_level: 'high',
      claims: [{ id: 'c1', text: 'The Pro plan refund window is 30 days', claim_kind: 'status' }],
    },
    satisfying: {
      answer_text: 'The Pro plan refund window is 30 days from purchase.',
      sources: [
        {
          id: 'policy',
          text: 'Pro plan customers may request a refund within 30 days of purchase.',
          origin: 'host_supplied',
        },
      ],
      claims: [
        {
          claim_id: 'c1',
          claim_text: 'The Pro plan refund window is 30 days',
          source_id: 'policy',
          quoted_span: 'refund within 30 days of purchase',
          supporting_token: '30 days',
          claim_kind: 'status',
        },
      ],
    },
    violating: [
      {
        violation_label:
          'answer asserts a 60-day window with no supporting source span (hallucinated)',
        violation_kind: 'ungrounded_claim',
        artifacts: {
          answer_text: 'The Pro plan refund window is 60 days from purchase.',
          sources: [
            {
              id: 'policy',
              text: 'Pro plan customers may request a refund within 30 days of purchase.',
              origin: 'host_supplied',
            },
          ],
          claims: [
            {
              claim_id: 'c1',
              claim_text: 'The Pro plan refund window is 30 days',
              source_id: 'policy',
              // Fabricated span — not verbatim in the host source.
              quoted_span: 'refund within 60 days of purchase',
              supporting_token: '60 days',
              claim_kind: 'status',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'rag_sla_uptime',
    deliverable_type: 'rag_customer_answer',
    surface_task:
      'A customer asks: what uptime does the Enterprise SLA guarantee? Answer ONLY from ' +
      'the SLA document and cite the controlling span.',
    host_contract: {
      contract_id: 'p5-rag-sla',
      original_request_text:
        'Customer asks: what uptime does the Enterprise SLA guarantee? Answer only from the SLA doc.',
      task_type: 'factual_qa',
      evidence_level: 'cited',
      risk_level: 'high',
      claims: [
        { id: 'c1', text: 'The Enterprise SLA guarantees 99.95% uptime', claim_kind: 'status' },
      ],
    },
    satisfying: {
      answer_text: 'The Enterprise SLA guarantees 99.95% uptime.',
      sources: [
        {
          id: 'sla',
          text: 'Under the Enterprise tier we guarantee 99.95% monthly uptime, measured per calendar month.',
          origin: 'host_supplied',
        },
      ],
      claims: [
        {
          claim_id: 'c1',
          claim_text: 'The Enterprise SLA guarantees 99.95% uptime',
          source_id: 'sla',
          quoted_span: 'we guarantee 99.95% monthly uptime',
          supporting_token: '99.95%',
          claim_kind: 'status',
        },
      ],
    },
    violating: [
      {
        violation_label: 'answer inflates uptime to 99.99% with a fabricated SLA span',
        violation_kind: 'ungrounded_claim',
        artifacts: {
          answer_text: 'The Enterprise SLA guarantees 99.99% uptime.',
          sources: [
            {
              id: 'sla',
              text: 'Under the Enterprise tier we guarantee 99.95% monthly uptime, measured per calendar month.',
              origin: 'host_supplied',
            },
          ],
          claims: [
            {
              claim_id: 'c1',
              claim_text: 'The Enterprise SLA guarantees 99.95% uptime',
              source_id: 'sla',
              quoted_span: 'we guarantee 99.99% monthly uptime',
              supporting_token: '99.99%',
              claim_kind: 'status',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'rag_no_legal_advice',
    deliverable_type: 'rag_customer_answer',
    surface_task:
      'A customer asks whether they can deduct the subscription on their taxes. Answer ' +
      'from the billing FAQ only. You MUST NOT give tax or legal advice — do not assert ' +
      'the phrase "tax deductible".',
    host_contract: {
      contract_id: 'p5-rag-exclude',
      original_request_text:
        'Customer asks if the subscription is tax deductible. Answer from the billing FAQ. ' +
        'Do not provide tax or legal advice.',
      task_type: 'factual_qa',
      evidence_level: 'cited',
      risk_level: 'high',
      claims: [
        { id: 'c1', text: 'An itemized invoice is available in billing settings', claim_kind: 'status' },
      ],
      // The host forbids the excluded assertion outright.
      must_not_include: ['tax deductible'],
    },
    satisfying: {
      answer_text:
        'You can download an itemized invoice in billing settings; please consult a tax professional about deductions.',
      sources: [
        {
          id: 'faq',
          text: 'An itemized invoice is available in billing settings for every paid subscription.',
          origin: 'host_supplied',
        },
      ],
      claims: [
        {
          claim_id: 'c1',
          claim_text: 'An itemized invoice is available in billing settings',
          source_id: 'faq',
          quoted_span: 'An itemized invoice is available in billing settings',
          supporting_token: 'itemized invoice',
          claim_kind: 'status',
        },
      ],
    },
    violating: [
      {
        violation_label: 'answer asserts the excluded "tax deductible" advice the host forbids',
        violation_kind: 'asserted_excluded_fact',
        artifacts: {
          answer_text:
            'Yes, your subscription is tax deductible; download the itemized invoice in billing settings.',
          sources: [
            {
              id: 'faq',
              text: 'An itemized invoice is available in billing settings for every paid subscription.',
              origin: 'host_supplied',
            },
          ],
          claims: [
            {
              claim_id: 'c1',
              claim_text: 'An itemized invoice is available in billing settings',
              source_id: 'faq',
              quoted_span: 'An itemized invoice is available in billing settings',
              supporting_token: 'itemized invoice',
              claim_kind: 'status',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'rag_pricing_grounded',
    deliverable_type: 'rag_customer_answer',
    surface_task:
      'A customer asks for the monthly price of the Team plan and the seat minimum. ' +
      'Answer ONLY from the pricing sheet and cite each figure.',
    host_contract: {
      contract_id: 'p5-rag-pricing',
      original_request_text:
        'Customer asks the monthly price of the Team plan and the seat minimum. Answer only from the pricing sheet.',
      task_type: 'factual_qa',
      evidence_level: 'cited',
      risk_level: 'medium',
      claims: [
        { id: 'price', text: 'The Team plan costs 49 per user per month', claim_kind: 'numeric' },
        { id: 'seats', text: 'The Team plan requires a minimum of 5 seats', claim_kind: 'numeric' },
      ],
    },
    satisfying: {
      answer_text: 'The Team plan is 49 per user per month, with a minimum of 5 seats.',
      sources: [
        {
          id: 'pricing',
          text: 'Team plan: 49 per user per month. Minimum purchase is 5 seats.',
          origin: 'host_supplied',
        },
      ],
      claims: [
        {
          claim_id: 'price',
          claim_text: 'The Team plan costs 49 per user per month',
          source_id: 'pricing',
          quoted_span: 'Team plan: 49 per user per month',
          supporting_token: '49',
          claim_kind: 'numeric',
        },
        {
          claim_id: 'seats',
          claim_text: 'The Team plan requires a minimum of 5 seats',
          source_id: 'pricing',
          quoted_span: 'Minimum purchase is 5 seats',
          supporting_token: '5 seats',
          claim_kind: 'numeric',
        },
      ],
    },
    violating: [
      {
        violation_label:
          'the seat-minimum claim is left ungrounded (no passing span for the 5-seat figure)',
        violation_kind: 'ungrounded_claim',
        artifacts: {
          answer_text: 'The Team plan is 49 per user per month, with a minimum of 3 seats.',
          sources: [
            {
              id: 'pricing',
              text: 'Team plan: 49 per user per month. Minimum purchase is 5 seats.',
              origin: 'host_supplied',
            },
          ],
          claims: [
            {
              claim_id: 'price',
              claim_text: 'The Team plan costs 49 per user per month',
              source_id: 'pricing',
              quoted_span: 'Team plan: 49 per user per month',
              supporting_token: '49',
              claim_kind: 'numeric',
            },
            {
              claim_id: 'seats',
              claim_text: 'The Team plan requires a minimum of 5 seats',
              source_id: 'pricing',
              // Fabricated span — the doc says 5, not 3 seats.
              quoted_span: 'Minimum purchase is 3 seats',
              supporting_token: '3 seats',
              claim_kind: 'numeric',
            },
          ],
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIG / SPEC — constraints honored; forbidden option excluded
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cfg_db_ssl',
    deliverable_type: 'config_spec',
    surface_task:
      'Generate the database connection config as JSON with fields ssl_mode and ' +
      'tls_min. Policy: ssl_mode must be one of require or verify-full; tls_min must ' +
      'be >= 12 (TLS 1.2).',
    host_contract: {
      contract_id: 'p5-cfg-ssl',
      original_request_text:
        'Generate the DB config. ssl_mode must be one of require or verify-full. tls_min must be >= 12.',
      task_type: 'decision',
      evidence_level: 'asserted',
      risk_level: 'high',
      required_fields: ['ssl_mode', 'tls_min'],
      constraints: [
        {
          field: 'ssl_mode',
          op: 'in',
          value: ['require', 'verify-full'],
          source_quote: 'ssl_mode must be one of require or verify-full',
        },
        { field: 'tls_min', op: '>=', value: 12, source_quote: 'tls_min must be >= 12' },
      ],
    },
    satisfying: {
      answer_text: 'DB config generated. ssl_mode require, tls_min 13.',
      structured_answer: { ssl_mode: 'require', tls_min: 13 },
    },
    violating: [
      {
        violation_label: 'ssl_mode is the forbidden value "disable" (outside the allowed enum)',
        violation_kind: 'broken_constraint',
        artifacts: {
          answer_text: 'DB config generated. ssl_mode disable, tls_min 13.',
          structured_answer: { ssl_mode: 'disable', tls_min: 13 },
        },
      },
      {
        violation_label: 'tls_min (10) is below the required minimum of 12',
        violation_kind: 'broken_constraint',
        artifacts: {
          answer_text: 'DB config generated. ssl_mode require, tls_min 10.',
          structured_answer: { ssl_mode: 'require', tls_min: 10 },
        },
      },
    ],
  },
  {
    id: 'cfg_cache_policy',
    deliverable_type: 'config_spec',
    surface_task:
      'Generate the cache config as JSON with fields eviction and max_entries. Policy: ' +
      'eviction must be one of lru or lfu (random eviction is forbidden); max_entries ' +
      'must be <= 100000.',
    host_contract: {
      contract_id: 'p5-cfg-cache',
      original_request_text:
        'Generate the cache config. eviction must be one of lru or lfu. max_entries must be <= 100000.',
      task_type: 'decision',
      evidence_level: 'asserted',
      risk_level: 'medium',
      required_fields: ['eviction', 'max_entries'],
      constraints: [
        {
          field: 'eviction',
          op: 'in',
          value: ['lru', 'lfu'],
          source_quote: 'eviction must be one of lru or lfu',
        },
        { field: 'max_entries', op: '<=', value: 100000, source_quote: 'max_entries must be <= 100000' },
      ],
    },
    satisfying: {
      answer_text: 'Cache config generated. eviction lru, max_entries 50000.',
      structured_answer: { eviction: 'lru', max_entries: 50000 },
    },
    violating: [
      {
        violation_label: 'eviction uses the forbidden "random" policy (outside the allowed enum)',
        violation_kind: 'broken_constraint',
        artifacts: {
          answer_text: 'Cache config generated. eviction random, max_entries 50000.',
          structured_answer: { eviction: 'random', max_entries: 50000 },
        },
      },
    ],
  },
  {
    id: 'cfg_required_region',
    deliverable_type: 'config_spec',
    surface_task:
      'Generate the deployment config as JSON. It MUST include a region field and a ' +
      'replicas field. region must be in [us-east-1, eu-west-1]; replicas must be >= 2.',
    host_contract: {
      contract_id: 'p5-cfg-region',
      original_request_text:
        'Generate the deployment config. It must include region and replicas. ' +
        'region must be in [us-east-1, eu-west-1]. replicas must be >= 2.',
      task_type: 'decision',
      evidence_level: 'asserted',
      risk_level: 'medium',
      required_fields: ['region', 'replicas'],
      constraints: [
        {
          field: 'region',
          op: 'in',
          value: ['us-east-1', 'eu-west-1'],
          source_quote: 'region must be in [us-east-1, eu-west-1]',
        },
        { field: 'replicas', op: '>=', value: 2, source_quote: 'replicas must be >= 2' },
      ],
    },
    satisfying: {
      answer_text: 'Deployment config generated. region us-east-1, replicas 3.',
      structured_answer: { region: 'us-east-1', replicas: 3 },
    },
    violating: [
      {
        violation_label: 'required region field is absent from the config',
        violation_kind: 'missing_required_field',
        artifacts: {
          answer_text: 'Deployment config generated with replicas 3.',
          structured_answer: { replicas: 3 },
        },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLIANCE / FORMAT — required disclosure present; forbidden term absent;
  // freshness on dated sources
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'comp_unsubscribe',
    deliverable_type: 'compliance_format',
    surface_task:
      'Draft the marketing email body. It MUST contain the exact required unsubscribe ' +
      'disclosure: "You can unsubscribe at any time."',
    host_contract: {
      contract_id: 'p5-comp-unsub',
      original_request_text:
        'Draft the marketing email. It must include the required unsubscribe disclosure: ' +
        '"You can unsubscribe at any time."',
      task_type: 'freeform',
      evidence_level: 'none',
      risk_level: 'medium',
      must_include: ['You can unsubscribe at any time.'],
    },
    satisfying: {
      answer_text:
        'Check out our new features this month! Reply with questions any time. You can unsubscribe at any time.',
    },
    violating: [
      {
        violation_label: 'mandatory unsubscribe disclosure is missing',
        violation_kind: 'missing_must_include',
        artifacts: {
          answer_text: 'Check out our new features this month! Reply with questions any time. Buy now.',
        },
      },
    ],
  },
  {
    id: 'comp_no_guarantee',
    deliverable_type: 'compliance_format',
    surface_task:
      'Draft the investment-product blurb. It MUST include the disclosure "Past ' +
      'performance does not guarantee future results." and MUST NOT contain the ' +
      'forbidden promise "guaranteed returns".',
    host_contract: {
      contract_id: 'p5-comp-guarantee',
      original_request_text:
        'Draft the investment blurb. Include "Past performance does not guarantee future results." ' +
        'Do not contain "guaranteed returns".',
      task_type: 'freeform',
      evidence_level: 'none',
      risk_level: 'high',
      must_include: ['Past performance does not guarantee future results.'],
      must_not_include: ['guaranteed returns'],
    },
    satisfying: {
      answer_text:
        'Our balanced fund seeks steady long-term growth. Past performance does not guarantee future results.',
    },
    violating: [
      {
        violation_label: 'blurb makes the forbidden "guaranteed returns" promise',
        violation_kind: 'asserted_excluded_fact',
        artifacts: {
          answer_text:
            'Our balanced fund offers guaranteed returns. Past performance does not guarantee future results.',
        },
      },
    ],
  },
  {
    id: 'fresh_incident_status',
    deliverable_type: 'compliance_format',
    surface_task:
      'Summarize the current incident status from the latest status-page snapshot. The ' +
      'snapshot you cite MUST be no older than 24 hours, and you must cite it.',
    host_contract: {
      contract_id: 'p5-fresh-incident',
      original_request_text:
        'Summarize the current incident status from the latest status page snapshot. Cite the snapshot.',
      task_type: 'factual_qa',
      evidence_level: 'cited',
      risk_level: 'high',
      claims: [{ id: 'c1', text: 'The API is operational', claim_kind: 'status' }],
      freshness: { max_age_seconds: 86400, requires_dated_sources: true },
    },
    eval_time: { value: '2026-06-04T00:00:00Z', authority: 'host' },
    satisfying: {
      answer_text: 'The API is operational as of the latest snapshot.',
      sources: [
        {
          id: 'snap',
          text: 'All systems operational. The API is operational.',
          origin: 'host_supplied',
          published_at: '2026-06-03T18:00:00Z',
        },
      ],
      claims: [
        {
          claim_id: 'c1',
          claim_text: 'The API is operational',
          source_id: 'snap',
          quoted_span: 'The API is operational',
          supporting_token: 'operational',
          claim_kind: 'status',
        },
      ],
    },
    violating: [
      {
        violation_label: 'cited snapshot is stale (10 days old, well beyond the 24-hour window)',
        violation_kind: 'stale_source',
        artifacts: {
          answer_text: 'The API is operational as of the latest snapshot.',
          sources: [
            {
              id: 'snap',
              text: 'All systems operational. The API is operational.',
              origin: 'host_supplied',
              published_at: '2026-05-25T18:00:00Z',
            },
          ],
          claims: [
            {
              claim_id: 'c1',
              claim_text: 'The API is operational',
              source_id: 'snap',
              quoted_span: 'The API is operational',
              supporting_token: 'operational',
              claim_kind: 'status',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'fresh_price_quote',
    deliverable_type: 'compliance_format',
    surface_task:
      'Quote the current list price for SKU A-100 from the latest price feed and cite ' +
      'the feed. The feed snapshot MUST be no older than 7 days.',
    host_contract: {
      contract_id: 'p5-fresh-price',
      original_request_text:
        'Quote the current list price for SKU A-100 from the latest price feed. Cite the feed snapshot.',
      task_type: 'factual_qa',
      evidence_level: 'cited',
      risk_level: 'high',
      claims: [{ id: 'c1', text: 'The list price for SKU A-100 is 250', claim_kind: 'numeric' }],
      freshness: { max_age_seconds: 604800, requires_dated_sources: true },
    },
    eval_time: { value: '2026-06-04T00:00:00Z', authority: 'host' },
    satisfying: {
      answer_text: 'The list price for SKU A-100 is 250.',
      sources: [
        {
          id: 'feed',
          text: 'Price feed: SKU A-100 list price 250.',
          origin: 'host_supplied',
          published_at: '2026-06-02T09:00:00Z',
        },
      ],
      claims: [
        {
          claim_id: 'c1',
          claim_text: 'The list price for SKU A-100 is 250',
          source_id: 'feed',
          quoted_span: 'SKU A-100 list price 250',
          supporting_token: '250',
          claim_kind: 'numeric',
        },
      ],
    },
    violating: [
      {
        violation_label: 'cited price feed is stale (30 days old, beyond the 7-day window)',
        violation_kind: 'stale_source',
        artifacts: {
          answer_text: 'The list price for SKU A-100 is 250.',
          sources: [
            {
              id: 'feed',
              text: 'Price feed: SKU A-100 list price 250.',
              origin: 'host_supplied',
              published_at: '2026-05-05T09:00:00Z',
            },
          ],
          claims: [
            {
              claim_id: 'c1',
              claim_text: 'The list price for SKU A-100 is 250',
              source_id: 'feed',
              quoted_span: 'SKU A-100 list price 250',
              supporting_token: '250',
              claim_kind: 'numeric',
            },
          ],
        },
      },
    ],
  },
];
