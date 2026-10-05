'use client'

import Sidebar from '@/components/Sidebar'
import { useTopbarSearch } from '@/components/TopbarSearchProvider'
import { useUser } from '@clerk/nextjs'
import { useEffect, useMemo, useState } from 'react'
import type { Permissao, Role } from '@/lib/roles'

type Usuario = {
  id: string
  nome: string
  email: string
  role: Role
  permissoes: Permissao[]
}

const ABAS: { id: Permissao; label: string; descricao: string; filhos?: { id: Permissao; label: string }[] }[] = [
  { id: 'veiculos', label: 'Veiculos', descricao: 'Consulta da frota cadastrada' },
  {
    id: 'portaria',
    label: 'Controle',
    descricao: 'Baixas e acompanhamento da portaria',
    filhos: [
      { id: 'portaria.veiculos', label: 'Veiculos' },
      { id: 'portaria.pedestres', label: 'Pedestres' },
      { id: 'portaria.transferencia', label: 'Transferencia' },
    ],
  },
  {
    id: 'liberacao',
    label: 'Liberacao',
    descricao: 'Criacao de liberacoes e autorizacoes',
    filhos: [
      { id: 'liberacao.veiculo_empresa', label: 'Veiculo Empresa' },
      { id: 'liberacao.veiculo_externo', label: 'Veiculo Externo' },
      { id: 'liberacao.pedestre', label: 'Pedestre' },
      { id: 'liberacao.transferencia', label: 'Transferencia' },
      { id: 'liberacao.veiculo_interno', label: 'Veiculo Interno' },
    ],
  },
  { id: 'transferencia', label: 'Transferencia', descricao: 'Consulta antiga de transferencias' },
  { id: 'encomendas', label: 'Encomendas', descricao: 'Controle de recebimento e retirada' },
  { id: 'almoxarifado', label: 'Almoxarifado', descricao: 'Estoque, compras e movimentacoes' },
  {
    id: 'cadastros',
    label: 'Cadastros',
    descricao: 'Pessoas, destinos e bases de apoio',
    filhos: [
      { id: 'cadastros.pessoas', label: 'Pessoas' },
      { id: 'cadastros.destinos', label: 'Destinos' },
    ],
  },
]

const ROLES: { id: Role; label: string; descricao: string }[] = [
  { id: 'dev', label: 'Dev', descricao: 'Acesso tecnico completo' },
  { id: 'gestor', label: 'Gestor', descricao: 'Gestao operacional completa' },
  { id: 'editor', label: 'Editor', descricao: 'Pode editar registros liberados' },
  { id: 'porteiro', label: 'Porteiro', descricao: 'Foco na portaria e baixas' },
  { id: 'basico', label: 'Basico', descricao: 'Consulta inicial do sistema' },
]

const ROLE_LABEL: Record<Role, string> = {
  dev: 'Dev',
  gestor: 'Gestor',
  editor: 'Editor',
  porteiro: 'Porteiro',
  basico: 'Basico',
}

function contarPermissoesVisiveis(usuario: Usuario) {
  return ABAS.reduce((total, aba) => {
    const principal = usuario.permissoes.includes(aba.id) ? 1 : 0
    const filhos = aba.filhos?.filter((filho) => usuario.permissoes.includes(filho.id)).length || 0
    return total + principal + filhos
  }, 0)
}

function iniciais(nome: string, email: string) {
  const texto = nome || email || 'Usuario'
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
}

