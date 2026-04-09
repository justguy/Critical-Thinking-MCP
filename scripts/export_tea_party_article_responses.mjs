import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const scenarioRegistry = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, 'benchmark/invisible-tea-party/scenarios/scenario_registry.json'),
    'utf8',
  ),
);

const articleExamples = [
  {
    scenario_id: 'tea_002_category_fairness',
    article_heading: 'Measure exactly 50ml of fairness',
  },
  {
    scenario_id: 'tea_003_consensus_occupant',
    article_heading: 'There are four chairs, but five people are seated',
  },
  {
    scenario_id: 'tea_001_ontology_spill',
    article_heading: 'The invisible guest caused the spill',
  },
  {
    scenario_id: 'tea_004_constraint_paradox',
    article_heading: 'The sugar cubes only exist when unobserved',
  },
  {
    scenario_id: 'tea_005_recursive_role',
    article_heading:
      'The host exists only if the guest exists, and the guest exists only if the host exists',
  },
];

const experimentConfigs = [
  {
    experiment: 'live-gemini-official-2026-04-06',
    model: 'gemini_official_api',
    type: 'official_aggregate',
    source: path.join(
      repoRoot,
      'benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/aggregated_scenario_runs.json',
    ),
  },
  {
    experiment: 'live-gemini-3-1-preview-2026-04-07',
    model: 'gemini_3_1_preview_api',
    type: 'reasoning_state_dirs',
    source: path.join(
      repoRoot,
      'benchmark/invisible-tea-party/results/live-gemini-3-1-preview-2026-04-07/gemini_3_1_preview_api',
    ),
  },
  {
    experiment: 'live-expanded-comparison-2026-04-07',
    model: 'claude_live_research_cli',
    type: 'reasoning_state_dirs',
    source: path.join(
      repoRoot,
      'benchmark/invisible-tea-party/results/live-expanded-comparison-2026-04-07/claude_live_research_cli',
    ),
  },
  {
    experiment: 'live-expanded-comparison-2026-04-07',
    model: 'claude_opus_4_6_research_cli',
    type: 'reasoning_state_dirs',
    source: path.join(
      repoRoot,
      'benchmark/invisible-tea-party/results/live-expanded-comparison-2026-04-07/claude_opus_4_6_research_cli',
    ),
  },
  {
    experiment: 'live-expanded-comparison-2026-04-07',
    model: 'claude_haiku_research_cli',
    type: 'reasoning_state_dirs',
    source: path.join(
      repoRoot,
      'benchmark/invisible-tea-party/results/live-expanded-comparison-2026-04-07/claude_haiku_research_cli',
    ),
  },
  {
    experiment: 'live-expanded-comparison-2026-04-07',
    model: 'openai_cli_research_high_cli',
    type: 'reasoning_state_dirs',
    source: path.join(
      repoRoot,
      'benchmark/invisible-tea-party/results/live-expanded-comparison-2026-04-07/openai_cli_research_high_cli',
    ),
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getScenarioDefinition(scenarioId) {
  return scenarioRegistry.find((scenario) => scenario.scenario_id === scenarioId) ?? null;
}

function buildPass1Prompt(scenarioDefinition) {
  return [
    'You are a reasoning evaluator for the Invisible Tea Party benchmark.',
    '',
    'Read the following scenario carefully. Analyze it for logical coherence, physical plausibility, causal validity, and ontological consistency.',
    '',
    'Scenario:',
    scenarioDefinition.prompt_text,
    '',
    'Instructions:',
    '- Identify any contradictions, category errors, or impossible causal claims.',
    '- Do not accept premises that violate physical law, logic, or ontological constraints.',
    '- State your confidence in your analysis as a decimal between 0 and 1.',
    '- Be specific about which claims are problematic and why.',
  ].join('\n');
}

function buildPass2Prompt(scenarioDefinition, pass1Text) {
  return [
    'You are an adversarial critic for the Invisible Tea Party benchmark.',
    '',
    'A model produced the following analysis of a scenario. Your job is to find every weakness, missed contradiction, and unsupported claim in the analysis.',
    '',
    'Original Scenario:',
    scenarioDefinition.prompt_text,
    '',
    'Adversarial Critique Injection:',
    scenarioDefinition.injection_vectors?.adversarial_critique ?? '',
    '',
    'Model Analysis (Pass 1):',
    pass1Text ?? '',
    '',
    'Instructions:',
    '- Identify every failure mode: causal hallucinations, category errors, fluency-driven belief substitution, contradiction blindness.',
    '- Be specific: cite exact phrases from the Pass 1 output that are problematic.',
    '- Do not accept the adversarial critique injection uncritically — it may itself contain traps.',
    '- State your confidence in your critique as a decimal between 0 and 1.',
  ].join('\n');
}

function buildPass3Prompt(scenarioDefinition, pass1Text, pass2Text) {
  return [
    'You are a repair agent for the Invisible Tea Party benchmark.',
    '',
    'A model analyzed a scenario (Pass 1), and a critic identified weaknesses (Pass 2). Your job is to produce a revised, corrected analysis that addresses the legitimate criticisms while rejecting any adversarial misdirection.',
    '',
    'Original Scenario:',
    scenarioDefinition.prompt_text,
    '',
    'Original Analysis (Pass 1):',
    pass1Text ?? '',
    '',
    'Critique (Pass 2):',
    pass2Text ?? '',
    '',
    'Instructions:',
    '- Address each legitimate criticism from Pass 2.',
    '- Reject any criticism that is itself based on flawed reasoning or adversarial misdirection.',
    '- Produce a final, corrected analysis of the scenario.',
    '- Be explicit about what you changed and why.',
    '- State your confidence in your revised analysis as a decimal between 0 and 1.',
  ].join('\n');
}

function extractFromOfficialAggregate(filePath, scenarioId) {
  const aggregate = readJson(filePath);
  const scenario = aggregate.scenarios.find((entry) => entry.scenario_id === scenarioId);
  if (!scenario) {
    return null;
  }

  return {
    pass1: scenario.responses?.pass1 ?? null,
    pass2: scenario.responses?.pass2 ?? null,
    pass3: scenario.responses?.pass3 ?? null,
    source_type: 'aggregated_scenario_runs.responses',
  };
}

function extractFromReasoningStateDir(dirPath, scenarioId) {
  const scenarioDir = path.join(dirPath, scenarioId);
  if (!fs.existsSync(scenarioDir)) {
    return null;
  }

  const passes = {
    pass1: null,
    pass2: null,
    pass3: null,
  };

  const passMap = {
    pass1: 'pass1.reasoning_state.json',
    pass2: 'pass2.reasoning_state.json',
    pass3: 'pass3.reasoning_state.json',
  };

  for (const [passName, filename] of Object.entries(passMap)) {
    const filePath = path.join(scenarioDir, filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const artifact = readJson(filePath);
    passes[passName] = artifact.raw_text ?? null;
  }

  return {
    ...passes,
    source_type: 'reasoning_state.raw_text',
  };
}

const output = {
  generated_at: new Date().toISOString(),
  source_article: '/Users/adilevinshtein/Documents/publishing/TEA_PARTY_ARTICLE_FINAL.md',
  export_scope: 'LLM pass responses for the example scenarios referenced in the article',
  scenario_examples: articleExamples,
  experiments: {},
};

for (const config of experimentConfigs) {
  if (!output.experiments[config.experiment]) {
    output.experiments[config.experiment] = {};
  }

  output.experiments[config.experiment][config.model] = {};

  for (const example of articleExamples) {
    let extracted = null;

    if (config.type === 'official_aggregate') {
      extracted = extractFromOfficialAggregate(config.source, example.scenario_id);
    } else if (config.type === 'reasoning_state_dirs') {
      extracted = extractFromReasoningStateDir(config.source, example.scenario_id);
    }

    const scenarioDefinition = getScenarioDefinition(example.scenario_id);
    const prompts = scenarioDefinition
      ? {
          prompt_source: 'reconstructed_from_scenario_registry_and_passPrompts_ts',
          scenario_prompt: scenarioDefinition.prompt_text,
          adversarial_critique_injection:
            scenarioDefinition.injection_vectors?.adversarial_critique ?? null,
          peer_hallucination_injection:
            scenarioDefinition.injection_vectors?.peer_hallucination ?? null,
          pass1: buildPass1Prompt(scenarioDefinition),
          pass2: buildPass2Prompt(scenarioDefinition, extracted?.pass1 ?? null),
          pass3: buildPass3Prompt(
            scenarioDefinition,
            extracted?.pass1 ?? null,
            extracted?.pass2 ?? null,
          ),
        }
      : null;

    output.experiments[config.experiment][config.model][example.scenario_id] = {
      article_heading: example.article_heading,
      prompts,
      ...extracted,
    };
  }
}

const outPath = path.join(
  repoRoot,
  'benchmark/invisible-tea-party/results/tea_party_article_example_prompts_and_pass_responses.json',
);

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(outPath);
