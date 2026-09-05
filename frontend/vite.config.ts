import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/ws': {
        target: 'ws://127.0.0.1:8081',
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api': {
        target: 'http://127.0.0.1:8081',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
