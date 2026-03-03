import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cesium()],
  server: {
    allowedHosts: ['df15-194-230-253-213.ngrok-free.app', 'localhost', '127.0.0.1'],
    proxy: {
      '/hexproxy': {
        target: 'https://hexdb.io',
        changeOrigin: true,
        rewrite: (path) => path.replace('/hexproxy', '')
      }
    }
  },
})
