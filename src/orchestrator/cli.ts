/**
 * Experimental orchestrator CLI harness.
 *
 * Loads a JSON envelope from disk, runs the orchestrator, and prints a
 * machine-readable JSON result. Optionally writes the result to a file.
 *
 * Usage:
 *   node --import tsx src/orchestrator/cli.ts \
 *     --input src/orchestrator/fixtures/confidence_inflation.json \
 *     --mode routed
 *
 *   node --import tsx src/orchestrator/cli.ts \
 *     --input ./envelope.json --mode shadow --out ./report.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { runOrchestrator } from './index.js';
import type { OrchestratorEnvelope, OrchestratorMode } from './types.js';

interface CliArgs {
  input: string | null;
  mode: OrchestratorMode | null;
  out: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { input: null, mode: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case '--input':
        args.input = argv[++i] ?? null;
        break;
      case '--mode': {
        const value = argv[++i];
        if (value === 'routed' || value === 'shadow') {
          args.mode = value;
        } else {
          throw new Error(`--mode must be "routed" or "shadow" (got: ${String(value)})`);
        }
        break;
      }
      case '--out':
        args.out = argv[++i] ?? null;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}

function printHelp(): void {
  process.stderr.write(
    [
      'ct-mcp orchestrator CLI (experimental)',
      '',
      'Usage:',
      '  node --import tsx src/orchestrator/cli.ts --input <file.json> --mode routed|shadow [--out <file.json>]',
      '',
      'Flags:',
      '  --input  Path to a JSON orchestrator envelope (required)',
      '  --mode   Override the envelope mode: routed | shadow',
      '  --out    Optional path to write the JSON result',
      '',
    ].join('\n'),
  );
}

function main(): void {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    printHelp();
    process.exit(2);
    return;
  }

  if (!args.input) {
    process.stderr.write('error: --input is required\n');
    printHelp();
    process.exit(2);
    return;
  }

  const inputPath = resolve(args.input);
  let raw: string;
  try {
    raw = readFileSync(inputPath, 'utf-8');
  } catch (err) {
    process.stderr.write(
      `error: failed to read ${inputPath}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
    return;
  }

  let envelope: OrchestratorEnvelope;
  try {
    envelope = JSON.parse(raw) as OrchestratorEnvelope;
  } catch (err) {
    process.stderr.write(
      `error: failed to parse JSON: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
    return;
  }

  if (args.mode) {
    envelope.mode = args.mode;
  }

  const result = runOrchestrator(envelope);
  const output = JSON.stringify(result, null, 2);

  process.stdout.write(`${output}\n`);

  if (args.out) {
    const outPath = resolve(args.out);
    writeFileSync(outPath, output, 'utf-8');
    process.stderr.write(`report written to ${outPath}\n`);
  }
}

main();
