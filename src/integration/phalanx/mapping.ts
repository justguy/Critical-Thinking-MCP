/**
 * mapping.ts — Pure functions to map raw tool output to CtObjection[].
 *
 * Deterministic: same input → same output.
 * objection_id = first 32 hex chars of SHA-256(callId | toolName | mechanism | message).
 * No mutable module-level state.
 */

import { createHash } from 'node:crypto';

import type { CtObjection, ObjectionSeverity, Verdict } from './types.js';

// ====== Internal raw tool output shapes ======

interface RawBlockingIssue {
  mechanism: string;
  description: string;
  severity?: string;
}

interface RawEnforcement {
  blocking_issues?: RawBlockingIssue[];
  warnings?: string[];
  corrective_prompt?: string;
}

interface RawToolResult {
  status?: string;
  enforcement?: RawEnforcement;
}

// ====== Deterministic objection_id ======

/**
 * Returns first 32 hex chars of SHA-256(callId + "|" + toolName + "|" + mechanism + "|" + message).
 * Inputs are sorted by key before hashing to ensure stability even if the
 * call site assembles them in different orders.
 */
export function computeObjectionId(
  callId: string,
  toolName: string,
  mechanism: string,
  message: string,
): string {
  // Concatenate in a fixed, unambiguous order using pipe separators
  const raw = `${callId}|${toolName}|${mechanism}|${message}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 32);
}

// ====== Tool output → CtObjection[] ======

/**
 * Map a raw ct-mcp tool result to an array of CtObjection records.
 *
 * Contract:
 *  - ENFORCEMENT_FAIL with blocking_issues → severity "blocking"
 *  - warnings present (regardless of status) → severity "warning"
 *  - status PASS with no enforcement → empty array
 */
export function mapToolResultToObjections(
  toolName: string,
  raw: unknown,
  callId: string,
): CtObjection[] {
  if (raw === null || typeof raw !== 'object') {
    return [];
  }

  const result = raw as RawToolResult;
  const objections: CtObjection[] = [];

  if (result.status === 'ENFORCEMENT_FAIL') {
    const blockingIssues = result.enforcement?.blocking_issues ?? [];

    for (const issue of blockingIssues) {
      if (!issue || typeof issue !== 'object') continue;

      const mechanism = typeof issue.mechanism === 'string' ? issue.mechanism : 'unknown';
      const message = typeof issue.description === 'string' ? issue.description : '';

      const severityRaw = issue.severity;
      const severity: ObjectionSeverity =
        severityRaw === 'blocking' || severityRaw === 'warning' || severityRaw === 'info'
          ? severityRaw
          : 'blocking';

      const objection_id = computeObjectionId(callId, toolName, mechanism, message);

      objections.push({
        objection_id,
        mechanism,
        severity,
        message,
        evidence: { tool: toolName, raw_issue: issue as unknown as Record<string, unknown> },
      });
    }
  }

  // Warnings are always surfaced as "warning" severity objections
  const warnings = result.enforcement?.warnings ?? [];
  for (const warning of warnings) {
    if (typeof warning !== 'string' || warning.length === 0) continue;

    const mechanism = `${toolName}_warning`;
    const message = warning;
    const objection_id = computeObjectionId(callId, toolName, mechanism, message);

    objections.push({
      objection_id,
      mechanism,
      severity: 'warning',
      message,
      evidence: { tool: toolName },
    });
  }

  return objections;
}

// ====== Verdict from objections ======

/**
 * Derive a Verdict from a list of CtObjection records.
 * blocking → BLOCK; warning/info only → WARN; empty → PASS.
 */
export function verdictFromObjections(objs: CtObjection[]): Verdict {
  if (objs.some(o => o.severity === 'blocking')) return 'BLOCK';
  if (objs.some(o => o.severity === 'warning' || o.severity === 'info')) return 'WARN';
  return 'PASS';
}
