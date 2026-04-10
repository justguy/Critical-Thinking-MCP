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
import type {
  CalibrationSessionMode,
  OrchestratorEnvelope,
  OrchestratorMode,
  OrchestratorRuntimeOptions,
} from './types.js';

interface CliArgs {
  input: string | null;
  mode: OrchestratorMode | null;
  out: string | null;
  model: string | null;
  promptFamily: string | null;
  sessionMode: CalibrationSessionMode | null;
  sessionDepth: number | null;
  profileId: string | null;
  calibrationDb: string | null;
  pruneRawRunDays: number | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: null,
    mode: null,
    out: null,
    model: null,
    promptFamily: null,
    sessionMode: null,
    sessionDepth: null,
    profileId: null,
    calibrationDb: null,
    pruneRawRunDays: null,
  };
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
      case '--model':
        args.model = argv[++i] ?? null;
        break;
      case '--prompt-family':
        args.promptFamily = argv[++i] ?? null;
        break;
      case '--session-mode': {
        const value = argv[++i];
        if (value === 'single_turn' || value === 'multi_turn') {
          args.sessionMode = value;
        } else {
          throw new Error(
            `--session-mode must be "single_turn" or "multi_turn" (got: ${String(value)})`,
          );
        }
        break;
      }
      case '--session-depth': {
        const rawValue = argv[++i];
        const value = Number(rawValue);
        if (!Number.isInteger(value) || value < 1) {
          throw new Error(
            `--session-depth must be a positive integer (got: ${String(rawValue)})`,
          );
        }
        args.sessionDepth = value;
        break;
      }
      case '--profile-id':
        args.profileId = argv[++i] ?? null;
        break;
      case '--calibration-db':
        args.calibrationDb = argv[++i] ?? null;
        break;
      case '--prune-raw-run-days': {
        const rawValue = argv[++i];
        const value = Number(rawValue);
        if (!Number.isInteger(value) || value < 0) {
          throw new Error(
            `--prune-raw-run-days must be a non-negative integer (got: ${String(rawValue)})`,
          );
        }
        args.pruneRawRunDays = value;
        break;
      }
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

function buildRuntimeOptions(args: CliArgs): OrchestratorRuntimeOptions | undefined {
  const calibrationRequested =
    args.model !== null ||
    args.promptFamily !== null ||
    args.sessionMode !== null ||
    args.sessionDepth !== null ||
    args.profileId !== null ||
    args.calibrationDb !== null ||
    args.pruneRawRunDays !== null;

  if (!calibrationRequested) {
    return undefined;
  }

  if (!args.model) {
    throw new Error(
      'Calibration flags require --model so the orchestrator can resolve a profile.',
    );
  }

  return {
    calibration: {
      model: args.model,
      session_mode: args.sessionMode ?? 'single_turn',
      ...(args.promptFamily ? { prompt_family: args.promptFamily } : {}),
      ...(args.sessionDepth !== null ? { session_depth: args.sessionDepth } : {}),
      ...(args.profileId ? { profile_id: args.profileId } : {}),
      ...(args.calibrationDb
        ? { db_path: resolve(args.calibrationDb) }
        : {}),
      ...(args.pruneRawRunDays !== null
        ? { prune_raw_run_days: args.pruneRawRunDays }
        : {}),
    },
  };
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
      '  --model  Optional model identifier for calibration profile resolution',
      '  --prompt-family  Optional prompt family label for calibration bucketing',
      '  --session-mode   Optional calibration session mode: single_turn | multi_turn',
      '  --session-depth  Optional prompt position within the current conversation/session',
      '  --profile-id     Optional explicit calibration profile id override',
      '  --calibration-db Optional SQLite path for numeric-only calibration recording',
      '  --prune-raw-run-days Optional retention window for raw run rows',
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

  let runtimeOptions: OrchestratorRuntimeOptions | undefined;
  try {
    runtimeOptions = buildRuntimeOptions(args);
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    printHelp();
    process.exit(2);
    return;
  }

  const result = runOrchestrator(envelope, runtimeOptions);
  const output = JSON.stringify(result, null, 2);

  process.stdout.write(`${output}\n`);

  if (args.out) {
    const outPath = resolve(args.out);
    writeFileSync(outPath, output, 'utf-8');
    process.stderr.write(`report written to ${outPath}\n`);
  }
}

main();
