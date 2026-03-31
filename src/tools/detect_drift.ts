/**
 * detect_drift — CUSUM drift detection on numeric sequences.
 *
 * CUSUM formula: S_i = max(0, S_{i-1} + x_i - omega)
 * Drift detected when any S_i exceeds 5 * std(sequence).
 * Also computes monotonic_progress analysis.
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { BlockingIssue, EnforcementContext } from '../enforcement/types.js';

// ====== Output Types ======

interface CusumPoint {
  index: number;
  value: number;
  cusum: number;
}

interface MonotonicProgress {
  mean_delta: number;
  is_improving: boolean;
  is_stalling: boolean;
  is_declining: boolean;
}

export interface DriftOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  drift_detected: boolean;
  drift_point: number | null;
  cusum_max: number;
  threshold: number;
  cusum_series: CusumPoint[];
  monotonic_progress: MonotonicProgress;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

// ====== Validation ======

function validateInput(input: unknown): { sequence: number[]; drift_sensitivity: number } {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with a "sequence" array of at least 3 numbers. ' +
      'Optional field: "drift_sensitivity" (number, default 0.5).'
    );
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.sequence)) {
    throw new Error(
      'Missing or invalid "sequence" field. Provide an array of at least 3 numbers.'
    );
  }

  const sequence = obj.sequence as unknown[];

  if (sequence.length < 3) {
    throw new Error(
      `Need at least 3 values in sequence, got ${sequence.length}.`
    );
  }

  for (let i = 0; i < sequence.length; i++) {
    if (typeof sequence[i] !== 'number' || !isFinite(sequence[i] as number)) {
      throw new Error(
        `Element at index ${i} is not a valid finite number: ${String(sequence[i])}.`
      );
    }
  }

  let driftSensitivity = 0.5;
  if (obj.drift_sensitivity !== undefined) {
    if (typeof obj.drift_sensitivity !== 'number' || !isFinite(obj.drift_sensitivity)) {
      throw new Error(
        `"drift_sensitivity" must be a finite number, got: ${String(obj.drift_sensitivity)}.`
      );
    }
    driftSensitivity = obj.drift_sensitivity;
  }

  return { sequence: sequence as number[], drift_sensitivity: driftSensitivity };
}

// ====== Helpers ======

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ====== Handler ======

export function handleDetectDrift(
  input: unknown,
  engine: EnforcementEngine,
): DriftOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { sequence, drift_sensitivity: omega } = validateInput(input);

  const sigma = std(sequence);
  const threshold = 5 * sigma;

  // CUSUM computation
  const cusumSeries: CusumPoint[] = [];
  let cusumMax = 0;
  let driftPoint: number | null = null;
  let s = 0;

  for (let i = 0; i < sequence.length; i++) {
    s = Math.max(0, s + sequence[i] - omega);
    cusumSeries.push({ index: i, value: sequence[i], cusum: Math.round(s * 1000) / 1000 });
    if (s > cusumMax) cusumMax = s;
    if (driftPoint === null && threshold > 0 && s > threshold) {
      driftPoint = i;
    }
  }

  const driftDetected = driftPoint !== null;

  // Monotonic progress analysis
  const deltas: number[] = [];
  for (let i = 1; i < sequence.length; i++) {
    deltas.push(sequence[i] - sequence[i - 1]);
  }

  const meanDelta = mean(deltas);

  const last3Deltas = deltas.slice(-3);
  const isStalling =
    last3Deltas.length >= 3 &&
    last3Deltas.every(d => Math.abs(d) <= 0.02);

  const monotonicProgress: MonotonicProgress = {
    mean_delta: Math.round(meanDelta * 10000) / 10000,
    is_improving: meanDelta > 0.02,
    is_stalling: isStalling,
    is_declining: meanDelta < -0.02,
  };

  // Enforcement
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  if (driftDetected) {
    warnings.push(
      `CUSUM drift detected at index ${driftPoint}. ` +
      `CUSUM peak: ${cusumMax.toFixed(3)}, threshold: ${threshold.toFixed(3)}.`
    );
  }

  if (monotonicProgress.is_stalling) {
    warnings.push(
      `Progress is stalling — last 3 deltas are all within +/-0.02.`
    );
  }

  if (monotonicProgress.is_declining) {
    warnings.push(
      `Declining trend detected — mean delta is ${monotonicProgress.mean_delta.toFixed(4)}.`
    );
  }

  // Special handling: check iteration_history for degrading quality across iterations
  if (context?.iteration_history && context.iteration_history.length >= 2) {
    const history = context.iteration_history;
    // Check if warning counts are increasing across iterations (degrading quality)
    const warningCounts = history.map(entry => (entry.warnings?.length ?? 0));
    if (warningCounts.length >= 2) {
      let degradingCount = 0;
      for (let i = 1; i < warningCounts.length; i++) {
        if (warningCounts[i] > warningCounts[i - 1]) degradingCount++;
      }
      if (degradingCount >= Math.ceil((warningCounts.length - 1) * 0.5)) {
        warnings.push(
          `Iteration history shows degrading quality: warning counts across iterations are [${warningCounts.join(', ')}] — trending upward.`
        );
      }
    }

    // Check if blocking issue counts are increasing
    const blockingCounts = history.map(entry => (entry.blocking_issues?.length ?? 0));
    if (blockingCounts.length >= 2) {
      const lastTwo = blockingCounts.slice(-2);
      if (lastTwo[1] > lastTwo[0]) {
        warnings.push(
          `Blocking issues increased from ${lastTwo[0]} to ${lastTwo[1]} in the last two iterations.`
        );
      }
    }
  }

  const correctivePrompt =
    blockingIssues.length > 0
      ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'detect_drift', undefined, context)
      : '';

  const result: DriftOutput = {
    status: blockingIssues.length > 0 ? 'ENFORCEMENT_FAIL' : 'PASS',
    drift_detected: driftDetected,
    drift_point: driftPoint,
    cusum_max: Math.round(cusumMax * 1000) / 1000,
    threshold: Math.round(threshold * 1000) / 1000,
    cusum_series: cusumSeries,
    monotonic_progress: monotonicProgress,
    context_used: !!context,
  };

  if (blockingIssues.length > 0 || warnings.length > 0) {
    result.enforcement = {
      blocking_issues: blockingIssues,
      warnings,
      corrective_prompt: correctivePrompt,
    };
  }

  return result;
}
