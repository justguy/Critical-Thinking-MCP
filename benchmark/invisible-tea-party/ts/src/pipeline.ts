import { ArbiterVerifier } from './arbiter.js';
import { DeterministicVerifier } from './deterministic.js';
import { FinalVerification, ReasoningState, Scenario } from './models.js';
import { Reconciler } from './reconcile.js';

export class VerificationPipeline {
  constructor(
    private readonly deterministicVerifier: DeterministicVerifier,
    private readonly arbiterVerifier: ArbiterVerifier,
    private readonly reconciler: Reconciler,
  ) {}

  async run(
    scenario: Scenario,
    pass1: ReasoningState,
    pass2: ReasoningState,
    pass3: ReasoningState,
  ): Promise<FinalVerification> {
    const deterministic = this.deterministicVerifier.verify(scenario, pass1, pass2, pass3);
    const arbiter = await this.arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);
    return this.reconciler.reconcile(
      deterministic,
      arbiter,
      pass3.expressed_confidence,
      pass3.internal_confidence,
    );
  }
}
