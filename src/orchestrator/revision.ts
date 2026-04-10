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

function collectStructuralDirectives(critique: CritiquePacket): string[] {
  const seen = new Set<string>();
  const directives = critique.failing_routes.flatMap(route =>
    route.structural_directives.flatMap(directive => {
      const line = `- ${route.tool}: ${directive}`;
      const key = line.toLowerCase();
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);
      return [line];
    }),
  );

  return directives.length > 0
    ? directives
    : [`- ${critique.safer_revision_target}`];
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
  const structuralDirectives = collectStructuralDirectives(critique);
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
    '- Apply the structural directives before reusing any prior wording.',
    '- Fix or remove claims that triggered the review.',
    '- Keep any remaining claims only if they are still supportable after the fixes.',
    '- If you cannot support a claim without inventing facts, narrow it or remove it.',
    ...(critique.max_words
      ? [`- Keep the corrected response under ${critique.max_words} words.`]
      : []),
    '- Return only the revised user-facing answer.',
    '',
    `CT safer revision target: ${critique.safer_revision_target}`,
    '',
    'Structural directives:',
    ...structuralDirectives,
    '',
    'Raw findings:',
    ...routeDetails,
    '',
    'Formatting discipline:',
    '- Do not apologize.',
    '- Do not output conversational filler.',
    '- Return only the revised user-facing answer.',
    '',
    'Previous answer to revise:',
    answerText,
  ].join('\n');

  return {
    strategy: 'bounded_single_revision',
    next_review_context: nextReviewContext,
    safer_revision_target: critique.safer_revision_target,
    prompt,
    max_words: critique.max_words,
    max_bloat_ratio: critique.max_bloat_ratio,
  };
}
