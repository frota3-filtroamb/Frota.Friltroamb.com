alter table public.destinos
add column if not exists tipo_destino text,
add column if not exists endereco text;
