drop policy if exists "movimentacoes_pedestres_acoes_insert"
  on public.movimentacoes_pedestres_acoes;

drop policy if exists "movimentacoes_pedestres_acoes_insert_public"
  on public.movimentacoes_pedestres_acoes;

drop policy if exists "Permitir insert movimentacoes_pedestres_acoes"
  on public.movimentacoes_pedestres_acoes;

drop policy if exists "Enable insert for authenticated users only"
  on public.movimentacoes_pedestres_acoes;

drop policy if exists "Enable insert access for all users"
  on public.movimentacoes_pedestres_acoes;
