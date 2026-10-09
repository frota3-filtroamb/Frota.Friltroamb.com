alter table public."TBL_MOVIMENTACOES"
  drop constraint if exists "TBL_MOVIMENTACOES_tipo_entidade_check";

alter table public."TBL_MOVIMENTACOES"
  add constraint "TBL_MOVIMENTACOES_tipo_entidade_check"
  check (tipo_entidade in ('veiculo', 'pedestre', 'transferencia'));

insert into public."TBL_MOVIMENTACOES" (
  origem_tabela,
  origem_id,
  tipo_entidade,
  placa,
  motorista,
  km,
  localizacao,
  destino,
  observacao,
  status,
  liberado_por,
  liberado_em,
  ativo
)
select
  'transferencias',
  id,
  'transferencia',
  placa,
  motorista,
  km,
  base_origem,
  base_destino,
  observacao,
  status,
  transferido_por,
  transferido_em,
  true
from public.transferencias
on conflict (origem_tabela, origem_id) do update set
  placa = excluded.placa,
  motorista = excluded.motorista,
  km = excluded.km,
  localizacao = excluded.localizacao,
  destino = excluded.destino,
  observacao = excluded.observacao,
  status = excluded.status,
  liberado_por = excluded.liberado_por,
  liberado_em = excluded.liberado_em,
  ativo = excluded.ativo;
