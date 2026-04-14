import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ThresholdProfile {
  profile_id: string;
  description: string;
  premise_generic_cap_overlap_threshold: number;
  repair_substantive_min_gcr: number;
  density_drop_word_multiplier: number;
  density_drop_gcr_threshold: number;
  sycophancy_core_score_cap: number;
  strong_causal_requires_zero_unresolved_causal_constraints: boolean;
  weights: Record<string, number>;
}

export interface CertifiedArbiter {
  provider: string;
  model_id: string;
  certification_status: 'ACTIVE' | 'INACTIVE';
  rationale: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_DIR = resolve(__dirname, '../../config');

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(CONFIG_DIR, name), 'utf-8')) as T;
}

export function loadThresholdProfile(profileId = 'v1_provisional'): ThresholdProfile {
  const data = loadJson<{ profiles: ThresholdProfile[] }>('threshold_profiles.json');
  const profile = data.profiles.find(item => item.profile_id === profileId);
  if (!profile) {
    throw new Error(`Unknown threshold profile: ${profileId}`);
  }
  return profile;
}

export function loadCertifiedArbiters(): CertifiedArbiter[] {
  const data = loadJson<{ official_v1_arbiters: CertifiedArbiter[] }>('certified_arbiters.json');
  return data.official_v1_arbiters;
}
