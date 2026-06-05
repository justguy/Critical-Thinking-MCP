import { describe, expect, it } from 'vitest';

import { listAdvertisedTools } from '../../src/server-runtime.js';
import { TOOLS } from '../../src/mcp/tool-definitions.js';

// Discovery-surface composition (chunk B). The DEFAULT tools/list surface is the
// single review_before_final facade; CT_EXPOSE_ALL opts into the full public
// surface; CT_DISABLE_FINALIZE then composes on top of the full surface to drop
// finalize_deliverable (Phase-4 arm-D "no-finalize" variant). Hiding is
// discovery-only — CallTool still dispatches all 12 handlers (proved elsewhere).
describe('discovery surface composition (CT_EXPOSE_ALL / CT_DISABLE_FINALIZE)', () => {
  it('advertises ONLY review_before_final when no flags are set (default-minimal)', () => {
    const tools = listAdvertisedTools({});
    expect(tools).toHaveLength(1);
    expect(tools.map(t => t.name)).toEqual(['review_before_final']);
  });

  it('advertises all 12 tools (incl. finalize_deliverable) with CT_EXPOSE_ALL', () => {
    const tools = listAdvertisedTools({ CT_EXPOSE_ALL: '1' });
    expect(tools).toHaveLength(12);
    expect(tools.map(t => t.name)).toContain('finalize_deliverable');
    // Sanity: CT_EXPOSE_ALL returns the full public surface.
    expect(tools).toHaveLength(TOOLS.length);
  });

  it('removes ONLY finalize_deliverable when CT_EXPOSE_ALL + CT_DISABLE_FINALIZE', () => {
    const full = listAdvertisedTools({ CT_EXPOSE_ALL: '1' });
    const gated = listAdvertisedTools({ CT_EXPOSE_ALL: '1', CT_DISABLE_FINALIZE: '1' });

    expect(gated).toHaveLength(11);
    expect(gated.map(t => t.name)).not.toContain('finalize_deliverable');

    // The set difference is EXACTLY {finalize_deliverable} — every other tool
    // (name, schema object identity) is untouched.
    const removed = full.filter(t => !gated.includes(t));
    expect(removed).toHaveLength(1);
    expect(removed[0].name).toBe('finalize_deliverable');
  });

  it('CT_DISABLE_FINALIZE without CT_EXPOSE_ALL still shows only the facade', () => {
    // Without the full surface there is no finalize to remove; the default
    // minimal surface is unchanged.
    const tools = listAdvertisedTools({ CT_DISABLE_FINALIZE: '1' });
    expect(tools.map(t => t.name)).toEqual(['review_before_final']);
  });
});
