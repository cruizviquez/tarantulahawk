#!/usr/bin/env node
/**
 * Script: index_pages.js
 * Purpose: Fetch a list of page URLs, extract text, chunk, get embeddings via Hugging Face,
 * and insert chunks + embeddings into Supabase `documents` and `embeddings` tables.
 *
 * Usage:
 * 1. Install deps: npm install node-fetch@2 cheerio @supabase/supabase-js dotenv
 * 2. Set env vars in .env.local (see README or below)
 * 3. Edit the `URLS` array below or pass your own list. Run: node scripts/index_pages.js
 *
 * Required env vars:
 * - HUGGINGFACE_API_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - EMBEDDING_MODEL (e.g. sentence-transformers/all-MiniLM-L6-v2)
 * - RAG_EMBED_DIM (e.g. 384)
 */

// Load environment variables: prefer .env.local then fallback to .env
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const HF_KEY = process.env.HUGGINGFACE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
const RAG_EMBED_DIM = parseInt(process.env.RAG_EMBED_DIM || '384', 10);
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';

if (!HF_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars. Set HUGGINGFACE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Edit this list to include the pages you want to index
const URLS = [
  'https://tarantulahawk.cloud/blog',
  'https://tarantulahawk.cloud/',
  'https://tarantulahawk.cloud/sitemap.xml',
  'https://tarantulahawk.cloud/sistema-prevencion-lavado-dinero-lfpiopri'
];

async function fetchPageText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fetch failed: ' + res.statusText);
  const html = await res.text();
  const $ = cheerio.load(html);
  // try to grab main content areas
  const main = $('main').text() || $('article').text() || $('body').text();
  return main.replace(/\s+/g, ' ').trim();
}

function chunkText(text, maxChars = 800, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + maxChars, text.length);
    let chunk = text.slice(i, end);
    // extend to sentence end if possible
    const lastPeriod = chunk.lastIndexOf('.');
    if (lastPeriod > Math.floor(chunk.length * 0.5) && end < text.length) {
      chunk = text.slice(i, i + lastPeriod + 1);
    }
    chunks.push(chunk.trim());
    i = i + maxChars - overlap;
    if (i < 0) i = 0;
  }
  return chunks.filter(Boolean);
}

async function getEmbedding(text) {
  // Try new Hugging Face Router endpoint first (router.huggingface.co)
  const tryUrls = [
    // Router endpoint with model in path (preferred): /embeddings/{model}
    { url: `https://router.huggingface.co/embeddings/${encodeURIComponent(EMBEDDING_MODEL)}`, body: { input: text } },
    // Router endpoint using models path (some accounts/endpoints use /models/{model})
    { url: `https://router.huggingface.co/models/${encodeURIComponent(EMBEDDING_MODEL)}`, body: { input: text } },
    { url: `https://router.huggingface.co/models/${encodeURIComponent(EMBEDDING_MODEL)}/embeddings`, body: { input: text } },
    // Router endpoint with model in body
    { url: 'https://router.huggingface.co/embeddings', body: { model: EMBEDDING_MODEL, input: text } },
    // Legacy inference endpoints (fallback)
    { url: `https://api-inference.huggingface.co/embeddings/${EMBEDDING_MODEL}`, body: { inputs: text } },
    { url: 'https://api-inference.huggingface.co/embeddings', body: { model: EMBEDDING_MODEL, inputs: text } }
  ];

  let lastErr = null;
  for (const candidate of tryUrls) {
    // try a few body variants for compatibility
    const bodies = [candidate.body, { model: EMBEDDING_MODEL, inputs: text }, { model: EMBEDDING_MODEL, input: text }, { inputs: text }, { input: text }];
    for (const body of bodies) {
      try {
        console.log('HF: trying', candidate.url, 'bodyKeys=', Object.keys(body || {}).join(','));
        const res = await fetch(candidate.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${HF_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const txt = await res.text();
        let data;
        try { data = JSON.parse(txt); } catch (e) { data = txt; }
        if (!res.ok) {
          lastErr = `Embedding error (${candidate.url}): ${txt}`;
          console.warn(lastErr);
          continue;
        }
        // HF router responses can vary; try common shapes
        if (data === null || data === undefined) {
          lastErr = `Empty response from ${candidate.url}`;
          continue;
        }
        if (data.embedding) return data.embedding;
        if (data.data && data.data[0] && data.data[0].embedding) return data.data[0].embedding;
        if (Array.isArray(data) && data[0] && data[0].embedding) return data[0].embedding;
        if (Array.isArray(data) && typeof data[0] === 'number') return data; // already an embedding vector
        if (data.outputs && data.outputs[0] && data.outputs[0].embedding) return data.outputs[0].embedding;

        lastErr = `Unknown embedding response format from ${candidate.url}: ${txt}`;
        console.warn(lastErr);
      } catch (err) {
        lastErr = err.message || String(err);
        console.warn('HF request failed', lastErr);
      }
    }
  }
  throw new Error(lastErr || 'Embedding failed (no candidate succeeded)');
}

async function getOpenAIEmbedding(text) {
  if (!OPENAI_KEY) throw new Error('No OpenAI key available for fallback');
  const url = 'https://api.openai.com/v1/embeddings';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input: text })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('OpenAI embedding error: ' + JSON.stringify(data));
  if (data.data && data.data[0] && data.data[0].embedding) return data.data[0].embedding;
  throw new Error('Unknown OpenAI embedding response');
}

async function indexUrl(url) {
  console.log('Processing', url);
  const text = await fetchPageText(url);
  const title = url.split('/').filter(Boolean).pop() || url;
  const chunks = chunkText(text, 800, 200);
  console.log(`Found ${chunks.length} chunks`);

  for (const chunk of chunks) {
    // insert document
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .insert([{
        source: 'site',
        source_id: url,
        title: title,
        content: chunk,
        url: url,
        metadata: { indexed_at: new Date().toISOString() }
      }])
      .select('id')
      .limit(1)
      .single();

    if (docErr) {
      console.error('Insert doc error', docErr);
      continue;
    }

    const document_id = doc.id;
    // get embedding
    const embedding = await getEmbedding(chunk);

    // insert embedding (Supabase pgvector accepts arrays)
    const { error: embErr } = await supabase
      .from('embeddings')
      .insert([{
        document_id,
        embedding,
      }]);

    if (embErr) {
      console.error('Insert embedding error', embErr);
    } else {
      console.log('Indexed chunk for', url);
    }
    // brief pause to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }
}

async function main() {
  for (const url of URLS) {
    try {
      await indexUrl(url);
    } catch (e) {
      console.error('Failed', url, e.message || e);
    }
  }
  console.log('Done');
}

if (require.main === module) main();
