/**
 * mapping.ts — Pure functions to map raw tool output to CtObjection[].
 *
 * Deterministic: same input → same output.
 * objection_id = first 32 hex chars of SHA-256(callId | toolName | mechanism | message | claimRef).
 * No mutable module-level state.
 */

import { createHash } from 'node:crypto';

import type { CtObjection, ObjectionSeverity, Verdict } from './types.js';

// ====== Internal raw tool output shapes ======

interface RawBlockingIssue {
  mechanism: string;
  description: string;
  severity?: string;
  claim_ref?: string;
}

interface RawWarningIssue {
  mechanism: string;
  description: string;
}

interface RawEnforcement {
  blocking_issues?: RawBlockingIssue[];
  warnings?: string[];
  warning_issues?: RawWarningIssue[];
  corrective_prompt?: string;
}

interface RawToolResult {
  status?: string;
  enforcement?: RawEnforcement;
}

// ====== Deterministic objection_id ======

/**
 * Returns first 32 hex chars of SHA-256(callId + "|" + toolName + "|" + mechanism + "|" + message + "|" + claimRef).
 * Including claim_ref in the hash ensures IDs are stable and unique when the same
 * mechanism fires for different claim references within the same call.
 */
export function computeObjectionId(
  callId: string,
  toolName: string,
  mechanism: string,
  message: string,
  claimRef?: string,
): string {
  // Concatenate in a fixed, unambiguous order using pipe separators
  const raw = `${callId}|${toolName}|${mechanism}|${message}|${claimRef ?? ''}`;
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
      const claim_ref = typeof issue.claim_ref === 'string' && issue.claim_ref.length > 0
        ? issue.claim_ref
        : undefined;

      const severityRaw = issue.severity;
      const severity: ObjectionSeverity =
        severityRaw === 'blocking' || severityRaw === 'warning' || severityRaw === 'info'
          ? severityRaw
          : 'blocking';

      const objection_id = computeObjectionId(callId, toolName, mechanism, message, claim_ref);

      const objection: CtObjection = {
        objection_id,
        mechanism,
        severity,
        message,
        evidence: { tool: toolName, raw_issue: issue as unknown as Record<string, unknown> },
      };
      if (claim_ref !== undefined) {
        objection.claim_ref = claim_ref;
      }
      objections.push(objection);
    }
  }

  // Structured warning_issues: prefer stable mechanism names when the tool supplies them.
  // Backward-compatible: tools that only emit warnings[] still work via the fallback below.
  const warningIssues = result.enforcement?.warning_issues ?? [];
  for (const wi of warningIssues) {
    if (!wi || typeof wi !== 'object') continue;
    const mechanism = typeof wi.mechanism === 'string' && wi.mechanism.length > 0
      ? wi.mechanism
      : `${toolName}_warning`;
    const message = typeof wi.description === 'string' ? wi.description : '';
    if (message.length === 0) continue;

    const objection_id = computeObjectionId(callId, toolName, mechanism, message);
    objections.push({
      objection_id,
      mechanism,
      severity: 'warning',
      message,
      evidence: { tool: toolName },
    });
  }

  // Unstructured string warnings: fallback to ${toolName}_warning synthetic mechanism name.
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
