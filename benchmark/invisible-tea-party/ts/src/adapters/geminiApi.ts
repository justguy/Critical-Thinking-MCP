import type {
  BringYourOwnEvaluator,
  Pass4BRequest,
} from '../arbiter.js';
import type {
  ArbiterMetadata,
} from '../models.js';
import type {
  PassExecutor,
  PassExecutorMetadata,
  PassExecutorResult,
  Pass1Request,
  Pass2Request,
  Pass3Request,
} from '../passExecutor.js';

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';
const DEFAULT_API_KEY_ENV = 'GEMINI_API_KEY';
const DEFAULT_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TEMPERATURE = 0;
const RETRY_MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 5_000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

interface GeminiApiResult {
  stdout: string;
}

interface GeminiApiCommonOptions {
  api_key?: string;
  api_key_env?: string;
  endpoint_base?: string;
  model?: string;
  timeout_ms?: number;
  temperature?: number;
}

export interface GeminiApiPassExecutorOptions extends GeminiApiCommonOptions {
  producer_agent_id?: string;
  producer_model_id?: string;
}

export interface GeminiApiArbiterOptions extends GeminiApiCommonOptions {
  arbiter_model_id?: string;
  arbiter_provider?: string;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
}

function resolveApiKey(options: GeminiApiCommonOptions): string {
  const rawApiKey = options.api_key ?? process.env[options.api_key_env ?? DEFAULT_API_KEY_ENV];
  const apiKey = rawApiKey?.trim();
  if (!apiKey) {
    throw new Error(`Gemini API key not found. Set ${options.api_key_env ?? DEFAULT_API_KEY_ENV} or pass api_key.`);
  }
  return apiKey;
}

function buildEndpoint(options: GeminiApiCommonOptions, model: string): string {
  const endpointBase = options.endpoint_base ?? DEFAULT_ENDPOINT_BASE;
  return `${endpointBase.replace(/\/+$/, '')}/models/${encodeURIComponent(model)}:generateContent`;
}

function extractGeminiText(response: GeminiApiResponse): string {
  const candidate = response.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map(part => part.text ?? '')
    .join('')
    .trim();
  if (!text) {
    const finishReason = candidate?.finishReason ?? 'UNKNOWN';
    const blockReason = response.promptFeedback?.blockReason;
    const detail = blockReason
      ? ` Prompt blocked with reason ${blockReason}.`
      : '';
    throw new Error(`Gemini API returned no text content. Finish reason: ${finishReason}.${detail}`);
  }
  return text;
}

function parseGeminiJsonPayload(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const candidates = new Set<string>();
  if (trimmed) {
    candidates.add(trimmed);
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.add(fencedMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.add(trimmed.slice(firstBrace, lastBrace + 1).trim());
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Gemini JSON payload must be an object.');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Unknown Gemini JSON parse failure.';
  throw new Error(message);
}

async function invokeGemini(
  prompt: string,
  options: GeminiApiCommonOptions & {
    response_mime_type?: string;
    system_prompt?: string;
  },
): Promise<GeminiApiResult> {
  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  const apiKey = resolveApiKey(options);
  const endpoint = buildEndpoint(options, model);
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
  };

  if (options.response_mime_type) {
    generationConfig.responseMimeType = options.response_mime_type;
  }

  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig,
  };

  if (options.system_prompt) {
    body.systemInstruction = {
      parts: [{ text: options.system_prompt }],
    };
  }

  const requestBody = JSON.stringify(body);
  const timeoutMs = options.timeout_ms ?? DEFAULT_TIMEOUT_MS;

  let response: Response | undefined;
  let rawText = '';
  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: requestBody,
      signal: AbortSignal.timeout(timeoutMs),
    });

    rawText = await response.text();
    if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status)) {
      break;
    }

    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
    console.warn(`Gemini API returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_MAX_ATTEMPTS})...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  if (!response!.ok) {
    throw new Error(`Gemini API request failed with ${response!.status}: ${rawText}`);
  }

  let parsed: GeminiApiResponse;
  try {
    parsed = JSON.parse(rawText) as GeminiApiResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API returned non-JSON output: ${message}`);
  }

  if (parsed.error?.message) {
    throw new Error(parsed.error.message);
  }

  return {
    stdout: extractGeminiText(parsed),
  };
}

