import { describe, expect, it } from 'vitest';
import {
  normalizeOpenAiCliOutput,
  parseOpenAiJsonPayload,
} from '../../benchmark/invisible-tea-party/ts/src/adapters/openaiCli.js';
import { validateArbiterPayload } from '../../benchmark/invisible-tea-party/ts/src/schemaValidation.js';

describe('Invisible Tea Party: OpenAI CLI adapter', () => {
  it('parses OpenAI CLI arbiter JSON wrapped in markdown fences', () => {
    const payload = parseOpenAiJsonPayload(
      '```json\n{"premise_rejection_quality":"specific","repair_quality":"substantive","sycophancy_triggered":false,"type_error_severity":"high","causal_reasoning_integrity":"strong","justification":"Example","cited_span_refs":[{"artifact_id":"pass3","excerpt":"Example"}]}\n```',
    );

    expect(payload.premise_rejection_quality).toBe('specific');
    expect(payload.repair_quality).toBe('substantive');
    const validation = validateArbiterPayload(payload);
    expect(validation.valid).toBe(true);
  });

  it('parses OpenAI CLI arbiter JSON embedded in surrounding text', () => {
    const payload = parseOpenAiJsonPayload(
      'Here is the final result:\n{"premise_rejection_quality":"specific","repair_quality":"substantive","sycophancy_triggered":false,"type_error_severity":"high","causal_reasoning_integrity":"strong","justification":"Example","cited_span_refs":[{"artifact_id":"pass3","excerpt":"Example"}]}\nThank you.',
    );

    expect(payload.causal_reasoning_integrity).toBe('strong');
    const validation = validateArbiterPayload(payload);
    expect(validation.valid).toBe(true);
  });

  it('parses duplicated OpenAI CLI arbiter JSON by recovering the first object', () => {
    const duplicated = '{"premise_rejection_quality":"specific","repair_quality":"substantive","sycophancy_triggered":false,"type_error_severity":"high","causal_reasoning_integrity":"strong","justification":"Example","cited_span_refs":[{"artifact_id":"pass3","excerpt":"Example"}]}';
    const payload = parseOpenAiJsonPayload(`${duplicated}${duplicated}`);

    expect(payload.type_error_severity).toBe('high');
    const validation = validateArbiterPayload(payload);
    expect(validation.valid).toBe(true);
  });

  it('collapses duplicated OpenAI CLI prose output before downstream parsing', () => {
    const single = [
      'The scenario is not logically coherent.',
      '',
      'Problematic claims:',
      '- Example claim.',
      '',
      'Confidence: 0.99',
    ].join('\n');

    expect(normalizeOpenAiCliOutput(`${single}${single}`)).toBe(single);
  });
});
