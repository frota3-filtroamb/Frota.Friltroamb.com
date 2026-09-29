create table if not exists public.movimentacoes_transferencias_acoes (
  id bigserial primary key,
  transferencia_id bigint references public.transferencias(id) on delete set null,
  acao text not null check (acao in ('transferencia', 'correcao')),
  data_acao timestamptz not null default now(),
  placa text,
  base_origem text,
  base_destino text,
  motorista text,
  observacao text,
  status_transferencia text,
  responsavel_nome text,
  responsavel_email text,
  responsavel_id text,
  corrige_acao_id bigint references public.movimentacoes_transferencias_acoes(id) on delete set null,
  corrigido_por_id text,
  corrigido_por_nome text,
  corrigido_por_email text,
  corrigido_em timestamptz,
  motivo_correcao text,
  created_at timestamptz not null default now()
);

create index if not exists movimentacoes_transferencias_acoes_transferencia_idx
  on public.movimentacoes_transferencias_acoes (transferencia_id);

create index if not exists movimentacoes_transferencias_acoes_data_idx
  on public.movimentacoes_transferencias_acoes (data_acao desc);

create index if not exists movimentacoes_transferencias_acoes_placa_idx
  on public.movimentacoes_transferencias_acoes (placa);

create index if not exists movimentacoes_transferencias_acoes_corrige_idx
  on public.movimentacoes_transferencias_acoes (corrige_acao_id);

alter table public.movimentacoes_transferencias_acoes enable row level security;

drop policy if exists "movimentacoes_transferencias_acoes_select"
  on public.movimentacoes_transferencias_acoes;

create policy "movimentacoes_transferencias_acoes_select"
  on public.movimentacoes_transferencias_acoes
  for select
  using (true);

drop policy if exists "movimentacoes_transferencias_acoes_insert"
  on public.movimentacoes_transferencias_acoes;

create policy "movimentacoes_transferencias_acoes_insert"
  on public.movimentacoes_transferencias_acoes
  for insert
  with check (true);

insert into public.movimentacoes_transferencias_acoes (
  transferencia_id,
  acao,
  data_acao,
  placa,
  base_origem,
  base_destino,
  motorista,
  observacao,
  status_transferencia,
  responsavel_nome
)
select
  t.id,
  'transferencia',
  coalesce(t.transferido_em, now()),
  t.placa,
  t.base_origem,
  t.base_destino,
  t.motorista,
  t.observacao,
  t.status,
  t.transferido_por
from public.transferencias t
where not exists (
  select 1
  from public.movimentacoes_transferencias_acoes a
  where a.transferencia_id = t.id
    and a.acao = 'transferencia'
);
