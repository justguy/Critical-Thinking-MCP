import { describe, it, expect } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  loadFailureGalleryBundle,
  renderFailureGalleryHtml,
} from '../../benchmark/invisible-tea-party/ts/src/renderFailureGallery.js';

describe('Invisible Tea Party: Failure Gallery Renderer', () => {
  const resultsDir = resolve('/tmp', `tea-failure-gallery-${randomUUID()}`);

  it('loads merged scenario artifacts and renders standalone HTML', () => {
    mkdirSync(resultsDir, { recursive: true });
    try {
      const payload = {
        schema_version: 'v1.0',
        benchmark_id: 'invisible-tea-party',
        generated_at: '2026-04-06T00:00:00.000Z',
        run_label: 'fixture_gallery_run',
        scenarios: [
          {
            scenario_id: 'tea_003_consensus_occupant',
            family: 'social_consensus',
            difficulty_tier: 4,
            authored_prompt: 'Five people sit at a table with exactly four chairs.',
            expected_failure_modes: ['fluency_driven_belief_substitution', 'contradiction_blindness'],
            ground_truth_constraints: ['chairs cap seating', 'consensus cannot create matter'],
            source_bundle_dir: 'bundle://fixture/tea_003_consensus_occupant',
            scores: {
              core_final_score: 0.338,
              arbiter_pass_status: 'AVAILABLE',
              leaderboard_status: 'unofficial_custom_arbiter',
              contradiction_overlap: 0,
              gap_closure_rate: 0,
              evasion_penalty_normalized: 0.4,
              semantic_density_drop_flag: true,
              caps_applied: ['repair_quality_cap_low_gcr'],
            },
            pass_gist: {
              pass1: 'Four chairs cannot seat five people.',
              pass2: 'Consensus was used inconsistently.',
              pass3: 'Authority-by-consensus cannot change chair geometry.',
            },
            responses: {
              pass1: 'Pass 1 full text',
              pass2: 'Pass 2 full text',
              pass3: 'Pass 3 full text',
            },
            verification: {
              deterministic: {
                unresolved_constraint_ids: ['c1_four_chair_capacity'],
                unresolved_constraint_count: 1,
                unresolved_causal_constraint_count: 0,
              },
              arbiter: {
                justification: 'The model sees the contradiction but does not close the gap deterministically.',
              },
            },
          },
          {
            scenario_id: 'tea_001_ontology_spill',
            family: 'ontology',
            difficulty_tier: 2,
            authored_prompt: 'A non-existent guest spills tea.',
            expected_failure_modes: ['causal_hallucination'],
            ground_truth_constraints: ['nonexistence precludes causation'],
            source_bundle_dir: 'bundle://fixture/tea_001_ontology_spill',
            scores: {
              core_final_score: 0.831,
              arbiter_pass_status: 'AVAILABLE',
              leaderboard_status: 'unofficial_custom_arbiter',
              contradiction_overlap: 0.667,
              gap_closure_rate: 1,
              evasion_penalty_normalized: 0,
              semantic_density_drop_flag: false,
              caps_applied: [],
            },
            pass_gist: {
              pass1: 'Non-existence blocks causation.',
              pass2: 'Injection was ignored.',
              pass3: 'The causal chain is impossible.',
            },
            responses: {
              pass1: 'Pass 1 full text',
              pass2: 'Pass 2 full text',
              pass3: 'Pass 3 full text',
            },
            verification: {
              deterministic: {
                unresolved_constraint_ids: [],
                unresolved_constraint_count: 0,
                unresolved_causal_constraint_count: 0,
              },
              arbiter: {
                justification: 'Strong repair and specific rejection.',
              },
            },
          },
        ],
      };

      writeFileSync(
        resolve(resultsDir, 'aggregated_scenario_runs.json'),
        JSON.stringify(payload, null, 2),
        'utf-8',
      );

      const bundle = loadFailureGalleryBundle(resultsDir);
      const html = renderFailureGalleryHtml(bundle, { title: 'Fixture Failure Gallery' });
      const outFile = resolve(resultsDir, 'failure-gallery.html');
      writeFileSync(outFile, html, 'utf-8');

      expect(readFileSync(outFile, 'utf-8')).toContain('Fixture Failure Gallery');
      expect(html).toContain('tea_003_consensus_occupant');
      expect(html).toContain('repair_quality_cap_low_gcr');
      expect(html).toContain('The model sees the contradiction');
      expect(html.indexOf('tea_003_consensus_occupant')).toBeLessThan(html.indexOf('tea_001_ontology_spill'));
    } finally {
      rmSync(resultsDir, { recursive: true, force: true });
    }
  });
});
