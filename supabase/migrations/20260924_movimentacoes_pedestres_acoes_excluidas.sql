create table if not exists public.movimentacoes_pedestres_acoes_excluidas (
  id bigserial primary key,
  acao_original_id bigint not null,
  movimentacao_pedestre_id bigint,
  acao text,
  data_acao timestamptz,
  nome text,
  cpf_rg text,
  telefone text,
  empresa text,
  destino text,
  status_movimentacao text,
  responsavel_nome text,
  responsavel_email text,
  responsavel_id text,
  registro_original jsonb not null,
  registro_vigente jsonb not null,
  historico jsonb not null default '[]'::jsonb,
  motivo_exclusao text not null,
  excluido_por_id text,
  excluido_por_nome text,
  excluido_por_email text,
  excluido_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists movimentacoes_pedestres_acoes_excluidas_acao_original_idx
  on public.movimentacoes_pedestres_acoes_excluidas (acao_original_id);

create index if not exists movimentacoes_pedestres_acoes_excluidas_data_idx
  on public.movimentacoes_pedestres_acoes_excluidas (excluido_em desc);

create index if not exists movimentacoes_pedestres_acoes_excluidas_nome_idx
  on public.movimentacoes_pedestres_acoes_excluidas (nome);

alter table public.movimentacoes_pedestres_acoes_excluidas enable row level security;

drop policy if exists "movimentacoes_pedestres_acoes_excluidas_select"
  on public.movimentacoes_pedestres_acoes_excluidas;

create policy "movimentacoes_pedestres_acoes_excluidas_select"
  on public.movimentacoes_pedestres_acoes_excluidas
  for select
  using (true);

drop policy if exists "movimentacoes_pedestres_acoes_excluidas_insert"
  on public.movimentacoes_pedestres_acoes_excluidas;

create policy "movimentacoes_pedestres_acoes_excluidas_insert"
  on public.movimentacoes_pedestres_acoes_excluidas
  for insert
  with check (true);

drop policy if exists "movimentacoes_pedestres_acoes_delete"
  on public.movimentacoes_pedestres_acoes;

create policy "movimentacoes_pedestres_acoes_delete"
  on public.movimentacoes_pedestres_acoes
  for delete
  using (true);
