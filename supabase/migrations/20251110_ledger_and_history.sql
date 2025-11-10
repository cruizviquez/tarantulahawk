-- Migration: Create credit_ledger and analysis_history with RLS, policies and indexes
-- Safe to run multiple times (IF NOT EXISTS used where possible)

-- Requirements
create extension if not exists pgcrypto;

-- ===============================
-- Table: public.credit_ledger
-- ===============================
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(10,2) not null,
  transaction_type text not null,
  description text,
  balance_after numeric(10,2) not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

-- Policy: users can view own transactions
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'credit_ledger' and policyname = 'Users can view own transactions'
  ) then
    create policy "Users can view own transactions"
      on public.credit_ledger for select
      using (auth.uid() = user_id);
  end if;
end$$;

-- Policy: service role can insert (service role bypasses RLS, but keep for clarity)
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'credit_ledger' and policyname = 'Service role can insert'
  ) then
    create policy "Service role can insert"
      on public.credit_ledger for insert
      with check (true);
  end if;
end$$;

create index if not exists credit_ledger_user_id_idx on public.credit_ledger(user_id);
create index if not exists credit_ledger_created_at_idx on public.credit_ledger(created_at desc);

comment on table public.credit_ledger is 'Ledger de créditos/cargos por usuario';
comment on column public.credit_ledger.metadata is 'Información adicional (num_transactions, cost_per_transaction, etc.)';


-- ==================================
-- Table: public.analysis_history
-- ==================================
create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  analysis_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  total_transacciones integer not null,
  costo numeric(10,2) not null,
  pagado boolean not null default true,

  original_file_path text not null,
  processed_file_path text not null,
  json_results_path text not null,
  xml_path text,

  resumen jsonb not null,
  estrategia text,
  balance_after numeric(10,2),

  created_at timestamptz not null default now()
);

alter table public.analysis_history enable row level security;

-- Policy: users can view own history
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'analysis_history' and policyname = 'Users can view own history'
  ) then
    create policy "Users can view own history"
      on public.analysis_history for select
      using (auth.uid() = user_id);
  end if;
end$$;

-- Policy: users can insert own history
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'analysis_history' and policyname = 'Users can insert own history'
  ) then
    create policy "Users can insert own history"
      on public.analysis_history for insert
      with check (auth.uid() = user_id);
  end if;
end$$;

create index if not exists analysis_history_user_id_idx on public.analysis_history(user_id);
create index if not exists analysis_history_created_at_idx on public.analysis_history(created_at desc);
create index if not exists analysis_history_analysis_id_idx on public.analysis_history(analysis_id);

comment on table public.analysis_history is 'Historial de análisis AML con rutas a archivos y resumen';
comment on column public.analysis_history.original_file_path is 'Path relativo al CSV original subido';
comment on column public.analysis_history.processed_file_path is 'Path relativo al CSV procesado con predicciones';
comment on column public.analysis_history.json_results_path is 'Path relativo al JSON con resultados detallados';
