import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/db/**', 'tests/e2e/**', 'node_modules/**'],
    clearMocks: true,
  },
})
