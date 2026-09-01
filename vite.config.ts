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
      // Dev-only passthrough to the upstream cloud-phone OpenAPI so the console
      // can talk to the live backend without CORS. See src/lib/duoplus/client.ts
      '/upstream': {
        target: 'https://openapi.duoplus.net',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/upstream/, ''),
      },
    },
  },
})
