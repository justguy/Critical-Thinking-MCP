/**
 * LAYER 1C: Publication-readiness tests
 *
 * Proves: "The package meets all mechanical publication requirements."
 * Checks file presence, content correctness, and absence of forbidden content.
 * No LLM calls. Pure filesystem and content checks.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

interface BenchmarkRow {
  scenario_id: string;
  condition: string;
  quality_score: number;
  is_clean_control: boolean;
  false_positive: boolean;
}

function fileExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

function loadBenchmarkRows(): BenchmarkRow[] {
  return JSON.parse(readFile('benchmark/results/BENCHMARK_RESULTS.json')) as BenchmarkRow[];
}

function uniqueScenarioIds(rows: BenchmarkRow[], predicate: (row: BenchmarkRow) => boolean): string[] {
  return [...new Set(rows.filter(predicate).map((row) => row.scenario_id))];
}

function getScenarioScore(
  rows: BenchmarkRow[],
  scenarioId: string,
  condition: BenchmarkRow['condition'],
): number {
  const row = rows.find((candidate) => (
    candidate.scenario_id === scenarioId &&
    candidate.condition === condition
  ));

  if (!row) {
    throw new Error(`Missing benchmark row for ${scenarioId}/${condition}`);
  }

  return row.quality_score;
}

describe('Required files exist', () => {
  it('LICENSE exists', () => {
    expect(fileExists('LICENSE')).toBe(true);
  });

  it('CHANGELOG.md exists', () => {
    expect(fileExists('CHANGELOG.md')).toBe(true);
  });

  it('README.md exists', () => {
    expect(fileExists('README.md')).toBe(true);
  });

  it('CAPABILITY_MAP.md exists', () => {
    expect(fileExists('CAPABILITY_MAP.md')).toBe(true);
  });

  it('benchmark/BENCHMARK.md exists', () => {
    expect(fileExists('benchmark/BENCHMARK.md')).toBe(true);
  });

  it('benchmark/rubric.json exists', () => {
    expect(fileExists('benchmark/rubric.json')).toBe(true);
  });

  it('benchmark/scenarios.json exists', () => {
    expect(fileExists('benchmark/scenarios.json')).toBe(true);
  });

  it('benchmark/reports/BENCHMARK_REPORT.md exists', () => {
    expect(fileExists('benchmark/reports/BENCHMARK_REPORT.md')).toBe(true);
  });

  it('html/index.html exists', () => {
    expect(fileExists('html/index.html')).toBe(true);
  });

  it('html/runs.json exists', () => {
    expect(fileExists('html/runs.json')).toBe(true);
  });

  it('html/src/components.jsx exists', () => {
    expect(fileExists('html/src/components.jsx')).toBe(true);
  });

  it('html/src/curated.js exists', () => {
    expect(fileExists('html/src/curated.js')).toBe(true);
  });
});

describe('README content requirements', () => {
  const readme = readFile('README.md');

  it('contains Limitations section', () => {
    expect(readme).toMatch(/## Limitations/i);
  });

  it('Limitations section has at least 5 items', () => {
    const limSection = readme.split(/## Limitations/i)[1];
    if (limSection) {
      const items = limSection.split('\n').filter(l => /^\d+\./.test(l.trim()));
      expect(items.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('publication section points at the current beta2 showcase bundle', () => {
    expect(readme).toContain('html/index.html');
    expect(readme).toContain('html/runs.json');
  });

  it('publication section no longer references retired standalone html prototypes', () => {
    expect(readme).not.toContain('cost-of-not-using-ct-simulator.html');
    expect(readme).not.toContain('ct-beta2-benchmark-review.html');
    expect(readme).not.toContain('html/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.json');
  });
});


describe('package.json metadata', () => {
  const pkg = JSON.parse(readFile('package.json'));

  it('has required npm keywords', () => {
    const required = ['mcp', 'claude', 'reasoning', 'critical-thinking', 'llm',
      'validation', 'logic', 'ai-tools', 'model-context-protocol'];
    for (const kw of required) {
      expect(pkg.keywords).toContain(kw);
    }
  });

  it('description mentions nine tools and key capabilities', () => {
    const desc = pkg.description.toLowerCase();
    expect(desc).toMatch(/nine tools|9 tools/);
    expect(desc).toMatch(/confidence inflation/);
    expect(desc).toMatch(/circular logic/);
  });

  it('publishes runtime docs required by the MCP server', () => {
    expect(pkg.files).toContain('CAPABILITY_MAP.md');
    expect(pkg.files).toContain('README.md');
  });

  it('prepublishOnly runs both build and tests', () => {
    expect(pkg.scripts.prepublishOnly).toContain('npm run build');
    expect(pkg.scripts.prepublishOnly).toContain('npm test');
  });

  it('license is MIT', () => {
    expect(pkg.license).toBe('MIT');
  });
});

describe('Version consistency', () => {
  const pkg = JSON.parse(readFile('package.json'));
  const serverSource = readFile('src/server-runtime.ts');

  it('server version matches package.json version', () => {
    const versionMatch = serverSource.match(/version:\s*'([^']+)'/);
    expect(versionMatch?.[1]).toBe(pkg.version);
  });
});

describe('Published beta2 artifacts are sanitized for public sharing', () => {
  const artifactPaths = [
    'docs/reports/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.json',
    'html/runs.json',
  ];

  for (const artifactPath of artifactPaths) {
    it(`${artifactPath} does not embed local machine paths`, () => {
      const artifact = readFile(artifactPath);
      expect(artifact).not.toContain('/Users/');
      expect(artifact).not.toContain('.codex_home/sessions/');
      expect(artifact).not.toContain('/tmp/');
    });
  }

  it('html/runs.json does not ship session metadata or internal telemetry fields', () => {
    const artifact = readFile('html/runs.json');
    expect(artifact).not.toContain('"session_id"');
    expect(artifact).not.toContain('"session_log_path"');
    expect(artifact).not.toContain('"raw_stream_path"');
    expect(artifact).not.toContain('"permission_denials"');
    expect(artifact).not.toContain('"modelUsage"');
    expect(artifact).not.toContain('"total_cost_usd"');
  });
});

describe('HTML publication surface stays aligned with the sanitized bundle', () => {
  const indexHtml = readFile('html/index.html');

  it('loads the fetch-based run bundle instead of the retired inline dump', () => {
    expect(indexHtml).toContain('src/data.jsx');
    expect(indexHtml).not.toContain('src/runs-data.js');
    expect(indexHtml).toContain('runs.json');
  });

  it('uses production React assets for the published showcase', () => {
    expect(indexHtml).not.toContain('react.development.js');
    expect(indexHtml).not.toContain('react-dom.development.js');
    expect(indexHtml).toContain('react.production.min.js');
    expect(indexHtml).toContain('react-dom.production.min.js');
  });
});

describe('Benchmark publication docs stay aligned with canonical results', () => {
  const benchmarkRows = loadBenchmarkRows();
  const report = readFile('benchmark/reports/BENCHMARK_REPORT.md');
  const capabilityMap = readFile('CAPABILITY_MAP.md');

  const defectScenarioIds = uniqueScenarioIds(benchmarkRows, (row) => !row.is_clean_control);
  const cleanScenarioIds = uniqueScenarioIds(benchmarkRows, (row) => row.is_clean_control);

  const winsVsBaseline = defectScenarioIds.filter((scenarioId) => (
    getScenarioScore(benchmarkRows, scenarioId, 'ct_mcp') >
    getScenarioScore(benchmarkRows, scenarioId, 'baseline')
  )).length;

  const winsVsPrompted = defectScenarioIds.filter((scenarioId) => (
    getScenarioScore(benchmarkRows, scenarioId, 'ct_mcp') >
    getScenarioScore(benchmarkRows, scenarioId, 'prompted')
  )).length;

  const cleanFalsePositives = cleanScenarioIds.filter((scenarioId) => {
    const row = benchmarkRows.find((candidate) => (
      candidate.scenario_id === scenarioId &&
      candidate.condition === 'ct_mcp'
    ));

    return row?.false_positive === true;
  }).length;

  it('benchmark report summary matches canonical counts', () => {
    expect(report).toContain(`**${winsVsBaseline}/${defectScenarioIds.length}**`);
    expect(report).toContain(`**${winsVsPrompted}/${defectScenarioIds.length}**`);
    expect(report).toContain(`**${cleanFalsePositives}/${cleanScenarioIds.length}**`);
    expect(report).toContain(`## Per-Scenario Comparison (${defectScenarioIds.length} Defect Scenarios)`);
    expect(report).toContain(`## Clean Controls (${cleanScenarioIds.length})`);
  });

  it('benchmark report does not contain stale LOSS/TIE rows during a clean sweep', () => {
    expect(winsVsBaseline).toBe(defectScenarioIds.length);
    expect(winsVsPrompted).toBe(defectScenarioIds.length);
    expect(report).not.toMatch(/\|\s(?:LOSS|TIE)\s*\|/);
  });

  it('capability map uses current benchmark scope and release wording', () => {
    expect(capabilityMap).toContain(`42/42 wins vs baseline`);
    expect(capabilityMap).toContain(`42/42 wins vs prompted`);
    expect(capabilityMap).toContain(`0/14 false positives`);
    expect(capabilityMap).not.toContain('0/6 false positives');
    expect(capabilityMap).not.toContain('v0.1.1');
  });
});

describe('All 9 tools have examples', () => {
  const exampleFiles = [
    'examples/architecture_review.md',
    'examples/billing_system_iterative.md',
    'examples/business_analysis.md',
    'examples/caught_vs_missed.md',
    'examples/detect_concurrency_patterns.md',
    'examples/debugging_reasoning.md',
    'examples/plan_validation.md',
    'examples/verify_arithmetic.md',
  ];

  for (const exampleFile of exampleFiles) {
    it(`${exampleFile} exists`, () => {
      expect(fileExists(exampleFile)).toBe(true);
    });
  }

  const allContent = exampleFiles
    .filter(f => fileExists(f))
    .map(f => readFile(f))
    .join('\n');

  const tools = [
    'validate_reasoning_chain',
    'check_numeric_claims',
    'detect_drift',
    'evaluate_tradeoffs',
    'check_plan_validity',
    'score_response_quality',
    'validate_confidence',
    'verify_arithmetic',
    'detect_concurrency_patterns',
  ];

  for (const tool of tools) {
    it(`${tool} is demonstrated in at least one example`, () => {
      expect(allContent).toMatch(new RegExp(tool, 'i'));
    });
  }
});
