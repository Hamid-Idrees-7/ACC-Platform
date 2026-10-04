import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A live build must know where the API is (VITE_API_ORIGIN, see .env.example).
  // Without it every visitor's browser would call localhost, so the build stops here instead.
  if (command === 'build' && !loadEnv(mode, process.cwd(), '').VITE_API_ORIGIN) {
    throw new Error('Set VITE_API_ORIGIN (see .env.example) before building for the live site.')
  }

  return {
    plugins: [react()],
  }
})
