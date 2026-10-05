create table if not exists public.feedbacks (
  id bigserial primary key,
  tipo text not null check (tipo in ('bug', 'ideia', 'outro')),
  mensagem text not null,
  pagina text,
  usuario_id text,
  usuario_nome text,
  usuario_email text,
  anexo_path text,
  anexo_nome text,
  anexo_tipo text,
  anexo_tamanho bigint,
  status text not null default 'novo' check (status in ('novo', 'em_analise', 'resolvido', 'arquivado')),
  criado_em timestamptz not null default now()
);

alter table public.feedbacks enable row level security;

drop policy if exists "feedbacks_select_dev" on public.feedbacks;
create policy "feedbacks_select_dev"
on public.feedbacks
for select
using (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-anexos',
  'feedback-anexos',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