export default function UsuariosPage() {
  const { user, isLoaded } = useUser()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const { busca, setBusca } = useTopbarSearch()
  const [filtroRole, setFiltroRole] = useState<'todos' | Role>('todos')
  const [carregando, setCarregando] = useState(true)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')

  const podeGerenciar = user?.publicMetadata?.role === 'dev'

  useEffect(() => {
    if (!isLoaded || !podeGerenciar) return

    async function carregarUsuarios() {
      setCarregando(true)
      setMensagem('')

      try {
        const resposta = await fetch('/api/usuarios')
        const dados = await resposta.json()

        if (!resposta.ok) throw new Error(dados.error || 'Erro ao carregar usuarios.')
        setUsuarios(dados.usuarios || [])
      } catch (error) {
        setMensagem(error instanceof Error ? error.message : 'Erro ao carregar usuarios.')
      } finally {
        setCarregando(false)
      }
    }

    carregarUsuarios()
  }, [isLoaded, podeGerenciar])

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return usuarios.filter((usuario) => {
      const bateBusca =
        !termo ||
        usuario.nome.toLowerCase().includes(termo) ||
        usuario.email.toLowerCase().includes(termo) ||
        usuario.id.toLowerCase().includes(termo)
      const bateRole = filtroRole === 'todos' || usuario.role === filtroRole
      return bateBusca && bateRole
    })
  }, [usuarios, busca, filtroRole])

  const resumo = useMemo(() => {
    const porRole = ROLES.reduce<Record<Role, number>>((acc, role) => {
      acc[role.id] = usuarios.filter((usuario) => usuario.role === role.id).length
      return acc
    }, { dev: 0, gestor: 0, editor: 0, porteiro: 0, basico: 0 })

    return {
      total: usuarios.length,
      exibidos: usuariosFiltrados.length,
      porRole,
      permissoes: usuarios.reduce((total, usuario) => total + contarPermissoesVisiveis(usuario), 0),
    }
  }, [usuarios, usuariosFiltrados.length])

  function alterarRole(usuarioId: string, role: Role) {
    setUsuarios((atuais) => atuais.map((usuario) => (usuario.id === usuarioId ? { ...usuario, role } : usuario)))
  }

  function alternarPermissao(usuarioId: string, permissao: Permissao) {
    setUsuarios((atuais) =>
      atuais.map((usuario) => {
        if (usuario.id !== usuarioId) return usuario
        const ativa = usuario.permissoes.includes(permissao)
        const aba = ABAS.find((item) => item.id === permissao)
        const filhos = aba?.filhos?.map((item) => item.id) || []

        if (filhos.length > 0) {
          const remover = [permissao, ...filhos]
          return {
            ...usuario,
            permissoes: ativa
              ? usuario.permissoes.filter((item) => !remover.includes(item))
              : Array.from(new Set([...usuario.permissoes, permissao, ...filhos])),
          }
        }

        return {
          ...usuario,
          permissoes: ativa ? usuario.permissoes.filter((item) => item !== permissao) : [...usuario.permissoes, permissao],
        }
      }),
    )
  }

  function alternarSubPermissao(usuarioId: string, permissaoPai: Permissao, permissao: Permissao) {
    setUsuarios((atuais) =>
      atuais.map((usuario) => {
        if (usuario.id !== usuarioId) return usuario
        const filhos = ABAS.find((aba) => aba.id === permissaoPai)?.filhos?.map((item) => item.id) || []
        const temDetalheConfigurado = filhos.some((item) => usuario.permissoes.includes(item))
        const permissoesBase =
          usuario.permissoes.includes(permissaoPai) && !temDetalheConfigurado
            ? Array.from(new Set([...usuario.permissoes, ...filhos]))
            : usuario.permissoes
        const ativa = permissoesBase.includes(permissao)
        const permissoes = ativa
          ? permissoesBase.filter((item) => item !== permissao)
          : Array.from(new Set([...permissoesBase, permissaoPai, permissao]))

        const temFilhoAtivo = filhos.some((item) => permissoes.includes(item))
        return { ...usuario, permissoes: temFilhoAtivo ? permissoes : permissoes.filter((item) => item !== permissaoPai) }
      }),
    )
  }

  async function salvar(usuario: Usuario) {
    setSalvandoId(usuario.id)
    setMensagem('')

    try {
      const resposta = await fetch(`/api/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: usuario.role,
          permissoes: usuario.permissoes,
        }),
      })
      const dados = await resposta.json()

      if (!resposta.ok) throw new Error(dados.error || 'Erro ao salvar usuario.')

      setUsuarios((atuais) => atuais.map((item) => (item.id === usuario.id ? dados.usuario : item)))
      setMensagem(`Permissoes de ${dados.usuario?.nome || usuario.nome} atualizadas.`)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Erro ao salvar usuario.')
    } finally {
      setSalvandoId(null)
    }
  }

  if (!isLoaded || carregando) {
    return (
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center text-slate-400">Carregando usuarios...</div>
      </div>
    )
  }

  if (!podeGerenciar) {
    return (
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center text-slate-400">Acesso negado.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#0a1625]">
      <Sidebar />

      <main className="app-scroll flex-1 min-h-screen overflow-y-auto bg-[#0a1625]">
        <section className="px-4 py-6 md:px-8 xl:px-14">
          <div className="mb-5 rounded-xl border border-emerald-500/20 bg-[#132337] p-1.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="px-4 py-2.5">
                <h1 className="text-base font-semibold text-white">Usuarios</h1>
                <p className="text-xs text-slate-500">{resumo.exibidos} de {resumo.total} usuarios</p>
              </div>

              <div className="hidden h-8 w-px bg-emerald-500/20 lg:block" />

              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, email ou id..."
                className="min-w-[240px] flex-1 rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />

              <select
                value={filtroRole}
                onChange={(e) => setFiltroRole(e.target.value as 'todos' | Role)}
                className="rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="todos">Todos os perfis</option>
                {ROLES.map((role) => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </select>
            </div>
          </div>

          {mensagem && (
            <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${mensagem.includes('Erro') || mensagem.includes('negado') ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
              {mensagem}
            </div>
          )}

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-500/15 bg-[#0f1c2e] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
              <p className="mt-2 text-2xl font-bold text-white">{resumo.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-[#0f1c2e] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Gestores</p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">{resumo.porRole.gestor}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-[#0f1c2e] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Portaria</p>
              <p className="mt-2 text-2xl font-bold text-sky-300">{resumo.porRole.porteiro}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-[#0f1c2e] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Permissoes</p>
              <p className="mt-2 text-2xl font-bold text-white">{resumo.permissoes}</p>
            </div>
          </div>

          {usuariosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0f1c2e] px-5 py-10 text-center">
              <h2 className="text-sm font-semibold text-white">Nenhum usuario encontrado</h2>
              <p className="mt-1 text-sm text-slate-500">Ajuste a busca ou o filtro de perfil para visualizar outros usuarios.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {usuariosFiltrados.map((usuario) => {
                const permissoesAtivas = contarPermissoesVisiveis(usuario)
                const roleAtual = ROLES.find((role) => role.id === usuario.role)

                return (
                  <section key={usuario.id} className="overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
                    <div className="flex flex-col gap-4 border-b border-white/5 bg-[#132337]/70 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-sm font-bold text-emerald-300">
                          {iniciais(usuario.nome, usuario.email)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-white md:text-base">{usuario.nome || 'Usuario sem nome'}</h2>
                            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                              {ROLE_LABEL[usuario.role]}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">{usuario.email || usuario.id}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Perfil
                          <select
                            value={usuario.role}
                            onChange={(event) => alterarRole(usuario.id, event.target.value as Role)}
                            className="min-w-32 rounded-lg border border-white/10 bg-[#0f1c2e] px-3 py-2 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                          >
                            {ROLES.map((role) => (
                              <option key={role.id} value={role.id}>{role.label}</option>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          onClick={() => salvar(usuario)}
                          disabled={salvandoId === usuario.id}
                          className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {salvandoId === usuario.id ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 p-4 xl:grid-cols-[260px_1fr]">
                      <aside className="rounded-xl border border-white/10 bg-[#0a1625]/55 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Resumo do acesso</p>
                        <p className="mt-3 text-sm font-semibold text-white">{permissoesAtivas} permissao(oes) ativa(s)</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {roleAtual?.descricao || 'Perfil personalizado.'}
                        </p>
                      </aside>

                      <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Permissoes do sistema</h3>
                          <span className="text-xs text-slate-500">Clique para liberar ou remover acesso</span>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {ABAS.map((aba) => {
                            const ativa = usuario.permissoes.includes(aba.id)

                            return (
                              <div key={aba.id} className={`rounded-xl border p-3 transition ${ativa ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-[#132337]/45'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className={`text-sm font-semibold ${ativa ? 'text-emerald-200' : 'text-slate-300'}`}>{aba.label}</p>
                                    <p className="mt-1 text-xs leading-snug text-slate-500">{aba.descricao}</p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => alternarPermissao(usuario.id, aba.id)}
                                    className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${ativa
                                      ? 'border-emerald-400 bg-emerald-500 text-[#0a1625]'
                                      : 'border-white/10 bg-[#0a1625] text-slate-400 hover:border-emerald-500/30 hover:text-white'
                                      }`}
                                  >
                                    {ativa ? 'Ativo' : 'Liberar'}
                                  </button>
                                </div>

                                {aba.filhos && (
                                  <div className="mt-3 grid grid-cols-2 gap-2">
                                    {aba.filhos.map((filho) => {
                                      const temDetalheConfigurado = aba.filhos?.some((item) => usuario.permissoes.includes(item.id))
                                      const filhoAtivo = temDetalheConfigurado ? usuario.permissoes.includes(filho.id) : ativa

                                      return (
                                        <button
                                          key={filho.id}
                                          type="button"
                                          onClick={() => alternarSubPermissao(usuario.id, aba.id, filho.id)}
                                          disabled={!ativa && !filhoAtivo}
                                          className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed ${filhoAtivo
                                            ? 'border-sky-500/40 bg-sky-500/20 text-sky-200'
                                            : 'border-white/10 bg-[#0a1625] text-slate-500 hover:border-white/20 hover:text-white disabled:opacity-45'
                                            }`}
                                        >
                                          {filho.label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
