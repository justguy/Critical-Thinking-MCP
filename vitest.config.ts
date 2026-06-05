import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['.claude/**', 'dist/**'],
    // CLI/transport proof tests spawn tsx subprocesses (~5s); the default 5s
    // timeout flakes under the loaded full suite. Generous ceiling for those.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
