import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { FoundationRegistry } from './src/design-system/foundations';
import { saveFoundationArtifacts, syncFoundationArtifacts } from './scripts/foundations-utils';

function sanitizeFoundationFontFileName(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  const baseName = fileName.slice(0, fileName.length - extension.length)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${baseName || 'font'}-${Date.now()}${extension}`;
}

function getFoundationFontFormat(fileName: string) {
  switch (extname(fileName).toLowerCase()) {
    case '.woff2':
      return 'woff2';
    case '.woff':
      return 'woff';
    case '.ttf':
      return 'truetype';
    case '.otf':
      return 'opentype';
    default:
      return null;
  }
}

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

        if (req.url === '/__internal/foundations/fonts' && req.method === 'POST') {
          const chunks: Uint8Array[] = [];

          req.on('data', (chunk) => {
            chunks.push(chunk);
          });

          req.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString('utf8');
              const parsed = JSON.parse(body) as { fileName?: string; contentBase64?: string };

              if (!parsed.fileName || !parsed.contentBase64) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing local font upload payload' }));
                return;
              }

              const fontFormat = getFoundationFontFormat(parsed.fileName);

              if (!fontFormat) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Unsupported font format. Use .woff2, .woff, .ttf, or .otf.' }));
                return;
              }

              const outputDirectory = resolve(process.cwd(), 'public/fonts/uploaded');
              const outputFileName = sanitizeFoundationFontFileName(parsed.fileName);
              const outputPath = resolve(outputDirectory, outputFileName);

              mkdirSync(outputDirectory, { recursive: true });
              writeFileSync(outputPath, Buffer.from(parsed.contentBase64, 'base64'));

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                publicUrl: `/fonts/uploaded/${outputFileName}`,
                format: fontFormat,
              }));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to upload font file' }));
            }
          });
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
