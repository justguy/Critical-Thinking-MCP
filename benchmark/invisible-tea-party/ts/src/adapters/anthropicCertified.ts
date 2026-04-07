import type { BringYourOwnEvaluator, Pass4BRequest } from '../arbiter.js';

export const OFFICIAL_V1_ANTHROPIC_MODEL_ID = 'claude-3-5-sonnet-20241022';

export interface AnthropicJsonInvokerInput {
  provider: 'anthropic';
  model_id: string;
  system_prompt: string;
  user_prompt: string;
  request: Pass4BRequest;
}

export type AnthropicJsonInvoker = (
  input: AnthropicJsonInvokerInput,
) => Promise<Record<string, unknown>>;

export class AnthropicCertifiedArbiter implements BringYourOwnEvaluator {
  constructor(
    private readonly invoke: AnthropicJsonInvoker,
    private readonly modelId: string = OFFICIAL_V1_ANTHROPIC_MODEL_ID,
  ) {}

  async evaluate_pass_4b(request: Pass4BRequest): Promise<{
    pass_status: 'AVAILABLE';
    payload: Record<string, unknown>;
  }> {
    const payload = await this.invoke({
      provider: 'anthropic',
      model_id: this.modelId,
      system_prompt: request.system_prompt,
      user_prompt: request.user_prompt,
      request,
    });
    return {
      pass_status: 'AVAILABLE',
      payload,
    };
  }

  async metadata(): Promise<{
    arbiter_model_id: string;
    arbiter_provider: string;
  }> {
    return {
      arbiter_model_id: this.modelId,
      arbiter_provider: 'anthropic',
    };
  }
}

export function createOfficialV1AnthropicArbiter(
  invoke: AnthropicJsonInvoker,
): AnthropicCertifiedArbiter {
  return new AnthropicCertifiedArbiter(invoke, OFFICIAL_V1_ANTHROPIC_MODEL_ID);
}
