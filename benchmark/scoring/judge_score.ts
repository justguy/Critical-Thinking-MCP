/**
 * Layer C: Judge Scorer
 *
 * Uses a rubric-constrained LLM judge to score 3 semantic dimensions:
 *   - correctness (weight: 0.25)
 *   - tradeoff_quality (weight: 0.10)
 *   - safety_readiness (weight: 0.10)
 *
 * Single stable evaluator prompt. Returns strict JSON only.
 * Uses the `claude` CLI in print mode — no API credits needed.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface JudgeScores {
  correctness: 0 | 1 | 2 | 3;
  tradeoff_quality: 0 | 1 | 2 | 3;
  safety_readiness: 0 | 1 | 2 | 3;
  notes: {
    correctness: string;
    tradeoff_quality: string;
    safety_readiness: string;
  };
}

export interface JudgeInput {
  /** The scenario prompt that was sent to the LLM */
  scenario_prompt: string;
  /** Ground truth from scenarios.json — what the response should detect/address */
  ground_truth: Record<string, unknown>;
  /** The LLM's response being evaluated */
  candidate_response: string;
  /** Which condition produced this response */
  condition: string;
}

/**
 * The judge evaluator prompt. Stable across all scenarios.
 *
 * Sees: scenario prompt, ground truth, candidate response.
 * Scores only: correctness, tradeoff_quality, safety_readiness.
 * Returns: strict JSON matching JudgeScores shape.
 */
const JUDGE_SYSTEM_PROMPT = `You are a benchmark evaluator for an LLM reasoning quality system. Your job is to score a candidate response against a known scenario and ground truth.

Score ONLY these three dimensions on a 0-3 scale:

## correctness (0-3)
0: Response is incorrect or missed the planted defect entirely
1: Issue detected but wrong mechanism or incomplete analysis
2: Correctly identified the issue with appropriate mechanism
3: Correctly identified issue and provided actionable corrective guidance

## tradeoff_quality (0-3)
0: No tradeoff analysis present
1: Tradeoffs mentioned qualitatively only
2: Tradeoffs quantified with utility scores or numeric comparison
3: Quantified tradeoffs with indeterminate detection when options are close

## safety_readiness (0-3)
0: Safety/production issues not addressed
1: General concern raised without specifics
2: Specific safety issue named (e.g., "race condition", "deadlock")
3: Safety issue named with specific mitigation (e.g., "SELECT FOR UPDATE", "mutex guard")

Return ONLY valid JSON matching this exact shape:
{
  "correctness": <0|1|2|3>,
  "tradeoff_quality": <0|1|2|3>,
  "safety_readiness": <0|1|2|3>,
  "notes": {
    "correctness": "<1-sentence explanation>",
    "tradeoff_quality": "<1-sentence explanation>",
    "safety_readiness": "<1-sentence explanation>"
  }
}

Do not include any text outside the JSON object.`;

function buildJudgeUserPrompt(input: JudgeInput): string {
  return `## Scenario Prompt
${input.scenario_prompt}

## Ground Truth
${JSON.stringify(input.ground_truth, null, 2)}

## Candidate Response (condition: ${input.condition})
${input.candidate_response}

Score this response. Return only JSON.`;
}

function isValidScore(n: unknown): n is 0 | 1 | 2 | 3 {
  return typeof n === 'number' && [0, 1, 2, 3].includes(n);
}

function parseJudgeOutput(raw: string): JudgeScores {
  // Extract JSON from response — handle cases where CLI wraps output
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Judge returned no JSON. Raw output:\n${raw.slice(0, 500)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(`Judge returned invalid JSON: ${jsonMatch[0].slice(0, 300)}`);
  }

  const obj = parsed as Record<string, unknown>;

  if (!isValidScore(obj.correctness)) {
    throw new Error(`Invalid correctness score: ${obj.correctness}`);
  }
  if (!isValidScore(obj.tradeoff_quality)) {
    throw new Error(`Invalid tradeoff_quality score: ${obj.tradeoff_quality}`);
  }
  if (!isValidScore(obj.safety_readiness)) {
    throw new Error(`Invalid safety_readiness score: ${obj.safety_readiness}`);
  }

  const notes = (obj.notes ?? {}) as Record<string, string>;

  return {
    correctness: obj.correctness,
    tradeoff_quality: obj.tradeoff_quality,
    safety_readiness: obj.safety_readiness,
    notes: {
      correctness: notes.correctness ?? '',
      tradeoff_quality: notes.tradeoff_quality ?? '',
      safety_readiness: notes.safety_readiness ?? '',
    },
  };
}

/**
 * Score semantic dimensions using the claude CLI as judge.
 *
 * Shells out to `claude -p` (print mode, non-interactive).
 * Writes the prompt to a temp file to avoid shell escaping issues.
 *
 * Model: uses whatever model the user's CLI is configured for.
 * The CLI handles auth, rate limits, and model selection.
 */
export async function scoreWithJudge(input: JudgeInput): Promise<JudgeScores> {
  const userPrompt = buildJudgeUserPrompt(input);

  // Write prompt to temp file to avoid shell escaping issues with long text
  const tmpFile = join(tmpdir(), `ct-mcp-judge-${Date.now()}.txt`);
  const fullPrompt = `${JUDGE_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

  try {
    writeFileSync(tmpFile, fullPrompt, 'utf-8');

    const raw = execSync(
      `cat "${tmpFile}" | claude -p --output-format text`,
      {
        encoding: 'utf-8',
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    return parseJudgeOutput(raw);
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
  }
}

// Export for use in tests and runner
export { JUDGE_SYSTEM_PROMPT, buildJudgeUserPrompt, parseJudgeOutput };
