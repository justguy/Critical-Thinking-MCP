import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CalibrationRunResult, CalibrationManifest } from './calibrationRunner.js';
import { loadScenarioRegistry } from './scenarioRegistry.js';

export interface ProfileStats {
  profile_id: string;
  run_count: number;
  successful_runs: number;
  failed_runs: number;
  completion_rate: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stddev: number;
  arbiter_unavailable_count: number;
  arbiter_unavailable_rate: number;
  evasion_penalty_count: number;
  evasion_penalty_rate: number;
}

export interface FamilyStats {
  family: string;
  scenario_count: number;
  mean_score: number;
  score_spread: number;
}

export interface TierStats {
  tier: number;
  scenario_count: number;
  mean_score: number;
}

export interface CapFrequency {
  rule_id: string;
  count: number;
  rate: number;
}

export interface OutlierEntry {
  profile_id: string;
  scenario_id: string;
  core_final_score: number;
  deviation: number;
  direction: 'above' | 'below';
}

export interface ErrorBreakdown {
  category: string;
  count: number;
}

export interface AggregateReport {
  schema_version: string;
  benchmark_id: 'invisible-tea-party';
  generated_at: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  overall_min: number;
  overall_max: number;
  overall_mean: number;
  overall_median: number;
  overall_stddev: number;
  profile_stats: ProfileStats[];
  family_stats: FamilyStats[];
  tier_stats: TierStats[];
  cap_frequencies: CapFrequency[];
  error_breakdown: ErrorBreakdown[];
  outliers: OutlierEntry[];
}

function computeStats(values: number[]): { min: number; max: number; mean: number; median: number; stddev: number } {
  if (values.length === 0) return { min: 0, max: 0, mean: 0, median: 0, stddev: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { min, max, mean, median, stddev: Math.sqrt(variance) };
}

export function generateAggregateReport(results: CalibrationRunResult[]): AggregateReport {
  const successful = results.filter(r => r.status === 'success');
  const scores = successful.map(r => r.core_final_score!);
  const overall = computeStats(scores);

  // Per-profile stats
  const profileIds = [...new Set(results.map(r => r.profile_id))];
  const profileStats: ProfileStats[] = profileIds.map(pid => {
    const profileResults = results.filter(r => r.profile_id === pid);
    const profileSuccessful = profileResults.filter(r => r.status === 'success');
    const profileScores = profileSuccessful.map(r => r.core_final_score!);
    const stats = computeStats(profileScores);
    const arbiterUnavail = profileSuccessful.filter(r => r.arbiter_pass_status === 'UNAVAILABLE').length;
    const evasionPenalty = profileSuccessful.filter(r => r.evasion_penalty_normalized != null && r.evasion_penalty_normalized > 0).length;
    return {
      profile_id: pid,
      run_count: profileResults.length,
      successful_runs: profileSuccessful.length,
      failed_runs: profileResults.length - profileSuccessful.length,
      completion_rate: profileResults.length > 0 ? profileSuccessful.length / profileResults.length : 0,
      ...stats,
      arbiter_unavailable_count: arbiterUnavail,
      arbiter_unavailable_rate: profileSuccessful.length > 0 ? arbiterUnavail / profileSuccessful.length : 0,
      evasion_penalty_count: evasionPenalty,
      evasion_penalty_rate: profileSuccessful.length > 0 ? evasionPenalty / profileSuccessful.length : 0,
    };
  });

  // Per-family stats
  let familyStats: FamilyStats[] = [];
  try {
    const registry = loadScenarioRegistry();
    const familyMap = new Map<string, number[]>();
    for (const result of successful) {
      const entry = registry.find(e => e.scenario_id === result.scenario_id);
      if (entry) {
        const arr = familyMap.get(entry.family) ?? [];
        arr.push(result.core_final_score!);
        familyMap.set(entry.family, arr);
      }
    }
    familyStats = [...familyMap.entries()].map(([family, fs]) => {
      const mean = fs.reduce((s, v) => s + v, 0) / fs.length;
      const spread = fs.length > 1 ? Math.max(...fs) - Math.min(...fs) : 0;
      return { family, scenario_count: fs.length, mean_score: mean, score_spread: spread };
    });
  } catch { /* skip if registry unavailable */ }

  // Per-tier stats
  let tierStats: TierStats[] = [];
  try {
    const registry = loadScenarioRegistry();
    const tierMap = new Map<number, number[]>();
    for (const result of successful) {
      const entry = registry.find(e => e.scenario_id === result.scenario_id);
      if (entry) {
        const arr = tierMap.get(entry.difficulty_tier) ?? [];
        arr.push(result.core_final_score!);
        tierMap.set(entry.difficulty_tier, arr);
      }
    }
    tierStats = [...tierMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tier, ts]) => ({
        tier, scenario_count: ts.length,
        mean_score: ts.reduce((s, v) => s + v, 0) / ts.length,
      }));
  } catch { /* skip */ }

  // Cap frequencies
  const capCounts = new Map<string, number>();
  for (const r of successful) {
    for (const cap of r.caps_applied) {
      capCounts.set(cap, (capCounts.get(cap) ?? 0) + 1);
    }
  }
  const capFrequencies: CapFrequency[] = [...capCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([rule_id, count]) => ({
      rule_id, count,
      rate: successful.length > 0 ? count / successful.length : 0,
    }));

  // Error breakdown
  const errorCounts = new Map<string, number>();
  for (const r of results.filter(r => r.status === 'failed')) {
    const cat = r.error_category ?? 'unexpected_failure';
    errorCounts.set(cat, (errorCounts.get(cat) ?? 0) + 1);
  }
  const errorBreakdown: ErrorBreakdown[] = [...errorCounts.entries()]
    .map(([category, count]) => ({ category, count }));

  // Outliers (> 2 stddev)
  const outliers: OutlierEntry[] = [];
  if (overall.stddev > 0) {
    for (const result of successful) {
      const deviation = Math.abs(result.core_final_score! - overall.mean);
      if (deviation > 2 * overall.stddev) {
        outliers.push({
          profile_id: result.profile_id,
          scenario_id: result.scenario_id,
          core_final_score: result.core_final_score!,
          deviation: deviation / overall.stddev,
          direction: result.core_final_score! > overall.mean ? 'above' : 'below',
        });
      }
    }
  }

  return {
    schema_version: 'v1.0',
    benchmark_id: 'invisible-tea-party',
    generated_at: new Date().toISOString(),
    total_runs: results.length,
    successful_runs: successful.length,
    failed_runs: results.length - successful.length,
    overall_min: overall.min,
    overall_max: overall.max,
    overall_mean: overall.mean,
    overall_median: overall.median,
    overall_stddev: overall.stddev,
    profile_stats: profileStats,
    family_stats: familyStats,
    tier_stats: tierStats,
    cap_frequencies: capFrequencies,
    error_breakdown: errorBreakdown,
    outliers,
  };
}

