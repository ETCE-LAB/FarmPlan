import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/bgr': {
        target: 'https://services.bgr.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bgr/, ''),
      },
      '/api/flask': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/flask/, ''),
      },
    },
  },
})