#!/usr/bin/env python3
"""
Local indexer: fetch pages, extract text, chunk, embed with sentence-transformers locally,
and insert into Supabase `documents` and `embeddings` tables.

Usage:
- Install dependencies: `pip install -r requirements-indexer.txt`
- Add env vars to `.env.local`: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- Edit the URLS list below to include pages to index
- Run: `python scripts/index_pages_py.py`
"""
import os
import time
import json
from urllib.parse import urlparse
from dotenv import load_dotenv
import requests
from sentence_transformers import SentenceTransformer
from supabase import create_client

# load .env.local (fallback to .env)
load_dotenv('.env.local')
load_dotenv('.env')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit('Missing SUPABASE env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')

# Edit this list
URLS = [
    'https://tarantulahawk.cloud/blog',
    'https://tarantulahawk.cloud/',
    'https://tarantulahawk.cloud/sistema-prevencion-lavado-dinero-lfpiopri'
]

# local embedding model (small & fast)
EMBED_MODEL = os.getenv('LOCAL_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
model = SentenceTransformer(EMBED_MODEL)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_page_text(url):
    print('Fetching', url)
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    html = r.text
    # naive extraction: try main/article then body
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        main = soup.find('main') or soup.find('article')
        text = main.get_text(separator=' ') if main else soup.get_text(separator=' ')
    except Exception:
        # fallback: strip tags crudely
        import re
        text = re.sub('<[^<]+?>', ' ', html)
    return ' '.join(text.split())


def chunk_text(text, max_chars=800, overlap=200):
    chunks = []
    i = 0
    while i < len(text):
        end = min(i + max_chars, len(text))
        chunk = text[i:end]
        last_period = chunk.rfind('.')
        if last_period > max(100, int(0.5 * len(chunk))) and end < len(text):
            chunk = text[i:i + last_period + 1]
        chunks.append(chunk.strip())
        i += max_chars - overlap
    return [c for c in chunks if c]


def upsert_document_and_embedding(url, chunk):
    # insert document
    meta = {'indexed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ')}
    title = urlparse(url).path.strip('/') or url
    try:
        resp = supabase.table('documents').insert([{ 'source': 'site', 'source_id': url, 'title': title, 'content': chunk, 'url': url, 'metadata': meta }]).execute()
    except Exception as e:
        print('Document insert error', e)
        return False
    if not resp or not resp.data:
        print('Document insert error (no data returned)')
        return False
    doc_id = resp.data[0].get('id') if isinstance(resp.data, list) else resp.data.get('id')
    if not doc_id:
        print('Document insert error (missing id)')
        return False
    # embedding
    emb = model.encode(chunk)
    emb_list = [float(x) for x in emb]
    try:
        e_resp = supabase.table('embeddings').insert([{ 'document_id': doc_id, 'embedding': emb_list }]).execute()
    except Exception as e:
        print('Embedding insert error', e)
        return False
    if not e_resp or e_resp.data is None:
        print('Embedding insert warning: no data returned')
    return True


def print_counts():
    for table in ['documents', 'embeddings']:
        try:
            resp = supabase.table(table).select('id', count='exact').limit(1).execute()
            count = getattr(resp, 'count', None)
            # Fallback: count data length if no count provided
            if count is None and isinstance(resp.data, list):
                count = len(resp.data)
            print(f'{table} count:', count if count is not None else 'unknown')
        except Exception as e:
            print(f'{table} count error', e)


def main():
    for url in URLS:
        try:
            text = fetch_page_text(url)
            chunks = chunk_text(text)
            print(f'Found {len(chunks)} chunks for', url)
            for c in chunks:
                ok = upsert_document_and_embedding(url, c)
                if ok:
                    print('Indexed chunk')
                time.sleep(0.15)
        except Exception as e:
            print('Failed', url, e)
    print_counts()
    print('Done')

if __name__ == '__main__':
    main()
