import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { FoundationRegistry } from './src/design-system/foundations';
import { saveFoundationArtifacts, syncFoundationArtifacts } from './scripts/foundations-utils';

function foundationsSaveBridge() {
  return {
    name: 'foundations-save-bridge',
    buildStart() {
      syncFoundationArtifacts();
    },
    configureServer(server: import('vite').ViteDevServer) {
      syncFoundationArtifacts();

      server.middlewares.use('/__internal/foundations', async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        if (req.method === 'GET') {
          try {
            const registry = syncFoundationArtifacts();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(registry));
            return;
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to load foundations' }));
            return;
          }
        }

        if (req.method === 'PUT') {
          const chunks: Uint8Array[] = [];

          req.on('data', (chunk) => {
            chunks.push(chunk);
          });

          req.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString('utf8');
              const parsed = JSON.parse(body) as { registry?: unknown };

              if (!parsed.registry || typeof parsed.registry !== 'object') {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing registry payload' }));
                return;
              }

              const savedRegistry = saveFoundationArtifacts(parsed.registry as FoundationRegistry);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(savedRegistry));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to save foundations' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// Custom domain tracker.remide.xyz → base='/'
export default defineConfig(() => ({
  plugins: [react(), foundationsSaveBridge()],
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
}));
