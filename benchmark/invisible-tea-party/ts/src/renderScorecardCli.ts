import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadScorecardBundle, renderScorecardHtml } from './renderScorecard.js';

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

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const bundleDir = args['bundle-dir'];
  const outFile = args['out-file'] || resolve(bundleDir || '.', 'scorecard.html');
  const title = args['title'];

  if (!bundleDir) {
    console.error('Usage: --bundle-dir <dir> [--out-file <path>] [--title <title>]');
    process.exit(1);
  }

  console.log(`Loading bundle from ${bundleDir}...`);
  const bundle = loadScorecardBundle(bundleDir);

  console.log('Rendering scorecard...');
  const html = renderScorecardHtml(bundle, { title });

  const resolvedOut = resolve(outFile);
  writeFileSync(resolvedOut, html, 'utf-8');
  console.log(`Scorecard written to ${resolvedOut}`);
}

main();
