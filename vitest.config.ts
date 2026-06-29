import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Vitest escopado à lógica pura do app (src/lib/**), sem JSX/React Native.
// Testes de UI seguem verificação manual + typecheck.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
    passWithNoTests: true,
  },
});
