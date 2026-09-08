export type Role = 'dev' | 'gestor' | 'porteiro'

export type Permissao =
  | 'veiculos'
  | 'portaria'
  | 'liberacao'
  | 'transferencia'
  | 'encomendas'

const PERMISSOES_GESTOR: Permissao[] = [
  'veiculos',
  'portaria',
  'liberacao',
  'transferencia',
  'encomendas',
]

const PERMISSOES_DEV: Permissao[] = PERMISSOES_GESTOR
const PERMISSOES_PORTEIRO: Permissao[] = ['portaria']

export function getRole(
  user: { publicMetadata?: Record<string, unknown> } | null | undefined
): Role {
  const role = user?.publicMetadata?.role
  if (role === 'dev') return 'dev'
  if (role === 'porteiro') return 'porteiro'
  return 'gestor'
}

export function getPermissoes(
  user: { publicMetadata?: Record<string, unknown> } | null | undefined
): Permissao[] {
  const custom = user?.publicMetadata?.permissoes

  if (Array.isArray(custom) && custom.length > 0) {
    return custom as Permissao[]
  }

  const role = getRole(user)
  if (role === 'dev') return PERMISSOES_DEV
  return role === 'porteiro' ? PERMISSOES_PORTEIRO : PERMISSOES_GESTOR
}

export function podeAcessar(
  user: { publicMetadata?: Record<string, unknown> } | null | undefined,
  permissao: Permissao
): boolean {
  return getPermissoes(user).includes(permissao)
}
