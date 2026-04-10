import type {
  CritiquePacket,
  PriorFailure,
  ReviewContext,
  RevisionRequest,
} from './types.js';

function collectRouteDetails(critique: CritiquePacket): string[] {
  return critique.failing_routes.map(route => {
    const details = [
      ...route.blocking_issues,
      ...route.contract_failures,
      ...route.warnings.map(warning => `warning: ${warning}`),
    ].filter(Boolean);

    return details.length > 0
      ? `- ${route.tool}: ${details.join('; ')}`
      : `- ${route.tool}: review findings were present but not expanded`;
  });
}

function buildPriorFailures(critique: CritiquePacket): PriorFailure[] {
  return critique.failing_routes.map(route => ({
    tool: route.tool,
    failure_type: route.failure_source,
    blocking_issues: [
      ...route.blocking_issues,
      ...route.contract_failures,
      ...route.warnings,
    ],
  }));
}

export function buildRevisionRequest(
  answerText: string,
  critique: CritiquePacket | undefined,
  reviewContext: ReviewContext,
): RevisionRequest | undefined {
  if (!critique) {
    return undefined;
  }

  const routeDetails = collectRouteDetails(critique);
  const nextReviewContext: ReviewContext = {
    iteration_number: reviewContext.iteration_number + 1,
    prior_failures: buildPriorFailures(critique),
  };

  const prompt = [
    'You are revising the immediately previous answer after deterministic CT review.',
    '',
    'Rules:',
    '- Make exactly one revision attempt.',
    '- Address the CT safer revision target directly.',
    '- Fix or remove claims that triggered the review.',
    '- Keep any remaining claims only if they are still supportable after the fixes.',
    '- If you cannot support a claim without inventing facts, narrow it or remove it.',
    '- Return only the revised user-facing answer.',
    '',
    `CT safer revision target: ${critique.safer_revision_target}`,
    '',
    'Issues to address:',
    ...routeDetails,
    '',
    'Previous answer to revise:',
    answerText,
  ].join('\n');

  return {
    strategy: 'bounded_single_revision',
    next_review_context: nextReviewContext,
    safer_revision_target: critique.safer_revision_target,
    prompt,
  };
}
