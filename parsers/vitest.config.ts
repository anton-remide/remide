import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['parsers/__tests__/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
