alter table public.movimentacoes_transferencias_acoes
drop constraint if exists movimentacoes_transferencias_acoes_acao_check;

update public.movimentacoes_transferencias_acoes
set acao = 'liberacao'
where acao = 'transferencia';

alter table public.movimentacoes_transferencias_acoes
add constraint movimentacoes_transferencias_acoes_acao_check
check (acao in ('liberacao', 'confirmacao', 'correcao'));
