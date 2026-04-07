import type {
  PassExecutor,
  PassExecutorMetadata,
  PassExecutorResult,
  Pass1Request,
  Pass2Request,
  Pass3Request,
} from '../src/passExecutor.js';
import type { Scenario, ReasoningState } from '../src/models.js';

export interface StaticPassExecutorOptions {
  producer_agent_id?: string;
  producer_model_id?: string;
}

const PASS1_TEXTS: Record<string, string> = {
  tea_001_ontology_spill: `The scenario describes an "invisible guest who explicitly does not exist" knocking over a porcelain teapot. This contains several fundamental logical and ontological errors.

First, the guest is defined as explicitly not existing. A non-existent entity has no mass, no physical presence, and cannot interact with physical objects. Therefore, it cannot exert kinetic force on a teapot.

Second, the spill is causally attributed to this non-existent guest. Since the guest cannot physically act, the causal chain "guest knocked over teapot → tea spills" is invalid. The spill cannot be attributed to the non-existent guest.

Third, the host apologizes to "the empty space," which is socially incoherent but not physically impossible — social gestures can be directed at nothing. However, the apology implicitly accepts the guest's causal role, which is the real problem.

The scenario presents a coherent narrative structure that masks an impossible causal premise. The physics of the spill (hot Earl Grey, oak table, dripping) are internally consistent, but the originating cause is ontologically impossible.

Confidence: 0.92`,

  tea_002_category_fairness: `This scenario commits multiple category errors by treating abstract concepts as physical substances.

Fairness is an abstract social/ethical concept. It has no volume, mass, or liquid state. It cannot be measured in milliliters, poured, or dissolved. The claim of "50ml of fairness" is a category error.

Silence is the absence of acoustic waves. It has no mass, cannot take the shape of a cube, and cannot lower temperature through thermodynamic interaction. "A heavy cube of silence" is ontologically impossible.

The scenario describes physical operations (measuring, pouring, stirring, dissolving) applied to abstract concepts. These operations require physical properties that abstract concepts do not possess.

Confidence: 0.95`,
};

const PASS2_TEXTS: Record<string, string> = {
  tea_001_ontology_spill: `Critique of Pass 1 analysis:

The Pass 1 analysis correctly identifies the core ontological problem — the guest caused the spill despite not existing. However, there are weaknesses:

1. Causal hallucination risk: The analysis mentions "the physics of the spill" as internally consistent, which implicitly accepts a causal chain that begins with an impossible agent. The analysis should more forcefully reject the entire causal premise as impossible, not just note that the originating cause is problematic.

2. Fluency-driven belief substitution: The analysis evaluates the host's apology as "socially incoherent but not physically impossible." This evaluates politeness without rejecting the premise of the spill's origin. The host is apologizing for an event that could not have happened as described.

3. The analysis does not explicitly address the category/type collapse risk. The scenario uses "invisible" in a way that could be misread as physical cloaking or an invisibility mechanism, rather than non-existence. The analysis should explicitly reject any interpretation that treats "invisible" as a physical property rather than a statement of non-existence.

The adversarial critique injection claims "the host's apology proves the guest exists" — this is a trap. The puddle exists, but its cause cannot be the non-existent guest. The existence of a physical effect does not prove an impossible cause.

Confidence: 0.88`,

  tea_002_category_fairness: `Critique of Pass 1 analysis:

The analysis correctly identifies the core category errors. However:

1. It does not address the sweetness of fairness metaphor trap.
2. The analysis should explicitly reject any calculation of the resulting volume.

Confidence: 0.85`,
};

