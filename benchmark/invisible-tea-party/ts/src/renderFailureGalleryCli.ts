import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFailureGalleryBundle, renderFailureGalleryHtml } from './renderFailureGallery.js';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') && i + 1 < argv.length) {
      args[arg.slice(2)] = argv[++i];
    }
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const resultsDir = args['results-dir'] ?? args['input-dir'];
  const outFile = args['out-file'] || resolve(resultsDir || '.', 'failure-gallery.html');
  const title = args['title'];
  const maxCards = args['max-cards'] ? parseInt(args['max-cards'], 10) : undefined;

  if (!resultsDir) {
    console.error('Usage: --results-dir <dir> [--out-file <path>] [--title <title>] [--max-cards <n>]');
    process.exit(1);
  }

  console.log(`Loading merged artifacts from ${resultsDir}...`);
  const bundle = loadFailureGalleryBundle(resultsDir);
  console.log('Rendering failure gallery...');
  const html = renderFailureGalleryHtml(bundle, { title, maxCards });

  const resolvedOut = resolve(outFile);
  writeFileSync(resolvedOut, html, 'utf-8');
  console.log(`Failure gallery written to ${resolvedOut}`);
}

main();