function fmt(n: number, d = 4): string { return n.toFixed(d); }

export function generateMarkdownReport(report: AggregateReport): string {
  const lines: string[] = [];

  lines.push('# Invisible Tea Party — Calibration Report');
  lines.push('');
  lines.push(`Generated: ${report.generated_at}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total runs | ${report.total_runs} |`);
  lines.push(`| Successful | ${report.successful_runs} |`);
  lines.push(`| Failed | ${report.failed_runs} |`);
  lines.push(`| Overall min | ${fmt(report.overall_min)} |`);
  lines.push(`| Overall max | ${fmt(report.overall_max)} |`);
  lines.push(`| Overall mean | ${fmt(report.overall_mean)} |`);
  lines.push(`| Overall median | ${fmt(report.overall_median)} |`);
  lines.push(`| Overall stddev | ${fmt(report.overall_stddev)} |`);
  lines.push('');

  if (report.profile_stats.length > 0) {
    lines.push('## Per-Profile Scores');
    lines.push('');
    lines.push('| Profile | Runs | Completion | Min | Max | Mean | Median | StdDev | Arbiter Unavail | Evasion Penalty |');
    lines.push('|---------|------|------------|-----|-----|------|--------|--------|-----------------|-----------------|');
    for (const ps of report.profile_stats) {
      lines.push(
        `| ${ps.profile_id} | ${ps.successful_runs}/${ps.run_count} | ${fmt(ps.completion_rate * 100, 0)}% | ${fmt(ps.min)} | ${fmt(ps.max)} | ${fmt(ps.mean)} | ${fmt(ps.median)} | ${fmt(ps.stddev)} | ${ps.arbiter_unavailable_count} (${fmt(ps.arbiter_unavailable_rate * 100, 0)}%) | ${ps.evasion_penalty_count} (${fmt(ps.evasion_penalty_rate * 100, 0)}%) |`,
      );
    }
    lines.push('');
  }

  if (report.family_stats.length > 0) {
    lines.push('## Per-Family Scores');
    lines.push('');
    lines.push('| Family | Scenarios | Mean Score | Spread |');
    lines.push('|--------|-----------|------------|--------|');
    for (const fs of report.family_stats) {
      lines.push(`| ${fs.family} | ${fs.scenario_count} | ${fmt(fs.mean_score)} | ${fmt(fs.score_spread)} |`);
    }
    lines.push('');
  }

  if (report.tier_stats.length > 0) {
    lines.push('## Per-Tier Scores');
    lines.push('');
    lines.push('| Tier | Scenarios | Mean Score |');
    lines.push('|------|-----------|------------|');
    for (const ts of report.tier_stats) {
      lines.push(`| ${ts.tier} | ${ts.scenario_count} | ${fmt(ts.mean_score)} |`);
    }
    lines.push('');
  }

  if (report.cap_frequencies.length > 0) {
    lines.push('## Cap Frequencies');
    lines.push('');
    lines.push('| Rule | Count | Rate |');
    lines.push('|------|-------|------|');
    for (const c of report.cap_frequencies) {
      lines.push(`| ${c.rule_id} | ${c.count} | ${fmt(c.rate * 100, 1)}% |`);
    }
    lines.push('');
  }

  if (report.error_breakdown.length > 0) {
    lines.push('## Error Breakdown');
    lines.push('');
    lines.push('| Category | Count |');
    lines.push('|----------|-------|');
    for (const e of report.error_breakdown) {
      lines.push(`| ${e.category} | ${e.count} |`);
    }
    lines.push('');
  }

  if (report.outliers.length > 0) {
    lines.push('## Outliers (> 2 StdDev)');
    lines.push('');
    lines.push('| Profile | Scenario | Score | Deviation | Direction |');
    lines.push('|---------|----------|-------|-----------|-----------|');
    for (const o of report.outliers) {
      lines.push(`| ${o.profile_id} | ${o.scenario_id} | ${fmt(o.core_final_score)} | ${fmt(o.deviation, 2)}σ | ${o.direction} |`);
    }
    lines.push('');
  } else {
    lines.push('## Outliers');
    lines.push('');
    lines.push('No outliers detected (all scores within 2 standard deviations of the mean).');
    lines.push('');
  }

  return lines.join('\n');
}

