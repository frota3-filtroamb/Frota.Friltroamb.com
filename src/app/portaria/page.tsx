'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useUser } from '@clerk/nextjs'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { getRole, podeAcessarDetalhe } from '@/lib/roles'
import { formatCpf, formatPhone, onlyDigits } from '@/lib/masks'
import { useRouter, useSearchParams } from 'next/navigation'

type Movimentacao = {
  id: number
  placa: string
  km: number | null
  motorista: string | null
  localizacao: string | null
  destino: string | null
  status: string
  liberado_em: string | null
  saida_em: string | null
  entrada_em: string | null
  tipo_veiculo?: string | null
  gestor_responsavel_id?: string | null
  gestor_responsavel_nome?: string | null
  gestor_responsavel_email?: string | null
  gestor_responsavel_setor?: string | null
}

type Pedestre = {
  id: number
  nome: string
  cpf_rg: string | null
  telefone: string | null
  empresa: string | null
  destino: string | null
  status: string
  liberado_em: string | null
  entrada_em: string | null
  saida_em: string | null
}

type Transferencia = {
  id: number
  placa: string
  base_origem: string
  base_destino: string
  motorista: string | null
  observacao: string | null
  status: string | null
  transferido_em: string | null
  transferido_por: string | null
}

type AcaoMovimentacao = {
  movimentacao_id: number | null
  acao: string
}

function PortariaContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded } = useUser()

  const [abaAtual, setAbaAtual] = useState<'veiculos' | 'autorizacoes' | 'pedestres' | 'transferencia'>('veiculos')
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [acoesMovimentacoes, setAcoesMovimentacoes] = useState<AcaoMovimentacao[]>([])
  const [historico, setHistorico] = useState<Movimentacao[]>([])
  const [pedestres, setPedestres] = useState<Pedestre[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [busca, setBusca] = useState('')
  const [acaoEmAndamentoId, setAcaoEmAndamentoId] = useState<string | null>(null)

  const podeControleVeiculos = podeAcessarDetalhe(user, 'portaria', 'portaria.veiculos')
  const podeControlePedestres = podeAcessarDetalhe(user, 'portaria', 'portaria.pedestres')
  const podeControleTransferencia = podeAcessarDetalhe(user, 'portaria', 'portaria.transferencia')
  const roleUsuario = getRole(user)
  const emailUsuario = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || ''
  const podeAutorizarSaida = ['dev', 'gestor', 'editor'].includes(roleUsuario)
  const abasPermitidas = useMemo(
    () => [
      podeControleVeiculos ? 'veiculos' : null,
      podeControleVeiculos && podeAutorizarSaida ? 'autorizacoes' : null,
      podeControlePedestres ? 'pedestres' : null,
      podeControleTransferencia ? 'transferencia' : null,
    ].filter(Boolean) as typeof abaAtual[],
    [podeControleVeiculos, podeAutorizarSaida, podeControlePedestres, podeControleTransferencia],
  )
  const ordenarHistoricoVeiculos = useCallback(function ordenarHistoricoVeiculos(registros: Movimentacao[]) {
    const dataEvento = (m: Movimentacao) => {
      if (m.tipo_veiculo === 'interno_saida') return m.saida_em || m.liberado_em
      if (m.tipo_veiculo === 'interno_entrada') return m.entrada_em || m.liberado_em
      return m.entrada_em || m.saida_em || m.liberado_em
    }

    return [...registros].sort((a, b) => {
      const dataA = new Date(dataEvento(a) || 0).getTime()
      const dataB = new Date(dataEvento(b) || 0).getTime()
      return dataB - dataA
    })
  }, [])

  const carregar = useCallback(async function carregar() {
    setCarregando(true)
    try {
      const [vAtivos, vFinais, pAtivos, tQuery, acoesQuery] = await Promise.all([
        supabase.from('movimentacoes').select('*').in('status', ['aguardando_saida', 'em_rota']).order('liberado_em', { ascending: false }),
        supabase.from('movimentacoes').select('*').eq('status', 'finalizado').order('liberado_em', { ascending: false }).limit(100),
        supabase.from('movimentacoes_pedestres').select('*').in('status', ['aguardando_entrada', 'em_visita']).order('liberado_em', { ascending: false }),
        supabase.from('transferencias').select('*').eq('status', 'aguardando_confirmacao').order('transferido_em', { ascending: false }).limit(100),
        supabase.from('movimentacoes_acoes').select('movimentacao_id, acao').eq('acao', 'saida_autorizada'),
      ])


      setMovimentacoes(vAtivos.data || [])
      setAcoesMovimentacoes(acoesQuery.data || [])
      setHistorico(ordenarHistoricoVeiculos(vFinais.data || []).slice(0, 30))
      setPedestres(pAtivos.data || [])
      setTransferencias(tQuery.data || [])
    } catch {
      setMensagem('Erro ao carregar dados. Verifique a tabela no banco.')
    } finally {
      setCarregando(false)
    }
  }, [ordenarHistoricoVeiculos, supabase])

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 30000)
    return () => clearInterval(interval)
  }, [carregar])

  useEffect(() => {
    if (!isLoaded || abasPermitidas.length === 0 || abasPermitidas.includes(abaAtual)) return
    setAbaAtual(abasPermitidas[0])
    setMensagem('')
  }, [isLoaded, abasPermitidas, abaAtual])

  useEffect(() => {
    const aba = searchParams.get('aba')
    if (!isLoaded || (aba !== 'autorizacoes' && aba !== 'veiculos') || !abasPermitidas.includes(aba)) return
    setAbaAtual(aba)
    setMensagem('')
  }, [isLoaded, searchParams, abasPermitidas])

  function selecionarAba(aba: typeof abaAtual) {
    setAbaAtual(aba)
    setMensagem('')
    router.replace('/portaria')
  }

  async function executarPortariaSegura(tipo: string, id: number) {
    const resposta = await fetch('/api/portaria/acoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id }),
    })
    const texto = await resposta.text()
    let resultado: { error?: string; mensagem?: string } = {}
    try {
      resultado = texto ? JSON.parse(texto) : {}
    } catch {
      throw new Error('Resposta invalida da API da portaria.')
    }

    if (!resposta.ok) {
      throw new Error(resultado.error || 'Erro ao executar acao da portaria.')
    }

    setMensagem(typeof resultado.mensagem === 'string' ? resultado.mensagem : 'Acao registrada.')
    await carregar()
  }

  function chaveAcao(tipo: string, id: number) {
    return `${tipo}:${id}`
  }

  async function registrarSaidaVeiculoSegura(movimentacao: Movimentacao) {
    const chave = chaveAcao('veiculo_saida', movimentacao.id)
    if (acaoEmAndamentoId) return

    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura('veiculo_saida', movimentacao.id)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro: ${error.message}` : 'Erro ao registrar saida.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  async function registrarEntradaVeiculoSegura(id: number) {
    const chave = chaveAcao('veiculo_entrada', id)
    if (acaoEmAndamentoId) return

    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura('veiculo_entrada', id)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro: ${error.message}` : 'Erro ao registrar entrada.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  async function registrarEntradaPedestreSegura(id: number) {
    const chave = chaveAcao('pedestre_entrada', id)
    if (acaoEmAndamentoId) return

    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura('pedestre_entrada', id)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro: ${error.message}` : 'Erro ao registrar entrada de pedestre.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  async function registrarSaidaPedestreSegura(id: number) {
    const chave = chaveAcao('pedestre_saida', id)
    if (acaoEmAndamentoId) return

    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura('pedestre_saida', id)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro: ${error.message}` : 'Erro ao registrar saida de pedestre.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  async function confirmarTransferenciaSegura(transferencia: Transferencia) {
    const chave = chaveAcao('transferencia_confirmar', transferencia.id)
    if (acaoEmAndamentoId) return

    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura('transferencia_confirmar', transferencia.id)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao confirmar transferencia: ${error.message}` : 'Erro ao confirmar transferencia.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  async function autorizarSaidaVeiculoSegura(movimentacao: Movimentacao) {
    const chave = chaveAcao('veiculo_autorizar_saida', movimentacao.id)
    if (acaoEmAndamentoId) return

    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura('veiculo_autorizar_saida', movimentacao.id)
      setAbaAtual('veiculos')
      router.replace('/portaria')
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao autorizar saida: ${error.message}` : 'Erro ao autorizar saida.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  function formatarData(data: string | null) {
    if (!data) return '--'
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(data)).replace(',', '')
  }

  function isVeiculoInterno(tipo: string | null | undefined) {
    const tipoNormalizado = (tipo || '').toLowerCase().trim()
    return tipoNormalizado === 'interno' || tipoNormalizado === 'interno_entrada' || tipoNormalizado === 'interno_saida'
  }

  function isVeiculoExterno(tipo: string | null | undefined) {
    const tipoNormalizado = (tipo || '').toLowerCase().trim()
    return tipoNormalizado === 'externo' || tipoNormalizado === 'veiculo_externo'
  }

  function deveMostrarAcaoSaida(m: Movimentacao) {
    const veiculoJaEntrouESemSaida = Boolean(m.entrada_em) && !m.saida_em && !isVeiculoInterno(m.tipo_veiculo)
    return m.status === 'aguardando_saida' || isVeiculoExterno(m.tipo_veiculo) || veiculoJaEntrouESemSaida
  }

  function temSaidaAutorizada(movimentacaoId: number) {
    return acoesMovimentacoes.some((acao) => acao.movimentacao_id === movimentacaoId && acao.acao === 'saida_autorizada')
  }

  function dataEntradaVeiculo(m: Movimentacao) {
    if (m.tipo_veiculo === 'interno_saida') return null
    return m.entrada_em
  }

  const vAguardando = movimentacoes.filter((m) => m.status === 'aguardando_saida').length
  const vEmRota = movimentacoes.filter((m) => m.status === 'em_rota').length
  const vRetornosHoje = historico.filter((m) => {
    const entrada = dataEntradaVeiculo(m)
    return entrada && new Date(entrada).toDateString() === new Date().toDateString()
  }).length
  const pAguardando = pedestres.filter((p) => p.status === 'aguardando_entrada').length
  const pEmVisita = pedestres.filter((p) => p.status === 'em_visita').length

  const textoFiltro = busca.toLowerCase()
  const mFiltradas = movimentacoes.filter((m) => m.placa?.toLowerCase().includes(textoFiltro) || m.motorista?.toLowerCase().includes(textoFiltro) || m.destino?.toLowerCase().includes(textoFiltro))
  const autorizacoesPendentes = mFiltradas.filter((m) =>
    isVeiculoExterno(m.tipo_veiculo) &&
    Boolean(m.entrada_em || m.liberado_em) &&
    !m.saida_em &&
    !temSaidaAutorizada(m.id) &&
    (roleUsuario !== 'gestor' || Boolean(emailUsuario && m.gestor_responsavel_email?.toLowerCase() === emailUsuario))
  )
  const digitosFiltro = onlyDigits(busca)
  const pFiltrados = pedestres.filter((p) => p.nome?.toLowerCase().includes(textoFiltro) || p.cpf_rg?.includes(textoFiltro) || (digitosFiltro && onlyDigits(p.cpf_rg || '').includes(digitosFiltro)) || p.empresa?.toLowerCase().includes(textoFiltro))
  const transferenciasFiltradas = transferencias.filter((t) => t.placa?.toLowerCase().includes(textoFiltro) || t.base_origem?.toLowerCase().includes(textoFiltro) || t.base_destino?.toLowerCase().includes(textoFiltro) || t.motorista?.toLowerCase().includes(textoFiltro))
  const transferenciasPendentes = transferenciasFiltradas.filter((t) => t.status === 'aguardando_confirmacao')

  return (
    <RequirePermissao permissao="portaria">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <div className="app-scroll flex-1 overflow-y-auto overflow-x-hidden bg-[#0a1625]" style={{ zoom: 0.95 }}>
            <div className="portaria-controle-page flex-1 px-4 py-6 md:px-8 xl:px-14">
              {mensagem && <div className={`mb-4 p-4 rounded-xl text-sm border ${mensagem.includes('Erro') ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>{mensagem}</div>}
              {abasPermitidas.length === 0 && <div className="p-6 rounded-2xl border border-white/10 bg-[#0f1c2e] text-slate-400">Nenhum topico do controle liberado para este usuario.</div>}

              {abasPermitidas.length > 0 && (
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-[#132337] p-1.5 lg:flex-row lg:items-center">
                  <div className="flex flex-wrap gap-1.5 lg:flex-nowrap">
                    {podeControleVeiculos && (
                      <button
                        data-topic-button
                        onClick={() => selecionarAba('veiculos')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'veiculos' ? 'bg-emerald-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        Veiculos
                      </button>
                    )}
                    {podeControleVeiculos && podeAutorizarSaida && (
                      <button
                        data-topic-button
                        onClick={() => selecionarAba('autorizacoes')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'autorizacoes' ? 'bg-orange-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        Autorizações
                      </button>
                    )}
                    {podeControlePedestres && (
                      <button
                        data-topic-button
                        onClick={() => selecionarAba('pedestres')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'pedestres' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        Pedestres / Visitantes
                      </button>
                    )}
                    {podeControleTransferencia && (
                      <button
                        data-topic-button
                        onClick={() => selecionarAba('transferencia')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'transferencia' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        Transferencia
                      </button>
                    )}
                  </div>

                  <div className="relative min-w-[240px] flex-1">
                    <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={abaAtual === 'veiculos' || abaAtual === 'autorizacoes' ? 'Filtrar placa, motorista, destino...' : abaAtual === 'pedestres' ? 'Filtrar nome, cpf, empresa...' : 'Filtrar placa, origem, destino...'} className="w-full pl-10 pr-4 py-2.5 bg-[#0f1c2e] border border-emerald-500/20 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/70 text-sm">🔍</span>
                  </div>

                  <button
                    onClick={carregar}
                    disabled={carregando}
                    title="Atualizar dados"
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#0f1c2e] border border-emerald-500/20 rounded-lg text-sm text-slate-400 hover:text-white hover:border-emerald-500/40 active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <span className={carregando ? 'animate-spin' : ''}>↻</span>
                    <span>Atualizar</span>
                  </button>
                </div>
              )}

              {abasPermitidas.length > 0 && (
                <div key={abaAtual} className="animate-tab">
                  {carregando ? (
                    <div className="space-y-6 animate-pulse">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-white/5 border border-white/5" />)}</div>
                      <div className="rounded-2xl border border-white/5 bg-[#0f1c2e] overflow-hidden"><div className="h-12 bg-[#132337]" /><div className="space-y-3 p-5"><div className="h-10 rounded-lg bg-white/5" /><div className="h-10 rounded-lg bg-white/5" /><div className="h-10 rounded-lg bg-white/5" /></div></div>
                    </div>
                  ) : abaAtual === 'veiculos' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Saida</p><p className="text-3xl font-bold text-orange-300 mt-1">{vAguardando}</p></div>
                        <div className="bg-[#0f1c2e] border border-blue-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Em Rota</p><p className="text-3xl font-bold text-blue-300 mt-1">{vEmRota}</p></div>
                        <div className="bg-[#0f1c2e] border border-emerald-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Retornos Hoje</p><p className="text-3xl font-bold text-emerald-300 mt-1">{vRetornosHoje}</p></div>
                        <div className="bg-[#0f1c2e] border border-emerald-500/15 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Total em Aberto</p><p className="text-3xl font-bold text-white mt-1">{vAguardando + vEmRota}</p></div>
                      </div>
                      <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 shadow-[0_0_30px_rgba(16,185,129,0.05)] overflow-hidden mb-8">
                        <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10">
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Placa</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Motorista</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Destino</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">KM</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Liberacao</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Saida</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Status</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Acao</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {mFiltradas.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">Nenhum veiculo em andamento.</td>
                                </tr>
                              ) : (
                                mFiltradas.map((m) => (
                                  <tr key={m.id} className="hover:bg-emerald-500/5 transition-colors">
                                    <td className="pl-3 py-2.5 text-center text-white whitespace-nowrap w40">
                                      <div className="flex items-center justify-center gap-2 whitespace-nowrap flex-nowrap align-middle">
                                        <span className="font-semibold text-emerald-300 whitespace-nowrap tracking-wide text-sm">{m.placa}</span>
                                        {isVeiculoInterno(m.tipo_veiculo) && (
                                          <span className="inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/25 whitespace-nowrap">
                                            Interno
                                          </span>
                                        )}
                                        {m.tipo_veiculo === 'externo' && (
                                          <span className="inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-orange-500/15 text-orange-300 border border-orange-500/25 whitespace-nowrap">
                                            Externo
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.motorista || '--'}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.destino || '--'}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.km ? m.km.toLocaleString('pt-BR') : '--'}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{formatarData(m.liberado_em)}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{formatarData(m.saida_em)}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[12px] font-medium whitespace-nowrap ${m.status === 'aguardando_saida' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20' : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'}`}>
                                        {m.status === 'aguardando_saida' ? 'Aguardando Saida' : 'Em Rota'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                      {isVeiculoExterno(m.tipo_veiculo) && !temSaidaAutorizada(m.id) ? (
                                        <span className="inline-flex px-2 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-[11px] font-semibold text-orange-300">
                                          Aguardando gestor
                                        </span>
                                      ) : deveMostrarAcaoSaida(m) ? (
                                        <button
                                          onClick={() => registrarSaidaVeiculoSegura(m)}
                                          disabled={acaoEmAndamentoId === chaveAcao('veiculo_saida', m.id)}
                                          className="bg-orange-500 hover:bg-orange-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-1.5 py-1 rounded-full transition-all duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {acaoEmAndamentoId === chaveAcao('veiculo_saida', m.id) ? 'Registrando...' : 'Registrar Saida'}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => registrarEntradaVeiculoSegura(m.id)}
                                          disabled={acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id)}
                                          className="bg-emerald-500 hover:bg-emerald-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-1.5 py-0.5 rounded-full transition-all duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id) ? 'Registrando...' : 'Registrar Entrada'}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : abaAtual === 'autorizacoes' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Gestor</p><p className="text-3xl font-bold text-orange-300 mt-1">{autorizacoesPendentes.length}</p></div>
                      </div>
                      <div className="bg-[#0f1c2e] rounded-2xl border border-orange-500/15 shadow-[0_0_30px_rgba(249,115,22,0.05)] overflow-hidden mb-8">
                        <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-auto">
                          <table className="w-full min-w-[760px] text-xs">
                            <thead>
                              <tr className="bg-[#132337] border-b border-orange-500/15 sticky top-0 z-10">
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Placa</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Motorista</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Horario Liberado</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Destino</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Gestor</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Setor</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Acao</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {autorizacoesPendentes.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Nenhum veiculo externo aguardando autorizacao de saida.</td>
                                </tr>
                              ) : (
                                autorizacoesPendentes.map((m) => (
                                  <tr key={m.id} className="hover:bg-orange-500/5 transition-colors">
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <span className="font-semibold text-orange-300 whitespace-nowrap tracking-wide text-sm">{m.placa}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.motorista || '--'}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{formatarData(m.entrada_em || m.liberado_em)}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.destino || '--'}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.gestor_responsavel_nome || '--'}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.gestor_responsavel_setor || '--'}</td>
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => autorizarSaidaVeiculoSegura(m)}
                                        disabled={acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', m.id)}
                                        className="bg-orange-500 hover:bg-orange-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', m.id) ? 'Registrando...' : 'Autorizar Saida'}
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : abaAtual === 'pedestres' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Entrada</p><p className="text-3xl font-bold text-orange-300 mt-1">{pAguardando}</p></div>
                        <div className="bg-[#0f1c2e] border border-purple-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Em Visita</p><p className="text-3xl font-bold text-purple-300 mt-1">{pEmVisita}</p></div>
                        <div className="bg-[#0f1c2e] border border-emerald-500/15 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Total em Aberto</p><p className="text-3xl font-bold text-white mt-1">{pAguardando + pEmVisita}</p></div>
                      </div>
                      <div className="bg-[#0f1c2e] rounded-2xl border border-purple-500/15 shadow-[0_0_30px_rgba(168,85,247,0.05)] overflow-hidden mb-8">
                        <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-hidden">
                          <table className="w-full table-fixed text-xs">
                            <thead>
                              <tr className="bg-[#132337] border-b border-purple-500/15 sticky top-0 z-10">
                                <th className="w-[14%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Nome</th>
                                <th className="w-[13%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Empresa</th>
                                <th className="w-[13%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">CPF</th>
                                <th className="w-[13%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Telefone</th>
                                <th className="w-[13%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Destino</th>
                                <th className="w-[15%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Liberacao</th>
                                <th className="w-[11%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Status</th>
                                <th className="w-[8%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Acao</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {pFiltrados.length === 0 ? (
                                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Nenhum pedestre em andamento.</td></tr>
                              ) : (
                                pFiltrados.map((p) => (
                                  <tr key={p.id} className="hover:bg-purple-500/5 transition-colors">
                                    <td className="px-2 py-2.5 text-center font-semibold text-purple-300 text-[14px] truncate">{p.nome}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{p.empresa || 'Sem empresa'}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{p.cpf_rg ? formatCpf(p.cpf_rg) : '--'}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{p.telefone ? formatPhone(p.telefone) : '--'}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{p.destino || '--'}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{formatarData(p.liberado_em)}</td>
                                    <td className="px-2 py-2.5 text-center">
                                      <span className={`inline-flex max-w-full px-2 py-0.5 rounded-full text-[9px] font-medium truncate ${p.status === 'aguardando_entrada' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20' : 'bg-purple-500/15 text-purple-300 border border-purple-500/20'}`}>
                                        {p.status === 'aguardando_entrada' ? 'Aguardando Entrada' : 'Em Visita'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                      {p.status === 'aguardando_entrada' ? (
                                        <button
                                          onClick={() => registrarEntradaPedestreSegura(p.id)}
                                          disabled={acaoEmAndamentoId === chaveAcao('pedestre_entrada', p.id)}
                                          className="bg-emerald-500 hover:bg-emerald-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-2 py-1 rounded-lg transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {acaoEmAndamentoId === chaveAcao('pedestre_entrada', p.id) ? 'Registrando...' : 'Entrou'}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => registrarSaidaPedestreSegura(p.id)}
                                          disabled={acaoEmAndamentoId === chaveAcao('pedestre_saida', p.id)}
                                          className="bg-orange-500 hover:bg-orange-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-2 py-1 rounded-lg transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {acaoEmAndamentoId === chaveAcao('pedestre_saida', p.id) ? 'Registrando...' : 'Saiu'}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Confirmacao</p><p className="text-3xl font-bold text-orange-300 mt-1">{transferenciasPendentes.length}</p></div>
                      </div>
                      <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 shadow-[0_0_30px_rgba(16,185,129,0.05)] overflow-hidden">
                        <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10">
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Veiculo</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Origem</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Destino</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Motorista</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Data / Hora</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Responsavel</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Acao</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {transferenciasPendentes.length === 0 ? (
                                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Nenhuma transferencia aguardando confirmacao.</td></tr>
                              ) : (
                                transferenciasPendentes.map((t) => (
                                  <tr key={t.id} className="hover:bg-emerald-500/5 transition-colors">
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      <div className="font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md inline-block whitespace-nowrap text-[13px]">
                                        {t.placa}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{t.base_origem}</td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{t.base_destino}</td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{t.motorista || <span className="text-slate-600 font-normal">Nao informado</span>}</td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{formatarData(t.transferido_em)}</td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{t.transferido_por || '--”'}</td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      <button
                                        onClick={() => confirmarTransferenciaSegura(t)}
                                        disabled={acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id)}
                                        className="bg-emerald-500 hover:bg-emerald-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id) ? 'Registrando...' : 'Confirmar'}
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RequirePermissao>
  )
}

export default function PortariaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a1625]" />}>
      <PortariaContent />
    </Suspense>
  )
}
