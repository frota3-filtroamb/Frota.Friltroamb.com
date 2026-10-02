'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

type AbaEncomenda = 'avisar_encomenda' | 'portaria' | 'historico'

type Encomenda = {
  id: number
  item: string
  loja_remetente: string | null
  destinatario: string
  recebido_em: string | null
  recebido_por: string | null
  status: string
  entregue_em: string | null
  retirado_por: string | null
}

export default function EncomendasPage() {
  const supabase = useMemo(() => createClient(), [])

  const [abaAtual, setAbaAtual] = useState<AbaEncomenda>('portaria')
  const [previstas, setPrevistas] = useState<Encomenda[]>([])
  const [encomendas, setEncomendas] = useState<Encomenda[]>([])
  const [historico, setHistorico] = useState<Encomenda[]>([])

  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [busca, setBusca] = useState('')

  const [item, setItem] = useState('')
  const [loja, setLoja] = useState('')
  const [destinatario, setDestinatario] = useState('')
  const [codigoPalavraChave, setCodigoPalavraChave] = useState('')
  const [dataHora, setDataHora] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmandoChegadaId, setConfirmandoChegadaId] = useState<number | null>(null)
  const [confirmandoRetiradaId, setConfirmandoRetiradaId] = useState<number | null>(null)
  const [retiradoPor, setRetiradoPor] = useState('')

  const carregar = useCallback(async function carregar() {
    setCarregando(true)
    try {
      const [avisos, pendentes, finais] = await Promise.all([
        supabase.from('encomendas').select('*').eq('status', 'prevista').order('recebido_em', { ascending: true }),
        supabase.from('encomendas').select('*').eq('status', 'aguardando_retirada').order('recebido_em', { ascending: false }),
        supabase.from('encomendas').select('*').eq('status', 'entregue').order('entregue_em', { ascending: false }).limit(80),
      ])

      setPrevistas(avisos.data || [])
      setEncomendas(pendentes.data || [])
      setHistorico(finais.data || [])
    } catch {
      setMensagem('Erro ao carregar dados. A tabela encomendas existe?')
    } finally {
      setCarregando(false)
    }
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  function limparFormulario() {
    setItem('')
    setLoja('')
    setDestinatario('')
    setCodigoPalavraChave('')
    setDataHora('')
  }

  function montarRemetente() {
    const remetente = loja.trim()
    const codigo = codigoPalavraChave.trim()

    if (abaAtual !== 'avisar_encomenda' || !codigo) return remetente || null
    return `${remetente || 'Sem remetente'} | Codigo: ${codigo}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!item.trim() || !destinatario.trim()) {
      setMensagem('Preencha o item e o destinatario')
      return
    }

    setSalvando(true)
    setMensagem('')

    const avisoEntrega = abaAtual === 'avisar_encomenda'
    try {
      const resposta = await fetch('/api/encomendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'registrar',
          tipo_registro: avisoEntrega ? 'aviso_entrega' : 'chegada_portaria',
          item: item.trim(),
          loja_remetente: montarRemetente(),
          destinatario: destinatario.trim(),
          data: dataHora || null,
        }),
      })
      const resultado = await resposta.json()
      if (!resposta.ok) throw new Error(resultado.error || 'Erro ao registrar.')

      setMensagem(resultado.mensagem || 'Registro salvo.')
      limparFormulario()
      carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? 'Erro ao registrar: ' + error.message : 'Erro ao registrar.')
    } finally {
      setSalvando(false)
    }
  }

  function abrirConfirmacaoChegada(id: number) {
    setMensagem('')
    setConfirmandoRetiradaId(null)
    setRetiradoPor('')
    setConfirmandoChegadaId(id)
  }

  function abrirConfirmacaoRetirada(id: number) {
    setMensagem('')
    setConfirmandoChegadaId(null)
    setRetiradoPor('')
    setConfirmandoRetiradaId(id)
  }

  function cancelarConfirmacao() {
    setConfirmandoChegadaId(null)
    setConfirmandoRetiradaId(null)
    setRetiradoPor('')
  }

  async function confirmarChegada(id: number) {
    try {
      const resposta = await fetch('/api/encomendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'confirmar_chegada', id }),
      })
      const resultado = await resposta.json()
      if (!resposta.ok) throw new Error(resultado.error || 'Erro ao confirmar chegada.')

      cancelarConfirmacao()
      setMensagem(resultado.mensagem || 'Chegada confirmada.')
      carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? 'Erro ao confirmar chegada: ' + error.message : 'Erro ao confirmar chegada.')
    }
  }

  async function registrarRetirada(id: number) {
    if (!retiradoPor.trim()) {
      setMensagem('Informe quem retirou a encomenda.')
      return
    }

    try {
      const resposta = await fetch('/api/encomendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'entregar', id, retirado_por: retiradoPor.trim() }),
      })
      const resultado = await resposta.json()
      if (!resposta.ok) throw new Error(resultado.error || 'Erro ao retirar.')

      cancelarConfirmacao()
      setMensagem(resultado.mensagem || 'Encomenda marcada como retirada.')
      carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? 'Erro ao retirar: ' + error.message : 'Erro ao retirar.')
    }
  }

  function formatarData(data: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  const textoFiltro = busca.toLowerCase()
  const entreguesHoje = historico.filter((e) => e.entregue_em && new Date(e.entregue_em).toDateString() === new Date().toDateString()).length
  const totalEmAberto = previstas.length + encomendas.length
  const historicoFiltrado = historico.filter((e) =>
    e.item?.toLowerCase().includes(textoFiltro) ||
    e.destinatario?.toLowerCase().includes(textoFiltro) ||
    e.loja_remetente?.toLowerCase().includes(textoFiltro)
  )
  const pendenciasFiltradas = encomendas.filter((e) =>
    e.item?.toLowerCase().includes(textoFiltro) ||
    e.destinatario?.toLowerCase().includes(textoFiltro) ||
    e.loja_remetente?.toLowerCase().includes(textoFiltro)
  )
  const previstasFiltradas = previstas.filter((e) =>
    e.item?.toLowerCase().includes(textoFiltro) ||
    e.destinatario?.toLowerCase().includes(textoFiltro) ||
    e.loja_remetente?.toLowerCase().includes(textoFiltro)
  )
  const encomendaConfirmandoChegada = previstas.find((encomenda) => encomenda.id === confirmandoChegadaId) || null
  const encomendaConfirmandoRetirada = encomendas.find((encomenda) => encomenda.id === confirmandoRetiradaId) || null

  const exibindoHistorico = abaAtual === 'historico'
  const exibindoPortaria = abaAtual === 'portaria'
  const exibindoFormulario = abaAtual === 'avisar_encomenda' || abaAtual === 'portaria'
  const tituloFormulario = abaAtual === 'avisar_encomenda' ? 'Avisar Encomenda' : 'Registrar Chegada Sem Aviso'
  const subtituloFormulario = abaAtual === 'avisar_encomenda'
    ? 'Avise a portaria sobre uma encomenda que ainda vai chegar'
    : 'Registre uma encomenda que chegou na portaria e deixe em aberto para retirada'

  function renderTabelasEmAberto(comAcoes: boolean) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-white tracking-tight">Previstas para ser entregues na portaria</h3>
          <div className="bg-[#0f1c2e] rounded-2xl border border-blue-500/20 overflow-hidden">
            <div className="app-scroll max-h-[34vh] overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="bg-[#132337]/70 border-b border-white/5 sticky top-0 z-10">
                    <th className="w-[24%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Item</th>
                    <th className="w-[24%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Loja / Remetente</th>
                    <th className="w-[20%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Destinatario</th>
                    <th className="w-[17%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Previsao</th>
                    <th className="w-[15%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Chegada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {carregando ? (
                    <tr className="animate-pulse">
                      <td colSpan={5} className="px-5 py-4"><div className="h-6 rounded-lg bg-white/5" /></td>
                    </tr>
                  ) : previstasFiltradas.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Nenhuma encomenda prevista.</td></tr>
                  ) : (
                    previstasFiltradas.map((encomenda) => (
                      <tr key={encomenda.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-center font-medium text-white truncate">{encomenda.item}</td>
                        <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{encomenda.loja_remetente || 'Remetente nao informado'}</td>
                        <td className="px-4 py-3 text-center font-medium text-blue-300 truncate">{encomenda.destinatario}</td>
                        <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{formatarData(encomenda.recebido_em)}</td>
                        <td className="px-4 py-3 text-center">
                          {comAcoes ? (
                            <button onClick={() => abrirConfirmacaoChegada(encomenda.id)} className="cursor-pointer bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                              Confirmar
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-blue-300">Pendente</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold text-white tracking-tight">Aguardando retirada do destinatário</h3>
          <div className="bg-[#0f1c2e] rounded-2xl border border-orange-500/20 overflow-hidden">
            <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="bg-[#132337]/70 border-b border-white/5 sticky top-0 z-10">
                    <th className="w-[23%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Item</th>
                    <th className="w-[23%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Loja / Remetente</th>
                    <th className="w-[20%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Destinatario</th>
                    <th className="w-[19%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Chegada / Previsao</th>
                    <th className="w-[15%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Retirada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {carregando ? (
                    <tr className="animate-pulse">
                      <td colSpan={5} className="px-5 py-4"><div className="h-6 rounded-lg bg-white/5" /></td>
                    </tr>
                  ) : pendenciasFiltradas.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Nenhuma encomenda em aberto.</td></tr>
                  ) : (
                    pendenciasFiltradas.map((encomenda) => (
                      <tr key={encomenda.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-center font-medium text-white truncate">{encomenda.item}</td>
                        <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{encomenda.loja_remetente || 'Remetente nao informado'}</td>
                        <td className="px-4 py-3 text-center font-medium text-blue-300 truncate">{encomenda.destinatario}</td>
                        <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{formatarData(encomenda.recebido_em)}</td>
                        <td className="px-4 py-3 text-center">
                          {comAcoes ? (
                            <button onClick={() => abrirConfirmacaoRetirada(encomenda.id)} className="cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-[#0a1625] text-xs font-bold px-3 py-1.5 rounded-lg transition">
                              Retirado
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-orange-300">Aguardando</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <RequirePermissao permissao="encomendas">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <div className="app-scroll flex-1 overflow-y-auto bg-[#0a1625]" style={{ zoom: 0.95 }}>
            <main className="animate-tab px-4 py-6 md:px-8 xl:px-14">
              <div className="w-full space-y-6">
                <div className="flex flex-col gap-2 rounded-xl border border-blue-500/20 bg-[#132337] p-1.5 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAbaAtual('avisar_encomenda')
                      setMensagem('')
                    }}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'avisar_encomenda' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    Avisar Encomenda
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAbaAtual('portaria')
                      setMensagem('')
                    }}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'portaria' ? 'bg-emerald-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    Portaria
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAbaAtual('historico')
                      setMensagem('')
                    }}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'historico' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    Historico
                  </button>
                  <div className="hidden h-8 border-l border-blue-500/20 sm:block" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Pesquisar pacote, nome ou codigo..."
                    className="w-full min-w-0 flex-1 rounded-lg border border-blue-500/20 bg-[#0f1c2e] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-blue-400/40 sm:max-w-sm"
                  />
                </div>

                {exibindoFormulario && (
                  <div className="bg-[#0f1c2e] rounded-2xl border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.05)] overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 bg-[#132337]/60">
                      <h2 className="text-base font-semibold text-white">{tituloFormulario}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{subtituloFormulario}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Item / Descrição da encomenda *</label>
                          <input

                            type="text"
                            value={item}
                            onChange={(e) => setItem(e.target.value)}
                            placeholder="Ex: Caixa pequena, Envelope, Cartas"
                            className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Destinatario *</label>
                          <input
                            type="text"
                            value={destinatario}
                            onChange={(e) => setDestinatario(e.target.value)}
                            placeholder="Para quem é? Ex: Joao, Setor Oluc"
                            className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Remetente / Loja / Entregador</label>
                          <input
                            type="text"
                            value={loja}
                            onChange={(e) => setLoja(e.target.value)}
                            placeholder="Ex: Mercado Livre, Correios, Amazon"
                            className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{abaAtual === 'avisar_encomenda' ? 'Previsao De Entrega' : 'Data e Hora Da Chegada'}</label>
                          <input
                            type="datetime-local"
                            value={dataHora}
                            onChange={(e) => setDataHora(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                          />
                        </div>

                        {abaAtual === 'avisar_encomenda' && (
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Codigo / Palavra-chave</label>
                            <input
                              type="text"
                              value={codigoPalavraChave}
                              onChange={(e) => setCodigoPalavraChave(e.target.value)}
                              placeholder="Ex: PIN, protocolo, palavra combinada"
                              className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                            />
                          </div>
                        )}
                      </div>

                      <div className="mt-6">
                        <button
                          type="submit"
                          disabled={salvando}
                          className="cursor-pointer bg-blue-500 hover:bg-blue-400 text-white font-semibold px-6 py-2.5 rounded-xl transition shadow-[0_0_15px_rgba(59,130,246,0.25)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {salvando ? 'Registrando...' : tituloFormulario}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {mensagem && (
                  <div className={`p-4 rounded-xl text-sm border ${mensagem.includes('Erro') ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                    {mensagem}
                  </div>
                )}

                {exibindoHistorico && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[#0f1c2e] border border-emerald-500/20 rounded-2xl p-5">
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Retiradas Hoje</p>
                      <p className="text-3xl font-bold text-emerald-300 mt-1">{entreguesHoje}</p>
                    </div>
                    <div className="bg-[#0f1c2e] border border-blue-500/20 rounded-2xl p-5">
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Historico</p>
                      <p className="text-3xl font-bold text-blue-300 mt-1">{historico.length}</p>
                    </div>
                    <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5">
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Em Aberto</p>
                      <p className="text-3xl font-bold text-orange-300 mt-1">{totalEmAberto}</p>
                    </div>
                  </div>
                )}
                {exibindoPortaria && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white tracking-tight">Controle da Portaria</h3>
                    {renderTabelasEmAberto(true)}
                  </div>
                )}

                {exibindoHistorico && (
                  <div className="space-y-4">
                    {renderTabelasEmAberto(false)}
                    <div className="pt-2">
                      <h3 className="text-lg font-semibold text-white tracking-tight mb-4">Historico de Encomendas</h3>
                      <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 overflow-hidden">
                        <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-hidden">
                          <table className="w-full table-fixed text-sm">
                            <thead>
                              <tr className="bg-[#132337]/70 border-b border-white/5 sticky top-0 z-10">
                                <th className="w-[20%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Item</th>
                                <th className="w-[20%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Loja / Remetente</th>
                                <th className="w-[18%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Destinatario</th>
                                <th className="w-[14%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Recebido</th>
                                <th className="w-[14%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Retirado</th>
                                <th className="w-[14%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Retirado por</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {carregando ? (
                                <tr className="animate-pulse">
                                  <td colSpan={6} className="px-5 py-4"><div className="h-6 rounded-lg bg-white/5" /></td>
                                </tr>
                              ) : historicoFiltrado.length === 0 ? (
                                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">Nenhum historico.</td></tr>
                              ) : (
                                historicoFiltrado.map((encomenda) => (
                                  <tr key={encomenda.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 text-center font-medium text-white truncate">{encomenda.item}</td>
                                    <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{encomenda.loja_remetente || 'Remetente nao informado'}</td>
                                    <td className="px-4 py-3 text-center font-medium text-blue-300 truncate">{encomenda.destinatario}</td>
                                    <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{formatarData(encomenda.recebido_em)}</td>
                                    <td className="px-4 py-3 text-center text-emerald-400/80 text-xs font-medium truncate">{formatarData(encomenda.entregue_em)}</td>
                                    <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{encomenda.retirado_por || encomenda.recebido_por?.replace('Retirado por: ', '') || '-'}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>

      {(encomendaConfirmandoChegada || encomendaConfirmandoRetirada) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#132337] p-5 shadow-2xl">
            {encomendaConfirmandoChegada && (
              <>
                <h3 className="text-base font-semibold text-white">Confirmar chegada</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Confirma a chegada da encomenda &quot;{encomendaConfirmandoChegada.item}&quot;?
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelarConfirmacao}
                    className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmarChegada(encomendaConfirmandoChegada.id)}
                    className="cursor-pointer rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-400"
                  >
                    Confirmar chegada
                  </button>
                </div>
              </>
            )}

            {encomendaConfirmandoRetirada && (
              <>
                <h3 className="text-base font-semibold text-white">Confirmar retirada</h3>
                <label className="mt-3 flex flex-col gap-1 text-sm font-semibold text-slate-300">
                  Encomenda de &quot;{encomendaConfirmandoRetirada.destinatario}&quot; está sendo retirada por quem?
                  <input
                    type="text"
                    value={retiradoPor}
                    onChange={(e) => setRetiradoPor(e.target.value)}
                    autoFocus
                    placeholder="Nome de quem retirou"
                    className="mt-1 w-full rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-3 py-2 text-sm font-normal text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </label>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelarConfirmacao}
                    className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => registrarRetirada(encomendaConfirmandoRetirada.id)}
                    disabled={!retiradoPor.trim()}
                    className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirmar retirada
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </RequirePermissao>
  )
}
