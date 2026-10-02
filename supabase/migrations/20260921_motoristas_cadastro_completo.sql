alter table public.motoristas
  add column if not exists cpf text,
  add column if not exists telefone text,
  add column if not exists funcao text,
  add column if not exists tipo text,
  add column if not exists status text default 'ativo',
  add column if not exists ativo boolean default true,
  add column if not exists foto_url text,
  add column if not exists cnh_numero text,
  add column if not exists cnh_categoria text,
  add column if not exists cnh_vencimento date,
  add column if not exists app_habilitado boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz;

update public.motoristas
set
  status = coalesce(status, 'ativo'),
  ativo = coalesce(ativo, true),
  funcao = coalesce(funcao, tipo, 'Motorista'),
  tipo = coalesce(tipo, funcao, 'Motorista'),
  app_habilitado = coalesce(app_habilitado, false)
where
  status is null
  or ativo is null
  or funcao is null
  or tipo is null
  or app_habilitado is null;

create index if not exists motoristas_nome_idx on public.motoristas (nome);
create index if not exists motoristas_cpf_idx on public.motoristas (cpf);
create index if not exists motoristas_cnh_numero_idx on public.motoristas (cnh_numero);

-- Rode estes comandos somente depois de corrigir cadastros antigos sem nome/CPF.
-- Eles fazem o banco tambem bloquear cadastros incompletos.
-- alter table public.motoristas
--   alter column nome set not null,
--   alter column cpf set not null;
--
-- create unique index if not exists motoristas_cpf_unique_idx
--   on public.motoristas (cpf)
--   where cpf is not null;
