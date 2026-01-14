import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { createDiagramStore } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const app = express();
const store = createDiagramStore();

app.disable('x-powered-by');

app.use(
  cors({
    // In dev, Vite will proxy /api so this isn't strictly required, but it also
    // enables direct calls to :8787 for quick testing.
    origin: true,
    credentials: false,
  })
);

app.use(express.json({ limit: '5mb' }));

app.get('/api/healthz', (_req, res) => {
  res.json({ ok: true, store: store.kind });
});

app.post('/api/diagrams', async (req, res) => {
  try {
    const { flow, title } = req.body ?? {};

    if (!flow || typeof flow !== 'object') {
      return res.status(400).json({ error: 'Missing required field: flow' });
    }

    const id = nanoid(12);
    const now = Date.now();

    const payload = {
      version: 1,
      id,
      title: typeof title === 'string' ? title : undefined,
      createdAt: now,
      updatedAt: now,
      flow,
    };

    await store.save(id, payload);

    // Use PUBLIC_URL env var for production, fallback to request host for dev
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const shareUrl = `${baseUrl}/?diagram=${encodeURIComponent(id)}`;
    return res.status(201).json({ id, shareUrl, createdAt: now });
  } catch (e) {
    console.error('POST /api/diagrams failed:', e);
    console.error('Error details:', {
      message: e?.message,
      code: e?.code,
      statusCode: e?.statusCode,
      name: e?.name,
    });
    return res.status(500).json({ error: 'Failed to save diagram', details: e?.message || String(e) });
  }
});

app.get('/api/diagrams/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing diagram id' });

    const doc = await store.get(id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    return res.json({ id, ...doc });
  } catch (e) {
    console.error('GET /api/diagrams/:id failed:', e);
    return res.status(500).json({ error: 'Failed to load diagram' });
  }
});

// Serve SPA (built assets) in production.
const distDir = path.join(projectRoot, 'dist');
if (fs.existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      setHeaders(res, filePath) {
        // Cache immutable assets aggressively; keep index.html uncached.
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  app.get('*', (req, res) => {
    // Let /api routes 404 naturally if hit here (shouldn't happen due to order)
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`server listening on :${port} (store=${store.kind})`);
});
