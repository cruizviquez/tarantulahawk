-- Supabase migration: Create tables for chat + RAG
-- Run this in Supabase SQL editor. Review and adjust embedding dimension to match your model.

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversations: stores basic chat logs
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  user_text text,
  bot_text text,
  language text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Leads: captures potential lead details
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  company_name text,
  email text,
  monthly_volume text,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);

-- Documents: chunks of page content used for retrieval
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text,
  source_id text,
  title text,
  content text,
  url text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Embeddings: vector storage (adjust dimension to your embedding model)
-- Example uses dimension 384 (all-MiniLM-L6-v2). Change if you use a different model.
CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  embedding vector(384),
  created_at timestamptz DEFAULT now()
);

-- Index for fast nearest-neighbor search. Tune `lists` based on dataset size.
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON embeddings USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

COMMIT;

-- Notes:
-- - If your Supabase project does not have the `vector` extension available, ask Supabase support
--   or change `embedding vector(384)` to `embedding float8[]` and adapt the query for nearest neighbours.
-- - Ensure the embedding dimension matches the model you will use (set RAG_EMBED_DIM accordingly).
