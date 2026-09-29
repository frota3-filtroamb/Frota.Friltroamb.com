drop policy if exists "movimentacoes_insert"
  on public.movimentacoes;

drop policy if exists "movimentacoes_insert_public"
  on public.movimentacoes;

drop policy if exists "Permitir insert movimentacoes"
  on public.movimentacoes;

drop policy if exists "Enable insert for authenticated users only"
  on public.movimentacoes;

drop policy if exists "Enable insert access for all users"
  on public.movimentacoes;

drop policy if exists "movimentacoes_pedestres_insert"
  on public.movimentacoes_pedestres;

drop policy if exists "movimentacoes_pedestres_insert_public"
  on public.movimentacoes_pedestres;

drop policy if exists "Permitir insert movimentacoes_pedestres"
  on public.movimentacoes_pedestres;

drop policy if exists "Enable insert for authenticated users only"
  on public.movimentacoes_pedestres;

drop policy if exists "Enable insert access for all users"
  on public.movimentacoes_pedestres;

drop policy if exists "transferencias_insert"
  on public.transferencias;

drop policy if exists "transferencias_insert_public"
  on public.transferencias;

drop policy if exists "Permitir insert transferencias"
  on public.transferencias;

drop policy if exists "Enable insert for authenticated users only"
  on public.transferencias;

drop policy if exists "Enable insert access for all users"
  on public.transferencias;
