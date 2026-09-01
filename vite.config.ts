import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // The SPA never talks to the cloud phone API directly — every call goes
      // through the MADOVA API server, which holds the key. See server/index.ts
      '/api': {
        target: process.env.MADOVA_API_ORIGIN ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
