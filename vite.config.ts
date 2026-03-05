import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom domain tracker.remide.xyz → base='/'
export default defineConfig(() => ({
  plugins: [react()],
  base: '/',
  server: { host: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
          recharts: ['recharts'],
        },
      },
    },
  },
}))
