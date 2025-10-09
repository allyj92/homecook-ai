// server.js (Express 예)
import express from 'express';
import fetch from 'node-fetch';

const app = express();

app.get('/api/img', async (req, res) => {
  try {
    const u = req.query.u;
    if (!u) return res.status(400).send('Missing u');

    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return res.status(r.status).send('fetch fail');

    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    // 스트림 전달
    r.body.pipe(res);
  } catch (e) {
    res.status(500).send('proxy error');
  }
});

app.listen(3000, () => console.log('dev server on 3000'));