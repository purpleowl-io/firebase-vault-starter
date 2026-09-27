import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  // Refuse to build a site that can't connect to Firebase, instead of publishing a blank page.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (command === 'build' && mode !== 'test' && env.VITE_USE_EMULATORS !== 'true' && !env.VITE_FIREBASE_API_KEY) {
    throw new Error(
      'Your Firebase settings are missing from .env.local. Run `npm run setup` (see docs/SETUP.md), then build again.'
    )
  }

  return {
    plugins: [react()],
    server: { port: 5173, strictPort: true },
    // The Firebase SDK is most of the bundle; this is expected for a Firebase app.
    build: { chunkSizeWarningLimit: 1000 },
    test: {
      include: ['tests/**/*.test.js'],
      // Rules tests share one emulator, so run files one after another.
      fileParallelism: false,
      testTimeout: 15000,
    },
  }
})
