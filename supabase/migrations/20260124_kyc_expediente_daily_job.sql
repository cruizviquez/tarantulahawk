-- Supabase migration: KYC expediente, EBR policies, daily job support
-- Date: 2026-01-24

begin;

-- Ensure gen_random_uuid is available
create extension if not exists pgcrypto;

-- Enable trigram matching for fuzzy name searches
create extension if not exists pg_trgm;

-- Helper: update updated_at on changes
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Table: kyc_clientes
create table if not exists public.kyc_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  apellido_paterno text,
  apellido_materno text,
  rfc text,
  curp text,
  documento_url text,
  validaciones jsonb,
  clasificacion_ebr text default 'BAJO',
  score_riesgo integer default 0,
  decision_automatica text default 'APROBADO',
  estado text default 'aprobado',
  alerta_activa boolean default false,
  ultima_validacion timestamptz default now(),
  fecha_expiracion timestamptz default (now() + interval '10 years'),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger: auto-update updated_at
drop trigger if exists kyc_clientes_set_updated_at on public.kyc_clientes;
create trigger kyc_clientes_set_updated_at
before update on public.kyc_clientes
for each row execute procedure public.set_updated_at();

-- Indexes
create index if not exists idx_kyc_clientes_user on public.kyc_clientes(user_id);
create index if not exists idx_kyc_clientes_estado on public.kyc_clientes(estado);
create index if not exists idx_kyc_clientes_alerta on public.kyc_clientes(alerta_activa);
create index if not exists idx_kyc_clientes_rfc on public.kyc_clientes(rfc);
create index if not exists idx_kyc_clientes_curp on public.kyc_clientes(curp);
create index if not exists idx_kyc_clientes_ultima_validacion on public.kyc_clientes(ultima_validacion);

-- Trigram GIN indexes for fuzzy search on names
create index if not exists idx_kyc_clientes_nombre_trgm on public.kyc_clientes using gin (nombre gin_trgm_ops);
create index if not exists idx_kyc_clientes_apellido_paterno_trgm on public.kyc_clientes using gin (apellido_paterno gin_trgm_ops);
create index if not exists idx_kyc_clientes_apellido_materno_trgm on public.kyc_clientes using gin (apellido_materno gin_trgm_ops);

-- Row Level Security
alter table public.kyc_clientes enable row level security;

-- Policies: allow user to read/write own records
drop policy if exists "read own kyc" on public.kyc_clientes;
create policy "read own kyc" on public.kyc_clientes
for select using (user_id = auth.uid());

drop policy if exists "insert own kyc" on public.kyc_clientes;
create policy "insert own kyc" on public.kyc_clientes
for insert with check (user_id = auth.uid());

drop policy if exists "update own kyc" on public.kyc_clientes;
create policy "update own kyc" on public.kyc_clientes
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Optional: restrict delete to service role only (no client deletes)
-- (Service role bypasses RLS, so no extra policy is needed)

commit;

-- =============================================
-- Storage bucket and RLS policies (manual setup via dashboard)
-- Create a private bucket named "kyc-documentos" in Supabase Storage
-- Dashboard: Storage → New bucket → Name: kyc-documentos → Public: OFF
-- 
-- Then add these RLS policies via Dashboard → Storage → kyc-documentos → Policies:
-- 1. Read own documents: bucket_id = 'kyc-documentos' AND name LIKE (auth.uid()::text || '/%')
-- 2. Upload own documents: bucket_id = 'kyc-documentos' AND name LIKE (auth.uid()::text || '/%')
-- 3. Update own documents: bucket_id = 'kyc-documentos' AND name LIKE (auth.uid()::text || '/%')
-- 4. Delete own documents: bucket_id = 'kyc-documentos' AND name LIKE (auth.uid()::text || '/%')
-- =============================================