export function generateThresholdReview(report: AggregateReport): string {
  const lines: string[] = [];
  lines.push('# Invisible Tea Party — Threshold Review');
  lines.push('');
  lines.push(`Generated: ${report.generated_at}`);
  lines.push('');

  // Q1: Are scores degenerate or useful?
  lines.push('## 1. Are scores degenerate or useful?');
  lines.push('');
  if (report.overall_stddev < 0.05) {
    lines.push(`**WARNING: Scores appear degenerate.** Standard deviation is ${fmt(report.overall_stddev)} — nearly all scores cluster around ${fmt(report.overall_mean)}. The benchmark may not be discriminating between good and bad reasoning.`);
  } else if (report.overall_stddev < 0.10) {
    lines.push(`**Marginal spread.** Standard deviation is ${fmt(report.overall_stddev)} with mean ${fmt(report.overall_mean)}. Scores show some variation but may not be separating models strongly.`);
  } else {
    lines.push(`**Scores show useful variation.** Standard deviation is ${fmt(report.overall_stddev)} with mean ${fmt(report.overall_mean)} and median ${fmt(report.overall_median)}. The score range [${fmt(report.overall_min)} – ${fmt(report.overall_max)}] suggests the benchmark is discriminating.`);
  }
  lines.push('');

  // Q2: Which scenarios separate models best?
  lines.push('## 2. Which scenarios separate models best?');
  lines.push('');
  if (report.family_stats.length > 0) {
    const sorted = [...report.family_stats].sort((a, b) => b.score_spread - a.score_spread);
    if (sorted[0].score_spread > 0) {
      lines.push(`Highest discrimination by family: **${sorted[0].family}** (spread: ${fmt(sorted[0].score_spread)}).`);
    } else {
      lines.push('All families show zero spread — only one profile tested per family, or all profiles score identically.');
    }
    const lowest = report.family_stats.reduce((a, b) => a.mean_score < b.mean_score ? a : b);
    const highest = report.family_stats.reduce((a, b) => a.mean_score > b.mean_score ? a : b);
    lines.push(`Hardest family: **${lowest.family}** (mean: ${fmt(lowest.mean_score)}).`);
    lines.push(`Easiest family: **${highest.family}** (mean: ${fmt(highest.mean_score)}).`);
  } else {
    lines.push('No family breakdown available.');
  }
  lines.push('');

  // Q3: Which caps fire most often?
  lines.push('## 3. Which caps fire most often?');
  lines.push('');
  if (report.cap_frequencies.length === 0) {
    lines.push('No caps fired across any runs. Thresholds may be too lenient or test outputs may be clean.');
  } else {
    for (const c of report.cap_frequencies) {
      lines.push(`- **${c.rule_id}**: ${c.count} times (${fmt(c.rate * 100, 1)}% of successful runs)`);
    }
  }
  lines.push('');

  // Q4: Is any threshold too strict or too lenient?
  lines.push('## 4. Is any threshold obviously too strict or too lenient?');
  lines.push('');
  const highArbiterUnavail = report.profile_stats.filter(p => p.arbiter_unavailable_rate > 0.5);
  if (highArbiterUnavail.length > 0) {
    lines.push(`**Arbiter unavailability is high** for: ${highArbiterUnavail.map(p => `${p.profile_id} (${fmt(p.arbiter_unavailable_rate * 100, 0)}%)`).join(', ')}. This may indicate the arbiter schema is too strict or the arbiter model is unreliable.`);
  }
  const allScoresLow = report.overall_mean < 0.3;
  const allScoresHigh = report.overall_mean > 0.85;
  if (allScoresLow) {
    lines.push('**Mean score is very low** — thresholds may be too punitive, or the executor is weak on this benchmark.');
  } else if (allScoresHigh) {
    lines.push('**Mean score is very high** — thresholds may be too lenient, or the scenarios are too easy for this executor.');
  } else {
    lines.push('No obviously broken thresholds detected from this data.');
  }
  const highEvasion = report.profile_stats.filter(p => p.evasion_penalty_rate > 0.5);
  if (highEvasion.length > 0) {
    lines.push(`**Evasion penalty fires frequently** for: ${highEvasion.map(p => `${p.profile_id} (${fmt(p.evasion_penalty_rate * 100, 0)}%)`).join(', ')}. The density drop threshold may need review.`);
  }
  lines.push('');

  return lines.join('\n');
}

