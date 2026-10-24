import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  define: { __VERSAO__: 'null' },
  build: { target: 'es2022' },
  plugins: [react()],
  test: {
    dir: '..',
    include: ['frontend/src/**/*.test.ts', 'src/services/testes/*.test.mjs'],
  },
});
