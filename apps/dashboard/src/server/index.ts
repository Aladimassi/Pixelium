import express from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const PORT = Number(process.env.DASHBOARD_PORT ?? 3000);
const isProd = process.env.NODE_ENV === 'production';
const BROKER_URL = process.env.BROKER_URL ?? (isProd ? '/broker' : 'http://localhost:4000');

async function main() {
  const app = express();

  app.get('/api/config', (_req, res) => {
    res.json({ brokerUrl: BROKER_URL });
  });

  if (isProd) {
    const clientDir = join(root, 'dist/client');
    app.use(express.static(clientDir));
    app.use((_req, res) => {
      res.sendFile(join(clientDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      root,
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      try {
        const template = readFileSync(join(root, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  }

  app.listen(PORT, () => {
    console.log(`📊 Dashboard on http://localhost:${PORT}`);
  });
}

main();