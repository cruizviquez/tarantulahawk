#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');
const HF_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL = process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
const text = 'Prueba rápida de embeddings.';
(async () => {
  try {
    const candidates = [
      `https://router.huggingface.co/embeddings/${encodeURIComponent(MODEL)}`,
      `https://router.huggingface.co/models/${encodeURIComponent(MODEL)}`,
      `https://router.huggingface.co/models/${encodeURIComponent(MODEL)}/embeddings`,
      'https://router.huggingface.co/embeddings',
      `https://api-inference.huggingface.co/embeddings/${encodeURIComponent(MODEL)}`,
      'https://api-inference.huggingface.co/embeddings'
    ];

    for (const url of candidates) {
      try {
        const body = { input: text };
        console.log('\nPOST', url, 'bodyKeys=', Object.keys(body).join(','));
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${HF_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const txt = await res.text();
        console.log('status', res.status);
        console.log('body', txt.slice(0, 4000));
      } catch (err) {
        console.error('request failed', err.message || err);
      }
    }
  } catch (err) {
    console.error('request failed', err.message || err);
  }
})();
