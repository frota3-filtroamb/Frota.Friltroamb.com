create table if not exists public.movimentacoes_pedestres_acoes (
  id bigserial primary key,
  movimentacao_pedestre_id bigint references public.movimentacoes_pedestres(id) on delete set null,
  acao text not null check (acao in ('liberacao', 'entrada', 'saida', 'correcao')),
  data_acao timestamptz not null default now(),
  nome text,
  cpf_rg text,
  telefone text,
  empresa text,
  destino text,
  status_movimentacao text,
  responsavel_nome text,
  responsavel_email text,
  responsavel_id text,
  corrige_acao_id bigint references public.movimentacoes_pedestres_acoes(id) on delete set null,
  corrigido_por_id text,
  corrigido_por_nome text,
  corrigido_por_email text,
  corrigido_em timestamptz,
  motivo_correcao text,
  created_at timestamptz not null default now()
);

create index if not exists movimentacoes_pedestres_acoes_movimentacao_idx
  on public.movimentacoes_pedestres_acoes (movimentacao_pedestre_id);

create index if not exists movimentacoes_pedestres_acoes_data_idx
  on public.movimentacoes_pedestres_acoes (data_acao desc);

create index if not exists movimentacoes_pedestres_acoes_nome_idx
  on public.movimentacoes_pedestres_acoes (nome);

create index if not exists movimentacoes_pedestres_acoes_corrige_idx
  on public.movimentacoes_pedestres_acoes (corrige_acao_id);

alter table public.movimentacoes_pedestres_acoes enable row level security;

drop policy if exists "movimentacoes_pedestres_acoes_select"
  on public.movimentacoes_pedestres_acoes;

create policy "movimentacoes_pedestres_acoes_select"
  on public.movimentacoes_pedestres_acoes
  for select
  using (true);

drop policy if exists "movimentacoes_pedestres_acoes_insert"
  on public.movimentacoes_pedestres_acoes;

create policy "movimentacoes_pedestres_acoes_insert"
  on public.movimentacoes_pedestres_acoes
  for insert
  with check (true);

insert into public.movimentacoes_pedestres_acoes (
  movimentacao_pedestre_id,
  acao,
  data_acao,
  nome,
  cpf_rg,
  telefone,
  empresa,
  destino,
  status_movimentacao,
  responsavel_nome
)
select
  p.id,
  'liberacao',
  coalesce(p.liberado_em, now()),
  p.nome,
  p.cpf_rg,
  p.telefone,
  p.empresa,
  p.destino,
  p.status,
  p.liberado_por
from public.movimentacoes_pedestres p
where not exists (
  select 1
  from public.movimentacoes_pedestres_acoes a
  where a.movimentacao_pedestre_id = p.id
    and a.acao = 'liberacao'
);

insert into public.movimentacoes_pedestres_acoes (
  movimentacao_pedestre_id,
  acao,
  data_acao,
  nome,
  cpf_rg,
  telefone,
  empresa,
  destino,
  status_movimentacao,
  responsavel_nome
)
select
  p.id,
  'entrada',
  p.entrada_em,
  p.nome,
  p.cpf_rg,
  p.telefone,
  p.empresa,
  p.destino,
  case when p.status = 'aguardando_entrada' then 'em_visita' else p.status end,
  p.liberado_por
from public.movimentacoes_pedestres p
where p.entrada_em is not null
  and not exists (
    select 1
    from public.movimentacoes_pedestres_acoes a
    where a.movimentacao_pedestre_id = p.id
      and a.acao = 'entrada'
  );

insert into public.movimentacoes_pedestres_acoes (
  movimentacao_pedestre_id,
  acao,
  data_acao,
  nome,
  cpf_rg,
  telefone,
  empresa,
  destino,
  status_movimentacao,
  responsavel_nome
)
select
  p.id,
  'saida',
  p.saida_em,
  p.nome,
  p.cpf_rg,
  p.telefone,
  p.empresa,
  p.destino,
  'finalizado',
  p.liberado_por
from public.movimentacoes_pedestres p
where p.saida_em is not null
  and not exists (
    select 1
    from public.movimentacoes_pedestres_acoes a
    where a.movimentacao_pedestre_id = p.id
      and a.acao = 'saida'
  );
