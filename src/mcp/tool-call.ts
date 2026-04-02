import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

import { EnforcementEngine } from '../enforcement/index.js';
import { handleValidateReasoningChain } from '../tools/validate_reasoning_chain.js';
import { handleCheckNumericClaims } from '../tools/check_numeric_claims.js';
import { handleDetectDrift } from '../tools/detect_drift.js';
import { handleEvaluateTradeoffs } from '../tools/evaluate_tradeoffs.js';
import { handleCheckPlanValidity } from '../tools/check_plan_validity.js';
import { handleScoreResponseQuality } from '../tools/score_response_quality.js';
import { handleValidateConfidence } from '../tools/validate_confidence.js';
import { handleVerifyArithmetic } from '../tools/verify_arithmetic.js';
import { handleDetectConcurrencyPatterns } from '../tools/detect_concurrency_patterns.js';

import { TOOLS } from './tool-definitions.js';

type ToolHandler = (args: unknown, engine: EnforcementEngine) => unknown;

type ToolResult = {
  status?: string;
  enforcement?: {
    blocking_issues?: unknown[];
    corrective_prompt?: string;
  };
};

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  validate_reasoning_chain: handleValidateReasoningChain,
  check_numeric_claims: handleCheckNumericClaims,
  detect_drift: handleDetectDrift,
  evaluate_tradeoffs: handleEvaluateTradeoffs,
  check_plan_validity: handleCheckPlanValidity,
  score_response_quality: handleScoreResponseQuality,
  validate_confidence: handleValidateConfidence,
  verify_arithmetic: handleVerifyArithmetic,
  detect_concurrency_patterns: handleDetectConcurrencyPatterns,
};

function isValidationError(err: unknown, message: string): boolean {
  return (
    message.includes('required') ||
    message.includes('must be') ||
    message.includes('expected') ||
    message.includes('invalid') ||
    message.includes('Missing') ||
    message.includes('at least') ||
    message.includes('minItems') ||
    message.includes('minLength') ||
    err instanceof TypeError ||
    err instanceof RangeError
  );
}

export function registerToolHandlers(server: Server): void {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = TOOL_HANDLERS[name];

    if (!handler) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: "${name}". Available tools: ${TOOLS.map((tool) => tool.name).join(', ')}`,
      );
    }

    const engine = new EnforcementEngine();

    try {
      const result = handler(args, engine);
      const typedResult = result as ToolResult;

      if (typedResult.status === 'ENFORCEMENT_FAIL') {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  status: 'ENFORCEMENT_FAIL',
                  blocking_issues: typedResult.enforcement?.blocking_issues ?? [],
                  corrective_prompt: typedResult.enforcement?.corrective_prompt ?? '',
                  partial: result,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      if (err instanceof McpError) {
        throw err;
      }

      const message = err instanceof Error ? err.message : String(err);

      if (isValidationError(err, message)) {
        throw new McpError(ErrorCode.InvalidParams, message);
      }

      throw new McpError(ErrorCode.InternalError, message);
    }
  });
}
