create table if not exists public."TBL_MOVIMENTACOES" (
  id bigserial primary key,
  origem_tabela text,
  origem_id bigint,
  tipo_entidade text not null check (tipo_entidade in ('veiculo', 'pedestre')),
  tipo_veiculo text,
  placa text,
  modelo_externo text,
  motorista text,
  km numeric,
  localizacao text,
  destino text,
  nome text,
  cpf_rg text,
  telefone text,
  empresa text,
  status text not null,
  liberado_por text,
  liberado_em timestamptz,
  saida_em timestamptz,
  entrada_em timestamptz,
  gestor_responsavel_id uuid,
  gestor_responsavel_nome text,
  gestor_responsavel_email text,
  gestor_responsavel_setor text,
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (origem_tabela, origem_id)
);

create index if not exists idx_tbl_movimentacoes_tipo_status
  on public."TBL_MOVIMENTACOES" (tipo_entidade, status);

create index if not exists idx_tbl_movimentacoes_placa
  on public."TBL_MOVIMENTACOES" (placa);

create index if not exists idx_tbl_movimentacoes_liberado_em
  on public."TBL_MOVIMENTACOES" (liberado_em desc);

create or replace function public.set_tbl_movimentacoes_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tbl_movimentacoes_atualizado_em on public."TBL_MOVIMENTACOES";
create trigger trg_tbl_movimentacoes_atualizado_em
before update on public."TBL_MOVIMENTACOES"
for each row execute function public.set_tbl_movimentacoes_atualizado_em();

alter table public."TBL_MOVIMENTACOES" enable row level security;

drop policy if exists "TBL_MOVIMENTACOES_select_public" on public."TBL_MOVIMENTACOES";
create policy "TBL_MOVIMENTACOES_select_public"
on public."TBL_MOVIMENTACOES"
for select
to anon, authenticated
using (true);

insert into public."TBL_MOVIMENTACOES" (
  origem_tabela,
  origem_id,
  tipo_entidade,
  tipo_veiculo,
  placa,
  modelo_externo,
  motorista,
  km,
  localizacao,
  destino,
  status,
  liberado_por,
  liberado_em,
  saida_em,
  entrada_em,
  gestor_responsavel_id,
  gestor_responsavel_nome,
  gestor_responsavel_email,
  gestor_responsavel_setor,
  observacao,
  ativo
)
select
  'movimentacoes',
  id,
  'veiculo',
  tipo_veiculo,
  placa,
  modelo_externo,
  motorista,
  km,
  localizacao,
  destino,
  status,
  liberado_por,
  liberado_em,
  saida_em,
  entrada_em,
  gestor_responsavel_id,
  gestor_responsavel_nome,
  gestor_responsavel_email,
  gestor_responsavel_setor,
  observacao,
  true
from public.movimentacoes
on conflict (origem_tabela, origem_id) do update set
  tipo_veiculo = excluded.tipo_veiculo,
  placa = excluded.placa,
  modelo_externo = excluded.modelo_externo,
  motorista = excluded.motorista,
  km = excluded.km,
  localizacao = excluded.localizacao,
  destino = excluded.destino,
  status = excluded.status,
  liberado_por = excluded.liberado_por,
  liberado_em = excluded.liberado_em,
  saida_em = excluded.saida_em,
  entrada_em = excluded.entrada_em,
  gestor_responsavel_id = excluded.gestor_responsavel_id,
  gestor_responsavel_nome = excluded.gestor_responsavel_nome,
  gestor_responsavel_email = excluded.gestor_responsavel_email,
  gestor_responsavel_setor = excluded.gestor_responsavel_setor,
  observacao = excluded.observacao,
  ativo = excluded.ativo;

insert into public."TBL_MOVIMENTACOES" (
  origem_tabela,
  origem_id,
  tipo_entidade,
  nome,
  cpf_rg,
  telefone,
  empresa,
  destino,
  observacao,
  status,
  liberado_por,
  liberado_em,
  saida_em,
  entrada_em,
  ativo
)
select
  'movimentacoes_pedestres',
  id,
  'pedestre',
  nome,
  cpf_rg,
  telefone,
  empresa,
  destino,
  observacao,
  status,
  liberado_por,
  liberado_em,
  saida_em,
  entrada_em,
  true
from public.movimentacoes_pedestres
on conflict (origem_tabela, origem_id) do update set
  nome = excluded.nome,
  cpf_rg = excluded.cpf_rg,
  telefone = excluded.telefone,
  empresa = excluded.empresa,
  destino = excluded.destino,
  observacao = excluded.observacao,
  status = excluded.status,
  liberado_por = excluded.liberado_por,
  liberado_em = excluded.liberado_em,
  saida_em = excluded.saida_em,
  entrada_em = excluded.entrada_em,
  ativo = excluded.ativo;
