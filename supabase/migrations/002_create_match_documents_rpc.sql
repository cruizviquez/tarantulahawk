-- Supabase migration: RPC for vector similarity search
-- Run this in Supabase SQL editor after the base tables exist.
-- Adjust the dimension (vector(384)) if you use a different embedding model.

begin;

create or replace function match_documents(
  query_embedding vector(384),
  match_count int default 5
)
returns table (
  document_id uuid,
  title text,
  content text,
  url text,
  similarity double precision
)
language plpgsql
as $$
begin
  return query
  select
    d.id as document_id,
    d.title,
    d.content,
    d.url,
    1 / (1 + (e.embedding <-> query_embedding)) as similarity
  from embeddings e
  join documents d on d.id = e.document_id
  order by e.embedding <-> query_embedding
  limit match_count;
end;
$$;

commit;
