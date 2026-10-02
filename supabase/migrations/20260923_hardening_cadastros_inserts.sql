drop policy if exists "motoristas_insert"
  on public.motoristas;

drop policy if exists "motoristas_insert_public"
  on public.motoristas;

drop policy if exists "Permitir insert motoristas"
  on public.motoristas;

drop policy if exists "Enable insert for authenticated users only"
  on public.motoristas;

drop policy if exists "Enable insert access for all users"
  on public.motoristas;

drop policy if exists "destinos_insert"
  on public.destinos;

drop policy if exists "destinos_insert_public"
  on public.destinos;

drop policy if exists "Permitir insert destinos"
  on public.destinos;

drop policy if exists "Enable insert for authenticated users only"
  on public.destinos;

drop policy if exists "Enable insert access for all users"
  on public.destinos;
