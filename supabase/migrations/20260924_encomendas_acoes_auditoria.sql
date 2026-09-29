create table if not exists public.encomendas_acoes (
  id bigserial primary key,
  encomenda_id bigint not null references public.encomendas(id) on delete cascade,
  acao text not null check (acao in ('aviso', 'chegada_sem_aviso', 'confirmacao_chegada', 'retirada')),
  data_acao timestamptz not null default now(),
  item text,
  loja_remetente text,
  destinatario text,
  status_encomenda text,
  recebido_em timestamptz,
  entregue_em timestamptz,
  retirado_por text,
  observacao text,
  responsavel_id text,
  responsavel_nome text,
  responsavel_email text,
  created_at timestamptz not null default now()
);

create index if not exists encomendas_acoes_encomenda_idx
  on public.encomendas_acoes (encomenda_id);

create index if not exists encomendas_acoes_data_idx
  on public.encomendas_acoes (data_acao desc);

create index if not exists encomendas_acoes_acao_idx
  on public.encomendas_acoes (acao);

alter table public.encomendas_acoes enable row level security;

drop policy if exists "encomendas_acoes_select"
  on public.encomendas_acoes;

create policy "encomendas_acoes_select"
  on public.encomendas_acoes
  for select
  using (true);

drop policy if exists "encomendas_acoes_insert"
  on public.encomendas_acoes;

create policy "encomendas_acoes_insert"
  on public.encomendas_acoes
  for insert
  with check (true);
