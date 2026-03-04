import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: base='/' (localhost:5173/)
// Prod: base='/remide/' (GitHub Pages at anton-remide.github.io/remide/)
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/remide/' : '/',
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
