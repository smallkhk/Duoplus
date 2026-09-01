import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  /**
   * The entry HTML lives in web/ rather than the project root.
   *
   * On cPanel the project root is also the document root, and Apache serves an
   * index.html it finds there before Passenger ever sees the request — which
   * meant the bare "/" returned Vite's unbuilt template instead of the app.
   * Keeping no index.html at the root removes that class of problem entirely,
   * rather than relying on a DirectoryIndex override the host may not permit.
   */
  root: 'web',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
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
