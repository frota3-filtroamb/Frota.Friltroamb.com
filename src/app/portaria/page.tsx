'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { podeAcessarDetalhe } from '@/lib/roles'

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
  transferido_em: string | null
  transferido_por: string | null
}

export default function PortariaPage() {
  const supabase = createClient()
  const { user, isLoaded } = useUser()

  const [abaAtual, setAbaAtual] = useState<'veiculos' | 'pedestres' | 'transferencia'>('veiculos')
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [historico, setHistorico] = useState<Movimentacao[]>([])
  const [pedestres, setPedestres] = useState<Pedestre[]>([])
  const [historicoPedestres, setHistoricoPedestres] = useState<Pedestre[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [busca, setBusca] = useState('')

  const podeControleVeiculos = podeAcessarDetalhe(user, 'portaria', 'portaria.veiculos')
  const podeControlePedestres = podeAcessarDetalhe(user, 'portaria', 'portaria.pedestres')
  const podeControleTransferencia = podeAcessarDetalhe(user, 'portaria', 'portaria.transferencia')
  const abasPermitidas = [
    podeControleVeiculos ? 'veiculos' : null,
    podeControlePedestres ? 'pedestres' : null,
    podeControleTransferencia ? 'transferencia' : null,
  ].filter(Boolean) as typeof abaAtual[]

  async function carregar() {
    setCarregando(true)
    try {
      const [vAtivos, vFinais, pAtivos, pFinais, tQuery] = await Promise.all([
        supabase.from('movimentacoes').select('*').in('status', ['aguardando_saida', 'em_rota']).order('liberado_em', { ascending: false }),
        supabase.from('movimentacoes').select('*').eq('status', 'finalizado').order('entrada_em', { ascending: false }).limit(30),
        supabase.from('movimentacoes_pedestres').select('*').in('status', ['aguardando_entrada', 'em_visita']).order('liberado_em', { ascending: false }),
        supabase.from('movimentacoes_pedestres').select('*').eq('status', 'finalizado').order('saida_em', { ascending: false }).limit(30),
        supabase.from('transferencias').select('*').order('transferido_em', { ascending: false }).limit(100),
      ])

      setMovimentacoes(vAtivos.data || [])
      setHistorico(vFinais.data || [])
      setPedestres(pAtivos.data || [])
      setHistoricoPedestres(pFinais.data || [])
      setTransferencias(tQuery.data || [])
    } catch {
      setMensagem('Erro ao carregar dados. Verifique a tabela no banco.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    if (!isLoaded || abasPermitidas.length === 0 || abasPermitidas.includes(abaAtual)) return
    setAbaAtual(abasPermitidas[0])
    setMensagem('')
  }, [isLoaded, abasPermitidas, abaAtual])

  async function registrarSaidaVeiculo(id: number) {
    const { error } = await supabase.from('movimentacoes').update({ status: 'em_rota', saida_em: new Date().toISOString() }).eq('id', id)
    if (error) setMensagem('Erro: ' + error.message)
    else { setMensagem('Saida do veiculo registrada!'); carregar() }
  }

  async function registrarEntradaVeiculo(id: number) {
    const { error } = await supabase.from('movimentacoes').update({ status: 'finalizado', entrada_em: new Date().toISOString() }).eq('id', id)
    if (error) setMensagem('Erro: ' + error.message)
    else { setMensagem('Entrada do veiculo registrada!'); carregar() }
  }

  async function registrarEntradaPedestre(id: number) {
    const { error } = await supabase.from('movimentacoes_pedestres').update({ status: 'em_visita', entrada_em: new Date().toISOString() }).eq('id', id)
    if (error) setMensagem('Erro: ' + error.message)
    else { setMensagem('Entrada de pedestre registrada!'); carregar() }
  }

  async function registrarSaidaPedestre(id: number) {
    const { error } = await supabase.from('movimentacoes_pedestres').update({ status: 'finalizado', saida_em: new Date().toISOString() }).eq('id', id)
    if (error) setMensagem('Erro: ' + error.message)
    else { setMensagem('Saida de pedestre registrada!'); carregar() }
  }

  function formatarData(data: string | null) {
    if (!data) return '—'
    return new Date(data).toLocaleString('pt-BR')
  }

  const vAguardando = movimentacoes.filter((m) => m.status === 'aguardando_saida').length
  const vEmRota = movimentacoes.filter((m) => m.status === 'em_rota').length
  const vRetornosHoje = historico.filter((m) => m.entrada_em && new Date(m.entrada_em).toDateString() === new Date().toDateString()).length
  const pAguardando = pedestres.filter((p) => p.status === 'aguardando_entrada').length
  const pEmVisita = pedestres.filter((p) => p.status === 'em_visita').length
  const pSaidasHoje = historicoPedestres.filter((p) => p.saida_em && new Date(p.saida_em).toDateString() === new Date().toDateString()).length

  const textoFiltro = busca.toLowerCase()
  const mFiltradas = movimentacoes.filter((m) => m.placa?.toLowerCase().includes(textoFiltro) || m.motorista?.toLowerCase().includes(textoFiltro) || m.destino?.toLowerCase().includes(textoFiltro))
  const mHistFiltrado = historico.filter((m) => m.placa?.toLowerCase().includes(textoFiltro) || m.motorista?.toLowerCase().includes(textoFiltro) || m.destino?.toLowerCase().includes(textoFiltro))
  const pFiltrados = pedestres.filter((p) => p.nome?.toLowerCase().includes(textoFiltro) || p.cpf_rg?.includes(textoFiltro) || p.empresa?.toLowerCase().includes(textoFiltro))
  const pHistFiltrado = historicoPedestres.filter((p) => p.nome?.toLowerCase().includes(textoFiltro) || p.empresa?.toLowerCase().includes(textoFiltro))
  const transferenciasFiltradas = transferencias.filter((t) => t.placa?.toLowerCase().includes(textoFiltro) || t.base_origem?.toLowerCase().includes(textoFiltro) || t.base_destino?.toLowerCase().includes(textoFiltro) || t.motorista?.toLowerCase().includes(textoFiltro))

  return (
    <RequirePermissao permissao="portaria">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
          <div className="relative h-28 md:h-36 shrink-0 overflow-hidden">
            <img src="/images/banner-frota.jpg" alt="Filtroamb" className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1625]/85 via-[#0a1625]/50 to-[#0a1625]/20" />
            <div data-banner className="absolute inset-0 flex items-end pb-6 px-8">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow">Portaria</h1>
                <p className="text-sm text-emerald-300 mt-1 drop-shadow">Controle operacional de entrada e saida</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0a1625]" style={{ zoom: 0.95 }}>
            <div className="px-6 mt-4">
              <div className="flex flex-wrap gap-3 bg-[#132337] border border-emerald-500/20 rounded-xl p-1.5 w-fit">
                {podeControleVeiculos && <button onClick={() => setAbaAtual('veiculos')} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${abaAtual === 'veiculos' ? 'bg-emerald-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:text-white'}`}>Veiculos</button>}
                {podeControlePedestres && <button onClick={() => setAbaAtual('pedestres')} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${abaAtual === 'pedestres' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Pedestres / Visitantes</button>}
                {podeControleTransferencia && <button onClick={() => { setAbaAtual('transferencia'); setMensagem('') }} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${abaAtual === 'transferencia' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Transferencia</button>}
              </div>
            </div>

            <div key={abaAtual} className="animate-tab p-6 pt-4 flex-1">
              {mensagem && <div className={`mb-4 p-4 rounded-xl text-sm border ${mensagem.includes('Erro') ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>{mensagem}</div>}
              {abasPermitidas.length === 0 && <div className="p-6 rounded-2xl border border-white/10 bg-[#0f1c2e] text-slate-400">Nenhum topico do controle liberado para este usuario.</div>}

              {abasPermitidas.length > 0 && <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={abaAtual === 'veiculos' ? 'Filtrar placa, motorista, destino...' : abaAtual === 'pedestres' ? 'Filtrar nome, cpf, empresa...' : 'Filtrar placa, origem, destino...'} className="w-full pl-10 pr-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/70 text-sm">🔍</span>
                </div>
              </div>}

              {abasPermitidas.length === 0 ? null : carregando ? (
                <div className="space-y-6 animate-pulse">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-white/5 border border-white/5" />)}</div>
                  <div className="rounded-2xl border border-white/5 bg-[#0f1c2e] overflow-hidden"><div className="h-12 bg-[#132337]" /><div className="space-y-3 p-5"><div className="h-10 rounded-lg bg-white/5" /><div className="h-10 rounded-lg bg-white/5" /><div className="h-10 rounded-lg bg-white/5" /></div></div>
                </div>
              ) : abaAtual === 'veiculos' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Saida</p><p className="text-3xl font-bold text-orange-300 mt-1">{vAguardando}</p></div>
                    <div className="bg-[#0f1c2e] border border-blue-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Em Rota</p><p className="text-3xl font-bold text-blue-300 mt-1">{vEmRota}</p></div>
                    <div className="bg-[#0f1c2e] border border-emerald-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Retornos Hoje</p><p className="text-3xl font-bold text-emerald-300 mt-1">{vRetornosHoje}</p></div>
                    <div className="bg-[#0f1c2e] border border-emerald-500/15 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Total em Aberto</p><p className="text-3xl font-bold text-white mt-1">{vAguardando + vEmRota}</p></div>
                  </div>
                  <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 shadow-[0_0_30px_rgba(16,185,129,0.05)] overflow-hidden mb-8">
                    <div className="max-h-[52vh] overflow-auto">
                      <table className="min-w-full text-sm"><thead><tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10"><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Placa</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Motorista</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Destino</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">KM</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Horário de Liberação</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Horário de Saida</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Status</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Acao</th></tr></thead><tbody className="divide-y divide-white/5">{mFiltradas.length === 0 ? <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">Nenhum veiculo em andamento.</td></tr> : mFiltradas.map((m) => <tr key={m.id} className="hover:bg-emerald-500/5 transition-colors"><td className="px-5 py-3.5"><div className="flex items-center gap-2"><span className="font-medium text-emerald-300">{m.placa}</span>{m.tipo_veiculo === 'interno' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/25">Veiculo interno</span>}{m.tipo_veiculo === 'externo' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-orange-500/15 text-orange-300 border border-orange-500/25">Externo</span>}</div></td><td className="px-5 py-3.5 text-slate-300">{m.motorista || '—'}</td><td className="px-5 py-3.5 text-slate-300">{m.destino || '—'}</td><td className="px-5 py-3.5 text-slate-400">{m.km ? m.km.toLocaleString('pt-BR') : '—'}</td><td className="px-5 py-3.5 text-slate-500 text-xs">{formatarData(m.liberado_em)}</td><td className="px-5 py-3.5 text-slate-500 text-xs">{formatarData(m.saida_em)}</td><td className="px-5 py-3.5"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${m.status === 'aguardando_saida' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20' : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'}`}>{m.status === 'aguardando_saida' ? 'Aguardando Saida' : 'Em Rota'}</span></td><td className="px-5 py-3.5">{m.status === 'aguardando_saida' ? <button onClick={() => registrarSaidaVeiculo(m.id)} className="bg-orange-500 hover:bg-orange-400 text-[#0a1625] text-xs font-semibold px-3 py-1.5 rounded-lg transition">Registrar Saida</button> : <button onClick={() => registrarEntradaVeiculo(m.id)} className="bg-emerald-500 hover:bg-emerald-400 text-[#0a1625] text-xs font-semibold px-3 py-1.5 rounded-lg transition">Registrar Entrada</button>}</td></tr>)}</tbody></table>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3 tracking-tight">Historico de Entradas e Saidas (Veiculos)</h3>
                  <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 overflow-hidden mb-8">
                    <div className="max-h-[52vh] overflow-auto">
                      <table className="min-w-full text-sm"><thead><tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10"><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Placa</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Motorista</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Destino</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Saida</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Entrada</th></tr></thead><tbody className="divide-y divide-white/5">{mHistFiltrado.length === 0 ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Nenhum registro.</td></tr> : mHistFiltrado.map((m) => <tr key={m.id} className="hover:bg-emerald-500/5 transition-colors"><td className="px-5 py-3.5"><div className="flex items-center gap-2"><span className="font-medium text-emerald-300">{m.placa}</span>{m.tipo_veiculo === 'interno' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/25">Veiculo interno</span>}{m.tipo_veiculo === 'externo' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-orange-500/15 text-orange-300 border border-orange-500/25">Externo</span>}</div></td><td className="px-5 py-3.5 text-slate-300">{m.motorista || '—'}</td><td className="px-5 py-3.5 text-slate-300">{m.destino || '—'}</td><td className="px-5 py-3.5 text-slate-500 text-xs">{formatarData(m.saida_em)}</td><td className="px-5 py-3.5 text-slate-500 text-xs">{formatarData(m.entrada_em)}</td></tr>)}</tbody></table>
                    </div>
                  </div>
                </>
              ) : abaAtual === 'pedestres' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Entrada</p><p className="text-3xl font-bold text-orange-300 mt-1">{pAguardando}</p></div>
                    <div className="bg-[#0f1c2e] border border-purple-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Em Visita</p><p className="text-3xl font-bold text-purple-300 mt-1">{pEmVisita}</p></div>
                    <div className="bg-[#0f1c2e] border border-emerald-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Saidas Hoje</p><p className="text-3xl font-bold text-emerald-300 mt-1">{pSaidasHoje}</p></div>
                    <div className="bg-[#0f1c2e] border border-emerald-500/15 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Total em Aberto</p><p className="text-3xl font-bold text-white mt-1">{pAguardando + pEmVisita}</p></div>
                  </div>
                  <div className="bg-[#0f1c2e] rounded-2xl border border-purple-500/15 shadow-[0_0_30px_rgba(168,85,247,0.05)] overflow-hidden mb-8"><div className="max-h-[52vh] overflow-auto"><table className="min-w-full text-sm"><thead><tr className="bg-[#132337] border-b border-purple-500/15 sticky top-0 z-10"><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Nome / Empresa</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">CPF / Tel</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Destino</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Liberado em</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Status</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Acao</th></tr></thead><tbody className="divide-y divide-white/5">{pFiltrados.length === 0 ? <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Nenhum pedestre em andamento.</td></tr> : pFiltrados.map((p) => <tr key={p.id} className="hover:bg-purple-500/5 transition-colors"><td className="px-5 py-3.5"><div className="font-medium text-purple-300">{p.nome}</div><div className="text-xs text-slate-500">{p.empresa || 'Sem empresa'}</div></td><td className="px-5 py-3.5"><div className="text-slate-300">{p.cpf_rg || '—'}</div><div className="text-xs text-slate-500">{p.telefone || '—'}</div></td><td className="px-5 py-3.5 text-slate-300">{p.destino || '—'}</td><td className="px-5 py-3.5 text-slate-500 text-xs">{formatarData(p.liberado_em)}</td><td className="px-5 py-3.5"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${p.status === 'aguardando_entrada' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20' : 'bg-purple-500/15 text-purple-300 border border-purple-500/20'}`}>{p.status === 'aguardando_entrada' ? 'Aguardando Entrada' : 'Em Visita'}</span></td><td className="px-5 py-3.5">{p.status === 'aguardando_entrada' ? <button onClick={() => registrarEntradaPedestre(p.id)} className="bg-emerald-500 hover:bg-emerald-400 text-[#0a1625] text-xs font-semibold px-3 py-1.5 rounded-lg transition">Entrou</button> : <button onClick={() => registrarSaidaPedestre(p.id)} className="bg-orange-500 hover:bg-orange-400 text-[#0a1625] text-xs font-semibold px-3 py-1.5 rounded-lg transition">Saiu</button>}</td></tr>)}</tbody></table></div></div>
                  <h3 className="text-lg font-semibold text-white mb-3 tracking-tight">Historico de Visitas (Pedestres)</h3>
                  <div className="bg-[#0f1c2e] rounded-2xl border border-purple-500/15 overflow-hidden"><div className="max-h-[52vh] overflow-auto"><table className="min-w-full text-sm"><thead><tr className="bg-[#132337] border-b border-purple-500/15 sticky top-0 z-10"><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Nome / Empresa</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Destino</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Entrada</th><th className="px-5 py-3.5 text-left text-xs font-semibold text-purple-400/90 uppercase tracking-wider">Saida</th></tr></thead><tbody className="divide-y divide-white/5">{pHistFiltrado.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">Nenhum registro.</td></tr> : pHistFiltrado.map((p) => <tr key={p.id} className="hover:bg-purple-500/5 transition-colors"><td className="px-5 py-3.5"><div className="font-medium text-purple-300">{p.nome}</div><div className="text-xs text-slate-500">{p.empresa || 'Sem empresa'}</div></td><td className="px-5 py-3.5 text-slate-300">{p.destino || '—'}</td><td className="px-5 py-3.5 text-slate-500 text-xs">{formatarData(p.entrada_em)}</td><td className="px-5 py-3.5 text-slate-500 text-xs">{formatarData(p.saida_em)}</td></tr>)}</tbody></table></div></div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-[#0f1c2e] border border-blue-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Transferencias</p><p className="text-3xl font-bold text-blue-300 mt-1">{transferencias.length}</p></div>
                    <div className="bg-[#0f1c2e] border border-emerald-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Filtradas</p><p className="text-3xl font-bold text-emerald-300 mt-1">{transferenciasFiltradas.length}</p></div>
                  </div>
                  <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 shadow-[0_0_30px_rgba(16,185,129,0.05)] overflow-hidden"><div className="max-h-[52vh] overflow-auto"><table className="min-w-full text-sm"><thead><tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10"><th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Veiculo</th><th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Origem</th><th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Destino</th><th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Motorista</th><th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Data / Hora</th><th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider">Responsavel</th></tr></thead><tbody className="divide-y divide-white/5">{transferenciasFiltradas.length === 0 ? <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhuma transferencia encontrada com os filtros atuais.</td></tr> : transferenciasFiltradas.map((t) => <tr key={t.id} className="hover:bg-emerald-500/5 transition-colors"><td className="px-6 py-4 whitespace-nowrap"><div className="font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-md inline-block">{t.placa}</div></td><td className="px-6 py-4 text-slate-300">{t.base_origem}</td><td className="px-6 py-4 text-slate-300">{t.base_destino}</td><td className="px-6 py-4 text-slate-400 font-medium">{t.motorista || <span className="text-slate-600 font-normal">Nao informado</span>}</td><td className="px-6 py-4 text-slate-400 text-xs">{formatarData(t.transferido_em)}</td><td className="px-6 py-4 text-slate-500 text-xs">{t.transferido_por || '—'}</td></tr>)}</tbody></table></div></div>
                  <div className="mt-4 text-right text-xs text-slate-500">Total de registros: {transferenciasFiltradas.length}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </RequirePermissao>
  )
}
