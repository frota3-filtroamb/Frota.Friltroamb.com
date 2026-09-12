'use client'

import Sidebar from '@/components/Sidebar'
import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import type { Permissao } from '@/lib/roles'

type Role = 'dev' | 'gestor' | 'porteiro'

type Usuario = {
  id: string
  nome: string
  email: string
  role: Role
  permissoes: Permissao[]
}

const ABAS: { id: Permissao; label: string; filhos?: { id: Permissao; label: string }[] }[] = [
  { id: 'veiculos', label: 'Veiculos' },
  {
    id: 'portaria',
    label: 'Controle',
    filhos: [
      { id: 'portaria.veiculos', label: 'Veiculos' },
      { id: 'portaria.pedestres', label: 'Pedestres' },
      { id: 'portaria.transferencia', label: 'Transferencia' },
    ],
  },
  {
    id: 'liberacao',
    label: 'Liberacao',
    filhos: [
      { id: 'liberacao.veiculo_empresa', label: 'Veiculo Empresa' },
      { id: 'liberacao.veiculo_externo', label: 'Veiculo Externo' },
      { id: 'liberacao.pedestre', label: 'Pedestre' },
      { id: 'liberacao.transferencia', label: 'Transferencia' },
      { id: 'liberacao.veiculo_interno', label: 'Veiculo Interno' },
    ],
  },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'encomendas', label: 'Encomendas' },
  { id: 'almoxarifado', label: 'Almoxarifado' },
]

const ROLES: { id: Role; label: string }[] = [
  { id: 'dev', label: 'Dev' },
  { id: 'gestor', label: 'Gestor' },
  { id: 'porteiro', label: 'Porteiro' },
]

export default function UsuariosPage() {
  const { user, isLoaded } = useUser()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
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
      setMensagem('Permissoes atualizadas.')
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
        <div className="flex-1 ml-64 flex items-center justify-center text-slate-400">Carregando usuarios...</div>
      </div>
    )
  }

  if (!podeGerenciar) {
    return (
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />
        <div className="flex-1 ml-64 flex items-center justify-center text-slate-400">Acesso negado.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#0a1625]">
      <Sidebar />

      <main className="flex-1 ml-64 min-h-screen overflow-y-auto bg-[#0a1625]">
        <div className="relative h-28 md:h-36 shrink-0 overflow-hidden">
          <img src="/images/banner-frota3.jpg" alt="Filtroamb" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1625]/85 via-[#0a1625]/50 to-[#0a1625]/20" />
          <div className="absolute inset-0 flex items-end pb-6 px-8">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow">Usuarios</h1>
              <p className="text-sm text-emerald-300 mt-1 drop-shadow">Liberacao de acesso por usuario</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {mensagem && (
            <div className={`p-4 rounded-xl text-sm border ${mensagem.includes('Erro') || mensagem.includes('negado') ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
              {mensagem}
            </div>
          )}

          <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 shadow-[0_0_30px_rgba(16,185,129,0.05)] overflow-hidden">
            <div className="max-h-[68vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Usuario</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Perfil</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Permissoes</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Acao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-slate-500">Nenhum usuario encontrado.</td>
                    </tr>
                  ) : (
                    usuarios.map((usuario) => (
                      <tr key={usuario.id} className="hover:bg-emerald-500/5 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-medium text-white">{usuario.nome}</div>
                          <div className="text-xs text-slate-500 mt-1">{usuario.email || usuario.id}</div>
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={usuario.role}
                            onChange={(event) => alterarRole(usuario.id, event.target.value as Role)}
                            className="bg-[#132337] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                          >
                            {ROLES.map((role) => (
                              <option key={role.id} value={role.id}>{role.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-3">
                            {ABAS.map((aba) => {
                              const ativa = usuario.permissoes.includes(aba.id)
                              return (
                                <div key={aba.id} className="space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => alternarPermissao(usuario.id, aba.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${ativa
                                        ? 'bg-emerald-500 text-[#0a1625] border-emerald-400 shadow-sm'
                                        : 'bg-[#132337] text-slate-400 border-white/10 hover:text-white hover:border-white/20'
                                      }`}
                                  >
                                    {aba.label}
                                  </button>

                                  {ativa && aba.filhos && (
                                    <div className="flex flex-wrap gap-2 pl-3 border-l border-white/10">
                                      {aba.filhos.map((filho) => {
                                        const temDetalheConfigurado = aba.filhos?.some((item) => usuario.permissoes.includes(item.id))
                                        const filhoAtivo = temDetalheConfigurado ? usuario.permissoes.includes(filho.id) : ativa
                                        return (
                                          <button
                                            key={filho.id}
                                            type="button"
                                            onClick={() => alternarSubPermissao(usuario.id, aba.id, filho.id)}
                                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${filhoAtivo
                                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                                : 'bg-[#0a1625] text-slate-500 border-white/10 hover:text-white hover:border-white/20'
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
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => salvar(usuario)}
                            disabled={salvandoId === usuario.id}
                            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-[#0a1625] text-xs font-semibold px-4 py-2 rounded-lg transition"
                          >
                            {salvandoId === usuario.id ? 'Salvando...' : 'Salvar'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