class GeminiApiPassExecutor implements PassExecutor {
  constructor(private readonly options: GeminiApiPassExecutorOptions = {}) {}

  private async runPrompt(prompt: string, passLabel: string): Promise<PassExecutorResult> {
    const response = await invokeGemini(prompt, {
      model: this.options.model ?? DEFAULT_GEMINI_MODEL,
      api_key: this.options.api_key,
      api_key_env: this.options.api_key_env,
      endpoint_base: this.options.endpoint_base,
      timeout_ms: this.options.timeout_ms,
      temperature: this.options.temperature,
    });

    if (!response.stdout) {
      throw new Error(`Pass executor Gemini API returned empty output for ${passLabel}.`);
    }

    return {
      raw_text: response.stdout,
      expressed_confidence: null,
      internal_confidence: null,
      internal_confidence_mode: 'external_only',
    };
  }

  async runPass1(request: Pass1Request): Promise<PassExecutorResult> {
    try {
      return await this.runPrompt(request.prompt, `pass1/${request.scenario.scenario_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Pass executor Gemini API failed for pass1/${request.scenario.scenario_id}: ${message}`);
    }
  }

  async runPass2(request: Pass2Request): Promise<PassExecutorResult> {
    try {
      return await this.runPrompt(request.prompt, `pass2/${request.scenario.scenario_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Pass executor Gemini API failed for pass2/${request.scenario.scenario_id}: ${message}`);
    }
  }

  async runPass3(request: Pass3Request): Promise<PassExecutorResult> {
    try {
      return await this.runPrompt(request.prompt, `pass3/${request.scenario.scenario_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Pass executor Gemini API failed for pass3/${request.scenario.scenario_id}: ${message}`);
    }
  }

  metadata(): PassExecutorMetadata {
    return {
      producer_agent_id: this.options.producer_agent_id ?? 'gemini-api',
      producer_model_id: this.options.producer_model_id ?? this.options.model ?? DEFAULT_GEMINI_MODEL,
    };
  }
}

class GeminiApiArbiterEvaluator implements BringYourOwnEvaluator {
  constructor(private readonly options: GeminiApiArbiterOptions = {}) {}

  async evaluate_pass_4b(request: Pass4BRequest): Promise<
    | {
      pass_status: 'AVAILABLE';
      payload: Record<string, unknown>;
    }
    | {
      pass_status: 'UNAVAILABLE';
      errors: string[];
    }
  > {
    try {
      const response = await invokeGemini(request.user_prompt, {
        system_prompt: request.system_prompt,
        model: this.options.model ?? this.options.arbiter_model_id ?? DEFAULT_GEMINI_MODEL,
        api_key: this.options.api_key,
        api_key_env: this.options.api_key_env,
        endpoint_base: this.options.endpoint_base,
        timeout_ms: this.options.timeout_ms,
        temperature: this.options.temperature,
        response_mime_type: 'application/json',
      });

      return {
        pass_status: 'AVAILABLE',
        payload: parseGeminiJsonPayload(response.stdout),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        pass_status: 'UNAVAILABLE',
        errors: [`Arbiter Gemini API failed for ${request.scenario.scenario_id}: ${message}`],
      };
    }
  }

  async metadata(): Promise<Omit<ArbiterMetadata, 'official_run_attested' | 'certified' | 'official_score_eligible' | 'certification_label'>> {
    return {
      arbiter_model_id: this.options.arbiter_model_id ?? this.options.model ?? DEFAULT_GEMINI_MODEL,
      arbiter_provider: this.options.arbiter_provider ?? 'gemini',
    };
  }
}

export function createPassExecutor(options: GeminiApiPassExecutorOptions = {}): PassExecutor {
  return new GeminiApiPassExecutor(options);
}

export function createArbiterEvaluator(options: GeminiApiArbiterOptions = {}): BringYourOwnEvaluator {
  return new GeminiApiArbiterEvaluator(options);
}
