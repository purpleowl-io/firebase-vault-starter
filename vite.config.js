import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/**/*.test.js'],
    // Rules tests share one emulator, so run files one after another.
    fileParallelism: false,
    testTimeout: 15000,
  },
})
