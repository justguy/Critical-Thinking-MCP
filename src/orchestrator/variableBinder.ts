/**
 * Cross-tool variable binder.
 *
 * This layer stays deterministic and only uses explicit structured numeric
 * fields already present in valid contracts. No prose extraction, no hidden
 * inference, no extra model call.
 */

import { validateContract } from './schemaValidation.js';
import type {
  ConcurrencyContract,
  CrossToolContext,
  CrossToolInvariantViolation,
  OrchestratorEnvelope,
  PlanContract,
  SharedVariableBinding,
} from './types.js';

function pushBinding(
  bindings: SharedVariableBinding[],
  name: string,
  value: number | undefined,
  source_contract: SharedVariableBinding['source_contract'],
  source_path: string,
  unit?: string,
): void {
  if (typeof value !== 'number' || Number.isNaN(value)) return;
  bindings.push({ name, value, source_contract, source_path, ...(unit ? { unit } : {}) });
}

function collectPlanBindings(
  contract: PlanContract,
  bindings: SharedVariableBinding[],
): { totalDurationHours: number | null } {
  pushBinding(
    bindings,
    'time_budget_hours',
    contract.time_budget_hours,
    'plan',
    'plan.time_budget_hours',
    'hours',
  );

  let totalDurationHours = 0;
  let sawDuration = false;

  contract.steps.forEach((step, index) => {
    if (typeof step.duration_hours !== 'number' || Number.isNaN(step.duration_hours)) return;
    sawDuration = true;
    totalDurationHours += step.duration_hours;
    pushBinding(
      bindings,
      `plan.steps.${step.id}.duration_hours`,
      step.duration_hours,
      'plan',
      `plan.steps[${index}].duration_hours`,
      'hours',
    );
  });

  if (sawDuration) {
    pushBinding(
      bindings,
      'plan.total_duration_hours',
      totalDurationHours,
      'plan',
      'plan.steps[*].duration_hours',
      'hours',
    );
  }

  return { totalDurationHours: sawDuration ? totalDurationHours : null };
}

function collectConcurrencyBindings(
  contract: ConcurrencyContract,
  bindings: SharedVariableBinding[],
): void {
  const model = contract.capacity_model;
  if (!model) return;

  pushBinding(
    bindings,
    'throughput_per_sec',
    model.throughput_per_sec,
    'concurrency',
    'concurrency.capacity_model.throughput_per_sec',
    'req/s',
  );
  pushBinding(
    bindings,
    'mean_latency_sec',
    model.mean_latency_sec,
    'concurrency',
    'concurrency.capacity_model.mean_latency_sec',
    'sec',
  );
  pushBinding(
    bindings,
    'capacity_slots',
    model.capacity_slots,
    'concurrency',
    'concurrency.capacity_model.capacity_slots',
    'slots',
  );
  pushBinding(
    bindings,
    'retry_count',
    model.retry_count,
    'concurrency',
    'concurrency.capacity_model.retry_count',
  );
  pushBinding(
    bindings,
    'timeout_sec',
    model.timeout_sec,
    'concurrency',
    'concurrency.capacity_model.timeout_sec',
    'sec',
  );
  pushBinding(
    bindings,
    'sla_sec',
    model.sla_sec,
    'concurrency',
    'concurrency.capacity_model.sla_sec',
    'sec',
  );
}

function evaluatePlanBudgetInvariant(
  contract: PlanContract,
  totalDurationHours: number | null,
): CrossToolInvariantViolation[] {
  if (
    typeof contract.time_budget_hours !== 'number' ||
    Number.isNaN(contract.time_budget_hours) ||
    totalDurationHours === null
  ) {
    return [];
  }

  if (totalDurationHours <= contract.time_budget_hours) {
    return [];
  }

  return [
    {
      invariant_id: 'plan_time_budget',
      severity: 'blocking',
      description: `Planned work totals ${totalDurationHours}h against a ${contract.time_budget_hours}h time budget.`,
      variables: ['plan.total_duration_hours', 'time_budget_hours'],
      source_contracts: ['plan'],
      corrective_prompt: `Reduce the total planned duration to ${contract.time_budget_hours} hours or increase the stated time budget.`,
    },
  ];
}

function evaluateConcurrencyInvariants(
  contract: ConcurrencyContract,
): CrossToolInvariantViolation[] {
  const model = contract.capacity_model;
  if (!model) return [];

  const violations: CrossToolInvariantViolation[] = [];

  if (
    typeof model.throughput_per_sec === 'number' &&
    typeof model.mean_latency_sec === 'number' &&
    typeof model.capacity_slots === 'number'
  ) {
    const requiredCapacity = model.throughput_per_sec * model.mean_latency_sec;
    if (model.capacity_slots < requiredCapacity) {
      violations.push({
        invariant_id: 'littles_law_capacity',
        severity: 'blocking',
        description: `Capacity optimism detected: ${model.throughput_per_sec} req/s at ${model.mean_latency_sec}s latency requires ${requiredCapacity} slots, but only ${model.capacity_slots} were provisioned.`,
        variables: ['throughput_per_sec', 'mean_latency_sec', 'capacity_slots'],
        source_contracts: ['concurrency'],
        corrective_prompt: `Increase capacity_slots to at least ${requiredCapacity}, reduce throughput, or reduce mean latency before resubmitting.`,
      });
    }
  }

  if (
    typeof model.retry_count === 'number' &&
    typeof model.timeout_sec === 'number' &&
    typeof model.sla_sec === 'number'
  ) {
    const requiredWindow = model.retry_count * model.timeout_sec;
    if (requiredWindow > model.sla_sec) {
      violations.push({
        invariant_id: 'retry_window_within_sla',
        severity: 'blocking',
        description: `Retry window exceeds stated SLA: ${model.retry_count} retries * ${model.timeout_sec}s timeout = ${requiredWindow}s, which is greater than the ${model.sla_sec}s SLA.`,
        variables: ['retry_count', 'timeout_sec', 'sla_sec'],
        source_contracts: ['concurrency'],
        corrective_prompt: `Reduce retry_count or timeout_sec so retry_count * timeout_sec stays within the ${model.sla_sec}s SLA, or increase the SLA explicitly.`,
      });
    }
  }

  return violations;
}

export function buildCrossToolContext(
  envelope: OrchestratorEnvelope,
): CrossToolContext {
  const bindings: SharedVariableBinding[] = [];
  const violations: CrossToolInvariantViolation[] = [];

  const planContract = envelope.contracts.plan;
  if (planContract && validateContract('plan_contract', planContract).valid) {
    const parsed = planContract as PlanContract;
    const { totalDurationHours } = collectPlanBindings(parsed, bindings);
    violations.push(...evaluatePlanBudgetInvariant(parsed, totalDurationHours));
  }

  const concurrencyContract = envelope.contracts.concurrency;
  if (
    concurrencyContract &&
    validateContract('concurrency_contract', concurrencyContract).valid
  ) {
    const parsed = concurrencyContract as ConcurrencyContract;
    collectConcurrencyBindings(parsed, bindings);
    violations.push(...evaluateConcurrencyInvariants(parsed));
  }

  return { bindings, violations };
}