export function loadCalibrationManifest(resultsDir: string): CalibrationManifest {
  const manifestPath = resolve(resultsDir, 'calibration_manifest.json');
  return JSON.parse(readFileSync(manifestPath, 'utf-8')) as CalibrationManifest;
}

export function writeAllReports(
  resultsDir: string,
  results?: CalibrationRunResult[],
  outputDir?: string,
): AggregateReport {
  const runResults = results ?? loadCalibrationManifest(resultsDir).results;
  const report = generateAggregateReport(runResults);
  const targetDir = resolve(outputDir ?? resultsDir);

  mkdirSync(targetDir, { recursive: true });

  // calibration_summary.json (= aggregate_report.json)
  const reportJson = JSON.stringify(report, null, 2) + '\n';
  writeFileSync(resolve(targetDir, 'aggregate_report.json'), reportJson, 'utf-8');
  writeFileSync(resolve(targetDir, 'calibration_summary.json'), reportJson, 'utf-8');

  // calibration_summary.md (= aggregate_report.md)
  const markdown = generateMarkdownReport(report) + '\n';
  writeFileSync(resolve(targetDir, 'aggregate_report.md'), markdown, 'utf-8');
  writeFileSync(resolve(targetDir, 'calibration_summary.md'), markdown, 'utf-8');

  // model_breakdown.json
  writeFileSync(
    resolve(targetDir, 'model_breakdown.json'),
    JSON.stringify({ profile_stats: report.profile_stats }, null, 2) + '\n', 'utf-8',
  );

  // scenario_breakdown.json
  writeFileSync(
    resolve(targetDir, 'scenario_breakdown.json'),
    JSON.stringify({ family_stats: report.family_stats, tier_stats: report.tier_stats }, null, 2) + '\n', 'utf-8',
  );

  // threshold_review.md
  const thresholdReview = generateThresholdReview(report) + '\n';
  writeFileSync(resolve(targetDir, 'threshold_review.md'), thresholdReview, 'utf-8');

  return report;
}
