import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PassExecutor } from './passExecutor.js';
import type { BringYourOwnEvaluator } from './arbiter.js';

export async function loadPassExecutorModule(
  modulePath: string,
  executorArgs?: Record<string, unknown>,
): Promise<PassExecutor> {
  const absPath = resolve(process.cwd(), modulePath);
  const moduleUrl = pathToFileURL(absPath).href;
  const mod = await import(moduleUrl);
  if (typeof mod.createPassExecutor !== 'function') {
   throw new Error(`Module ${modulePath} must export a createPassExecutor() function.`);
  }
  return mod.createPassExecutor(executorArgs) as PassExecutor;
}

export async function loadArbiterModule(
  modulePath: string,
  evaluatorArgs?: Record<string, unknown>,
): Promise<BringYourOwnEvaluator> {
  const absPath = resolve(process.cwd(), modulePath);
  const moduleUrl = pathToFileURL(absPath).href;
  const mod = await import(moduleUrl);
  if (typeof mod.createArbiterEvaluator !== 'function') {
    throw new Error(`Module ${modulePath} must export a createArbiterEvaluator() function.`);
  }
  return mod.createArbiterEvaluator(evaluatorArgs) as BringYourOwnEvaluator;
}
