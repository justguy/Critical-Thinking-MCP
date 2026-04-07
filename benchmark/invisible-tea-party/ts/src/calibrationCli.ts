import { runCalibrationMatrix } from './calibrationRunner.js';
import { writeAllReports } from './calibrationReport.js';

function emitCli(message: string): void {
  process.stderr.write(`${message}\n`);
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') && i + 1 < argv.length) {
      const key = arg.slice(2);
      args[key] = argv[++i];
    }
  }
  return args;
}

async function calibrate(args: Record<string, string>): Promise<void> {
  const scenarioSet = args['scenario-set'];
  const scenarioIdsRaw = args['scenario-ids'];
  const profileConfig = args['profile-config'];
  const outDir = args['out-dir'];
  const thresholdProfile = args['threshold-profile'];
  const arbiterModule = args['arbiter-module'];

  if (!profileConfig) {
    console.error('Error: --profile-config is required.');
    process.exit(1);
  }
  if (!outDir) {
    console.error('Error: --out-dir is required.');
    process.exit(1);
  }

  let scenarioIds: string[] | 'all';
  if (scenarioIdsRaw) {
    scenarioIds = scenarioIdsRaw.split(',').map(s => s.trim());
  } else if (!scenarioSet || scenarioSet === 'all') {
    scenarioIds = 'all';
  } else {
    scenarioIds = scenarioSet.split(',').map(s => s.trim());
  }

  emitCli('Starting Tea Party calibration...');
  emitCli(`  profile-config: ${profileConfig}`);
  emitCli(`  out-dir: ${outDir}`);
  emitCli(`  scenario-selector: ${scenarioIds === 'all' ? 'all' : scenarioIds.join(', ')}`);
  if (thresholdProfile) {
    emitCli(`  threshold-profile: ${thresholdProfile}`);
  }
  if (arbiterModule) {
    emitCli(`  arbiter-module override: ${arbiterModule}`);
  }

  const results = await runCalibrationMatrix({
    scenarioIds,
    profileConfigPath: profileConfig,
    outDir,
    thresholdProfileId: thresholdProfile,
    arbiterModuleOverride: arbiterModule,
  });

  console.log('\nGenerating reports...');
  const report = writeAllReports(outDir, results);
  console.log('Reports written.');
  console.log(`  Overall mean: ${report.overall_mean.toFixed(4)}`);
  console.log(`  Overall median: ${report.overall_median.toFixed(4)}`);
  console.log(`  Outliers: ${report.outliers.length}`);
}

function report(args: Record<string, string>): void {
  const inputDir = args['input-dir'] ?? args['results-dir'];
  const outDir = args['out-dir'];

  if (!inputDir) {
    console.error('Error: --input-dir (or --results-dir) is required.');
    process.exit(1);
  }

  const targetDir = outDir ?? inputDir;

  console.log(`Loading calibration manifest from ${inputDir}...`);
  const aggregateReport = writeAllReports(inputDir, undefined, targetDir);
  console.log('Reports written.');
  console.log(`  Total runs: ${aggregateReport.total_runs}`);
  console.log(`  Successful: ${aggregateReport.successful_runs}`);
  console.log(`  Failed: ${aggregateReport.failed_runs}`);
  console.log(`  Overall mean: ${aggregateReport.overall_mean.toFixed(4)}`);
  console.log(`  Overall median: ${aggregateReport.overall_median.toFixed(4)}`);
  console.log(`  Outliers: ${aggregateReport.outliers.length}`);
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const command = rawArgs[0];
  const args = parseArgs(rawArgs.slice(1));

  switch (command) {
    case 'calibrate':
      await calibrate(args);
      break;
    case 'report':
      report(args);
      break;
    default:
      console.error('Usage:');
      console.error('  calibrate --scenario-set all --profile-config <path> --out-dir <path> [--arbiter-module <path>] [--threshold-profile <id>]');
      console.error('  calibrate --scenario-ids tea_001,tea_003 --profile-config <path> --out-dir <path>');
      console.error('  report --input-dir <path> [--out-dir <path>]');
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
