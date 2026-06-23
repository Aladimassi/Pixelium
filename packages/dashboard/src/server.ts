import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DASHBOARD_PORT ?? 3000);
const BROKER_URL = process.env.BROKER_URL ?? 'http://localhost:4000';

const app = express();
app.use(express.static(join(__dirname, 'public')));

app.get('/api/config', (_req, res) => {
  res.json({ brokerUrl: BROKER_URL });
});

app.listen(PORT, () => {
  console.log(`📊 Dashboard on http://localhost:${PORT}`);
});