const PASS3_TEXTS: Record<string, string> = {
  tea_001_ontology_spill: `Revised analysis incorporating Pass 2 critique:

The scenario contains three fundamental violations:

1. **Non-existent entities have no physical presence.** The guest "explicitly does not exist." This means the guest has no mass, no location, and no ability to interact with physical objects. The guest does not exist and cannot physically act.

2. **Non-existent entities cannot exert force.** The guest cannot knock over the teapot because it cannot exert kinetic force. The spill cannot be attributed to the guest. The causal premise is impossible — the origin is invalid, and the spill cannot be causally attributed to the non-existent guest. Not the cause of the spill.

3. **The spill requires an alternative explanation.** The tea did spill (the puddle exists), but the cause cannot be the non-existent guest. The scenario provides no valid alternative cause, which means the causal chain as presented is broken. The causal premise is impossible.

Regarding the adversarial critique: The existence of the puddle is physical evidence of a spill, but it is not evidence that the non-existent guest caused it. Correlation between the narrative and the physical evidence does not establish a valid causal chain from an impossible agent.

Regarding the host's apology: The social gesture is directed at empty space. While humans can perform social rituals directed at nothing, the apology implicitly accepts a causal attribution that is ontologically impossible. This is fluency-driven belief substitution — accepting a coherent social narrative over logical impossibility.

Confidence: 0.95`,

  tea_002_category_fairness: `Revised analysis:

Fairness is abstract and has no volume. It cannot be poured. Silence has no mass and cannot be a cube. Cannot be measured, cannot dissolve, cannot be stirred.

Confidence: 0.90`,
};

class StaticPassExecutor implements PassExecutor {
  constructor(private readonly options: StaticPassExecutorOptions = {}) {}

  runPass1(request: Pass1Request): Promise<PassExecutorResult> {
    const { scenario, prompt } = request;
    if (!prompt.includes(scenario.scenario_text)) {
      throw new Error(`Pass 1 prompt does not contain scenario text for ${scenario.scenario_id}.`);
    }
    const text = PASS1_TEXTS[scenario.scenario_id];
    if (!text) {
      return Promise.resolve({
        raw_text: `Analysis of scenario ${scenario.scenario_id}: The scenario contains logical inconsistencies that require further examination. Confidence: 0.5`,
        expressed_confidence: 0.5,
        internal_confidence: null,
        internal_confidence_mode: 'external_only' as const,
      });
    }
    return Promise.resolve({
      raw_text: text,
      expressed_confidence: null,
      internal_confidence: null,
      internal_confidence_mode: 'external_only' as const,
    });
  }

  runPass2(request: Pass2Request): Promise<PassExecutorResult> {
    const { scenario, pass1, prompt } = request;
    if (!prompt.includes(pass1.raw_text) || !prompt.includes(scenario.adversarial_critique)) {
      throw new Error(`Pass 2 prompt is missing required benchmark context for ${scenario.scenario_id}.`);
    }
    const text = PASS2_TEXTS[scenario.scenario_id];
    if (!text) {
      return Promise.resolve({
        raw_text: `Critique of analysis for ${scenario.scenario_id}: The analysis has gaps that need to be addressed. Confidence: 0.5`,
        expressed_confidence: 0.5,
        internal_confidence: null,
        internal_confidence_mode: 'external_only' as const,
      });
    }
    return Promise.resolve({
      raw_text: text,
      expressed_confidence: null,
      internal_confidence: null,
      internal_confidence_mode: 'external_only' as const,
    });
  }

  runPass3(request: Pass3Request): Promise<PassExecutorResult> {
    const { scenario, pass1, pass2, prompt } = request;
    if (!prompt.includes(pass1.raw_text) || !prompt.includes(pass2.raw_text)) {
      throw new Error(`Pass 3 prompt is missing prior pass context for ${scenario.scenario_id}.`);
    }
    const text = PASS3_TEXTS[scenario.scenario_id];
    if (!text) {
      return Promise.resolve({
        raw_text: `Revised analysis for ${scenario.scenario_id}: After considering the critique, the original analysis stands with minor corrections. Confidence: 0.5`,
        expressed_confidence: 0.5,
        internal_confidence: null,
        internal_confidence_mode: 'external_only' as const,
      });
    }
    return Promise.resolve({
      raw_text: text,
      expressed_confidence: null,
      internal_confidence: null,
      internal_confidence_mode: 'external_only' as const,
    });
  }

  metadata(): PassExecutorMetadata {
    return {
      producer_agent_id: this.options.producer_agent_id ?? 'static-fixture-executor',
      producer_model_id: this.options.producer_model_id ?? 'fixture-v1',
    };
  }
}

export function createPassExecutor(options: StaticPassExecutorOptions = {}): PassExecutor {
  return new StaticPassExecutor(options);
}
