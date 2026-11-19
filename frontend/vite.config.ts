import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { request as httpsRequest } from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function s3EmulatorRelayPlugin(): Plugin {
  return {
    name: 's3-emulator-relay',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/__s3_local/')) return next();

        const s3Path = req.url.slice('/__s3_local'.length);
        const caPath = resolve(__dirname, '../.local/aws-emulator/ca.pem');
        const ca = existsSync(caPath) ? readFileSync(caPath) : undefined;

        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          });
          res.end();
          return;
        }

        const upstream = httpsRequest(
          {
            hostname: '127.0.0.1',
            port: 9297,
            path: s3Path,
            method: req.method,
            headers: {
              ...req.headers,
              host: '127.0.0.1:9297',
            },
            ca,
            rejectUnauthorized: false,
          },
          (upstreamRes) => {
            const hopByHop = new Set(['connection', 'keep-alive', 'transfer-encoding']);
            const headers: Record<string, string | string[]> = {};
            for (const [k, v] of Object.entries(upstreamRes.headers)) {
              if (!hopByHop.has(k.toLowerCase()) && v !== undefined) headers[k] = v;
            }
            headers['access-control-allow-origin'] = '*';
            headers['access-control-expose-headers'] = '*';

            res.writeHead(upstreamRes.statusCode || 500, headers);
            upstreamRes.pipe(res);
          },
        );

        upstream.on('error', (err) => {
          console.error('[S3-Relay Error]:', err.message);
          if (!res.headersSent) {
            res.writeHead(502, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'S3 Relay Error: ' + err.message }));
          }
        });

        req.pipe(upstream);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), s3EmulatorRelayPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/jobs': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
