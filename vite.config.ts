import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/lexcore-law-memorization/' : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    target: 'es2020',
  },
}))
