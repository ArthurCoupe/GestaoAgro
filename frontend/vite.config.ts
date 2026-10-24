import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  define: { __VERSAO__: 'null' },
  build: { target: 'es2022' },
  plugins: [react()],
});
