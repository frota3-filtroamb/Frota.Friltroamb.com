alter table public.encomendas
  add column if not exists retirado_por text;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'encomendas'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.encomendas drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.encomendas
  add constraint encomendas_status_check
  check (status in ('prevista', 'aguardando_retirada', 'entregue'));

create index if not exists encomendas_status_idx
  on public.encomendas (status);

create index if not exists encomendas_retirado_por_idx
  on public.encomendas (retirado_por);
