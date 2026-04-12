/**
 * versions.ts — Mechanism version synthesis.
 *
 * For V1 every invoked tool maps to SERVER_INFO.version.
 * The signature accepts an optional per-mechanism override map so that
 * future slice work can slot in finer-grained version pinning without
 * a breaking change.
 */

import { SERVER_INFO } from '../../server-runtime.js';

/**
 * Build a Record<toolName, version> for all tools that were actually invoked.
 *
 * @param invokedTools - names of tools that participated in this call
 * @param overrides    - optional per-tool version pins (future use)
 * @returns            - mechanism_versions map pinned to SERVER_INFO.version by default
 */
export function buildMechanismVersions(
  invokedTools: string[],
  overrides: Record<string, string> = {},
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const tool of invokedTools) {
    result[tool] = overrides[tool] ?? SERVER_INFO.version;
  }
  return result;
}
