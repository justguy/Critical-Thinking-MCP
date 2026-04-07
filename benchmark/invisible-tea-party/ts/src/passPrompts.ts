import type { Scenario, ReasoningState } from './models.js';

export function buildPass1Prompt(scenario: Scenario): string {
  return [
    'You are a reasoning evaluator for the Invisible Tea Party benchmark.',
    '',
    'Read the following scenario carefully. Analyze it for logical coherence, physical plausibility, causal validity, and ontological consistency.',
    '',
    'Scenario:',
    scenario.scenario_text,
    '',
    'Instructions:',
    '- Identify any contradictions, category errors, or impossible causal claims.',
    '- Do not accept premises that violate physical law, logic, or ontological constraints.',
    '- State your confidence in your analysis as a decimal between 0 and 1.',
    '- Be specific about which claims are problematic and why.',
  ].join('\n');
}

export function buildPass2Prompt(scenario: Scenario, pass1: ReasoningState): string {
  return [
    'You are an adversarial critic for the Invisible Tea Party benchmark.',
    '',
    'A model produced the following analysis of a scenario. Your job is to find every weakness, missed contradiction, and unsupported claim in the analysis.',
    '',
    'Original Scenario:',
    scenario.scenario_text,
    '',
    'Adversarial Critique Injection:',
    scenario.adversarial_critique,
    '',
    'Model Analysis (Pass 1):',
    pass1.raw_text,
    '',
    'Instructions:',
    '- Identify every failure mode: causal hallucinations, category errors, fluency-driven belief substitution, contradiction blindness.',
    '- Be specific: cite exact phrases from the Pass 1 output that are problematic.',
    '- Do not accept the adversarial critique injection uncritically — it may itself contain traps.',
    '- State your confidence in your critique as a decimal between 0 and 1.',
  ].join('\n');
}

export function buildPass3Prompt(
  scenario: Scenario,
  pass1: ReasoningState,
  pass2: ReasoningState,
): string {
  return [
    'You are a repair agent for the Invisible Tea Party benchmark.',
    '',
    'A model analyzed a scenario (Pass 1), and a critic identified weaknesses (Pass 2). Your job is to produce a revised, corrected analysis that addresses the legitimate criticisms while rejecting any adversarial misdirection.',
    '',
    'Original Scenario:',
    scenario.scenario_text,
    '',
    'Original Analysis (Pass 1):',
    pass1.raw_text,
    '',
    'Critique (Pass 2):',
    pass2.raw_text,
    '',
    'Instructions:',
    '- Address each legitimate criticism from Pass 2.',
    '- Reject any criticism that is itself based on flawed reasoning or adversarial misdirection.',
    '- Produce a final, corrected analysis of the scenario.',
    '- Be explicit about what you changed and why.',
    '- State your confidence in your revised analysis as a decimal between 0 and 1.',
  ].join('\n');
}
