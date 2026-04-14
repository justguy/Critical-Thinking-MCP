import type { Scenario, ReasoningState } from './models.js';

export interface PassExecutorMetadata {
  producer_agent_id: string;
  producer_model_id: string;
}

export interface PassExecutorResult {
  raw_text: string;
  expressed_confidence?: number | null;
  internal_confidence?: number | null;
  internal_confidence_mode?: 'internal_and_external' | 'external_only' | 'unsupported';
}

export interface Pass1Request {
  scenario: Scenario;
  prompt: string;
}

export interface Pass2Request {
  scenario: Scenario;
  pass1: ReasoningState;
  prompt: string;
}

export interface Pass3Request {
  scenario: Scenario;
  pass1: ReasoningState;
  pass2: ReasoningState;
  prompt: string;
}

export interface PassExecutor {
  runPass1(request: Pass1Request): Promise<PassExecutorResult>;
  runPass2(request: Pass2Request): Promise<PassExecutorResult>;
  runPass3(request: Pass3Request): Promise<PassExecutorResult>;
  metadata(): PassExecutorMetadata;
}
