export type Role = 'dev' | 'gestor' | 'editor' | 'porteiro' | 'basico'

export type Permissao =
  | 'veiculos'
  | 'portaria'
  | 'portaria.veiculos'
  | 'portaria.pedestres'
  | 'portaria.transferencia'
  | 'liberacao'
  | 'liberacao.veiculo_empresa'
  | 'liberacao.veiculo_externo'
  | 'liberacao.pedestre'
  | 'liberacao.transferencia'
  | 'liberacao.veiculo_interno'
  | 'transferencia'
  | 'encomendas'
  | 'almoxarifado'
  | 'cadastros'
  | 'cadastros.pessoas'
  | 'cadastros.destinos'

export const PERMISSOES: Permissao[] = [
  'veiculos',
  'portaria',
  'portaria.veiculos',
  'portaria.pedestres',
  'portaria.transferencia',
  'liberacao',
  'liberacao.veiculo_empresa',
  'liberacao.veiculo_externo',
  'liberacao.pedestre',
  'liberacao.transferencia',
  'liberacao.veiculo_interno',
  'transferencia',
  'encomendas',
  'almoxarifado',
  'cadastros',
  'cadastros.pessoas',
  'cadastros.destinos',
]

const PERMISSOES_DETALHADAS: Partial<Record<Permissao, Permissao[]>> = {
  portaria: ['portaria.veiculos', 'portaria.pedestres', 'portaria.transferencia'],
  liberacao: [
    'liberacao.veiculo_empresa',
    'liberacao.veiculo_externo',
    'liberacao.pedestre',
    'liberacao.transferencia',
    'liberacao.veiculo_interno',
  ],
  cadastros: ['cadastros.pessoas', 'cadastros.destinos'],
}

const PERMISSOES_GESTOR: Permissao[] = [
  'veiculos',
  'portaria',
  'portaria.veiculos',
  'portaria.pedestres',
  'portaria.transferencia',
  'liberacao',
  'liberacao.veiculo_empresa',
  'liberacao.veiculo_externo',
  'liberacao.pedestre',
  'liberacao.transferencia',
  'liberacao.veiculo_interno',
  'transferencia',
  'encomendas',
  'almoxarifado',
  'cadastros',
  'cadastros.pessoas',
  'cadastros.destinos',
]

const PERMISSOES_DEV: Permissao[] = PERMISSOES_GESTOR
const PERMISSOES_PORTEIRO: Permissao[] = ['portaria']
const PERMISSOES_BASICO: Permissao[] = ['veiculos']

export function getRole(
  user: { publicMetadata?: Record<string, unknown> } | null | undefined
): Role {
  const role = user?.publicMetadata?.role
  if (role === 'dev') return 'dev'
  if (role === 'gestor') return 'gestor'
  if (role === 'editor') return 'editor'
  if (role === 'porteiro') return 'porteiro'
  if (role === 'basico') return 'basico'
  return 'basico'
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
  if (role === 'gestor') return PERMISSOES_GESTOR
  if (role === 'editor') return PERMISSOES_GESTOR
  if (role === 'porteiro') return PERMISSOES_PORTEIRO
  return PERMISSOES_BASICO
}

export function podeAcessar(
  user: { publicMetadata?: Record<string, unknown> } | null | undefined,
  permissao: Permissao
): boolean {
  return getPermissoes(user).includes(permissao)
}

export function podeAcessarDetalhe(
  user: { publicMetadata?: Record<string, unknown> } | null | undefined,
  permissaoPai: Permissao,
  permissaoDetalhe: Permissao
): boolean {
  const permissoes = getPermissoes(user)
  if (!permissoes.includes(permissaoPai)) return false

  const detalhes = PERMISSOES_DETALHADAS[permissaoPai] || []
  const temAlgumDetalheConfigurado = detalhes.some((item) => permissoes.includes(item))

  if (!temAlgumDetalheConfigurado) return true
  return permissoes.includes(permissaoDetalhe)
}
