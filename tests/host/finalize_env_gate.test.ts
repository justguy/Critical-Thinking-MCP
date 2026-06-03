import { describe, expect, it } from 'vitest';

import { listAdvertisedTools } from '../../src/server-runtime.js';
import { TOOLS } from '../../src/mcp/tool-definitions.js';

// Phase-4 Amendment A4: arm-D server variant must NOT advertise
// finalize_deliverable when CT_DISABLE_FINALIZE is set, so B advertises 11
// tools and D advertises 10 — with finalize_deliverable the only difference.
describe('CT_DISABLE_FINALIZE tool-list gate', () => {
  it('advertises all 11 tools (incl. finalize_deliverable) when the flag is unset', () => {
    const tools = listAdvertisedTools({});
    expect(tools).toHaveLength(11);
    expect(tools.map(t => t.name)).toContain('finalize_deliverable');
    // Sanity: with the flag unset the helper returns the full public surface.
    expect(tools).toHaveLength(TOOLS.length);
  });

  it('removes ONLY finalize_deliverable when CT_DISABLE_FINALIZE is truthy', () => {
    const full = listAdvertisedTools({});
    const gated = listAdvertisedTools({ CT_DISABLE_FINALIZE: '1' });

    expect(gated).toHaveLength(10);
    expect(gated.map(t => t.name)).not.toContain('finalize_deliverable');

    // The set difference is EXACTLY {finalize_deliverable} — every other tool
    // (name, schema object identity) is untouched.
    const removed = full.filter(t => !gated.includes(t));
    expect(removed).toHaveLength(1);
    expect(removed[0].name).toBe('finalize_deliverable');
  });
});
