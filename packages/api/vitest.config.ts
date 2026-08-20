import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/authentication/authentication.ts',
        'src/database/database.ts',
        'src/documents/artifact-integrity.ts',
        'src/invoices/invoices.ts',
        'src/observability/http-tracing.ts',
      ],
      reporter: ['text', 'json-summary'],
      thresholds: {
        'src/authentication/authentication.ts': {
          branches: 65,
          functions: 65,
          lines: 75,
          statements: 73,
        },
        'src/database/database.ts': {
          branches: 75,
          functions: 75,
          lines: 90,
          statements: 90,
        },
        'src/documents/artifact-integrity.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'src/invoices/invoices.ts': {
          branches: 20,
          functions: 25,
          lines: 35,
          statements: 35,
        },
        'src/observability/http-tracing.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  },
});
