import { describe, expect, it } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleDetectConcurrencyPatterns } from '../../src/tools/detect_concurrency_patterns.js';

describe('detect_concurrency_patterns deadlock analysis', () => {
  it('flags a Coffman-style circular wait as a blocking deadlock risk', () => {
    const engine = new EnforcementEngine();

    const result = handleDetectConcurrencyPatterns(
      {
        steps: ['Task A holds R1 and waits for R2', 'Task B holds R2 and waits for R1'],
        resource_allocation: {
          tasks: [
            { id: 'task_a', holds: ['r1'], waits_for: ['r2'] },
            { id: 'task_b', holds: ['r2'], waits_for: ['r1'] },
          ],
          resources: [
            { id: 'r1', mode: 'exclusive', preemptible: false },
            { id: 'r2', mode: 'exclusive', preemptible: false },
          ],
        },
      },
      engine,
    );

    expect(result.status).toBe('ENFORCEMENT_FAIL');
    expect(result.patterns_detected).toContain('deadlock_risk');
    expect(result.enforcement?.blocking_issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mechanism: 'concurrency_pattern' }),
      ]),
    );
  });

  it('does not flag deadlock when waited resources are preemptible', () => {
    const engine = new EnforcementEngine();

    const result = handleDetectConcurrencyPatterns(
      {
        steps: ['Task A may be preempted while waiting', 'Task B may be preempted while waiting'],
        resource_allocation: {
          tasks: [
            { id: 'task_a', holds: ['r1'], waits_for: ['r2'] },
            { id: 'task_b', holds: ['r2'], waits_for: ['r1'] },
          ],
          resources: [
            { id: 'r1', mode: 'exclusive', preemptible: true },
            { id: 'r2', mode: 'exclusive', preemptible: true },
          ],
        },
      },
      engine,
    );

    expect(result.patterns_detected).not.toContain('deadlock_risk');
  });

  it('does not flag deadlock when resources are shared and no mutual exclusion exists', () => {
    const engine = new EnforcementEngine();

    const result = handleDetectConcurrencyPatterns(
      {
        steps: ['Reader A accesses the shared cache', 'Reader B accesses the shared cache'],
        resource_allocation: {
          tasks: [
            { id: 'task_a', holds: ['cache'], waits_for: ['cache'] },
            { id: 'task_b', holds: ['cache'], waits_for: ['cache'] },
          ],
          resources: [{ id: 'cache', mode: 'shared', preemptible: false }],
        },
      },
      engine,
    );

    expect(result.patterns_detected).not.toContain('deadlock_risk');
  });
});
