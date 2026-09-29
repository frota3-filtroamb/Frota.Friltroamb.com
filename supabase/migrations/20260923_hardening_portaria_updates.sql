drop policy if exists "movimentacoes_update"
  on public.movimentacoes;

drop policy if exists "movimentacoes_update_public"
  on public.movimentacoes;

drop policy if exists "Permitir update movimentacoes"
  on public.movimentacoes;

drop policy if exists "Enable update for authenticated users only"
  on public.movimentacoes;

drop policy if exists "Enable update access for all users"
  on public.movimentacoes;

drop policy if exists "movimentacoes_pedestres_update"
  on public.movimentacoes_pedestres;

drop policy if exists "movimentacoes_pedestres_update_public"
  on public.movimentacoes_pedestres;

drop policy if exists "Permitir update movimentacoes_pedestres"
  on public.movimentacoes_pedestres;

drop policy if exists "Enable update for authenticated users only"
  on public.movimentacoes_pedestres;

drop policy if exists "Enable update access for all users"
  on public.movimentacoes_pedestres;

drop policy if exists "transferencias_update"
  on public.transferencias;

drop policy if exists "transferencias_update_public"
  on public.transferencias;

drop policy if exists "Permitir update transferencias"
  on public.transferencias;

drop policy if exists "Enable update for authenticated users only"
  on public.transferencias;

drop policy if exists "Enable update access for all users"
  on public.transferencias;
