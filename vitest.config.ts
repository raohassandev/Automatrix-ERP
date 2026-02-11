import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    // CI reliability: our current test suite is server-side business logic tests.
    // Using jsdom can break in Linux/CI when transitive deps shift to ESM-only.
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/playwright/**'],
  },
})
