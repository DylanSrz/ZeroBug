import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Los specs que importan AppModule comparten una única PostgreSQL:
    // se ejecutan en serie para evitar carreras en migraciones y datos.
    fileParallelism: false,
  },
});
