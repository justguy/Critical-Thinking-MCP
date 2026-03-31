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

function fileExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
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

  it('benchmark/BENCHMARK.md exists', () => {
    expect(fileExists('benchmark/BENCHMARK.md')).toBe(true);
  });

  it('benchmark/rubric.json exists', () => {
    expect(fileExists('benchmark/rubric.json')).toBe(true);
  });

  it('benchmark/scenarios.json exists', () => {
    expect(fileExists('benchmark/scenarios.json')).toBe(true);
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

  it('description mentions seven tools and key capabilities', () => {
    const desc = pkg.description.toLowerCase();
    expect(desc).toMatch(/nine tools|9 tools/);
    expect(desc).toMatch(/confidence inflation/);
    expect(desc).toMatch(/circular logic/);
  });

  it('license is MIT', () => {
    expect(pkg.license).toBe('MIT');
  });
});

describe('All 7 tools have examples', () => {
  const exampleFiles = [
    'examples/architecture_review.md',
    'examples/billing_system_iterative.md',
    'examples/business_analysis.md',
    'examples/caught_vs_missed.md',
    'examples/debugging_reasoning.md',
    'examples/plan_validation.md',
  ];

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
  ];

  for (const tool of tools) {
    it(`${tool} is demonstrated in at least one example`, () => {
      expect(allContent).toMatch(new RegExp(tool, 'i'));
    });
  }
});
