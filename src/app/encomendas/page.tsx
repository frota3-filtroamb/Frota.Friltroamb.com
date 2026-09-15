'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

type AbaEncomenda = 'registrar_encomenda' | 'registrar_entrega'

type Encomenda = {
  id: number
  item: string
  loja_remetente: string | null
  destinatario: string
  recebido_em: string | null
  recebido_por: string | null
  status: string
  entregue_em: string | null
}

export default function EncomendasPage() {
  const supabase = createClient()

  const [abaAtual, setAbaAtual] = useState<AbaEncomenda>('registrar_encomenda')
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

  async function carregar() {
    setCarregando(true)
    try {
      const [ativos, finais] = await Promise.all([
        supabase.from('encomendas').select('*').eq('status', 'aguardando_retirada').order('recebido_em', { ascending: false }),
        supabase.from('encomendas').select('*').eq('status', 'entregue').order('entregue_em', { ascending: false }).limit(80),
      ])

      setEncomendas(ativos.data || [])
      setHistorico(finais.data || [])
    } catch {
      setMensagem('Erro ao carregar dados. A tabela encomendas existe?')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

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

    if (abaAtual !== 'registrar_entrega' || !codigo) return remetente || null
    return `${remetente || 'Sem remetente'} | Codigo: ${codigo}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!item.trim() || !destinatario.trim()) {
      setMensagem('Preencha o item e o destinatario')
      return
    }

    if (abaAtual === 'registrar_entrega' && !codigoPalavraChave.trim()) {
      setMensagem('Preencha o codigo/palavra-chave')
      return
    }

    const dataRegistro = dataHora ? new Date(dataHora).toISOString() : new Date().toISOString()

    setSalvando(true)
    setMensagem('')

    const registroConcluido = abaAtual === 'registrar_encomenda'

    const { error } = await supabase.from('encomendas').insert({
      item: item.trim(),
      loja_remetente: montarRemetente(),
      destinatario: destinatario.trim(),
      status: registroConcluido ? 'entregue' : 'aguardando_retirada',
      recebido_por: abaAtual === 'registrar_entrega' ? 'Gestor (Entrega)' : 'Gestor (Portaria)',
      recebido_em: dataRegistro,
      entregue_em: registroConcluido ? dataRegistro : null,
    })

    setSalvando(false)

    if (error) {
      setMensagem('Erro ao registrar: ' + error.message)
      return
    }

    setMensagem(abaAtual === 'registrar_entrega' ? 'Entrega registrada em aberto.' : 'Encomenda registrada no historico de entregas.')
    limparFormulario()
    carregar()
  }

  async function registrarEntregaAntiga(id: number) {
    const { error } = await supabase.from('encomendas').update({
      status: 'entregue',
      entregue_em: new Date().toISOString(),
    }).eq('id', id)

    if (error) setMensagem('Erro ao entregar: ' + error.message)
    else {
      setMensagem('Pendencia antiga marcada como entregue.')
      carregar()
    }
  }

  function formatarData(data: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  const textoFiltro = busca.toLowerCase()
  const entreguesHoje = historico.filter((e) => e.entregue_em && new Date(e.entregue_em).toDateString() === new Date().toDateString()).length
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

  const tituloFormulario = abaAtual === 'registrar_entrega' ? 'Registrar Entrega' : 'Registrar Encomenda'
  const subtituloFormulario = abaAtual === 'registrar_entrega'
    ? 'Registre a entrada da encomenda e deixe pendente para retirada'
    : 'Registre a encomenda diretamente no historico de entregas'

  return (
    <RequirePermissao permissao="encomendas">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
          <div className="relative h-28 md:h-36 shrink-0 overflow-hidden">
            <img src="/images/banner-frota3.jpg" alt="Filtroamb" className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1625]/90 via-[#0a1625]/60 to-[#0a1625]/20" />
            <div data-banner className="absolute inset-0 flex items-end pb-4 px-8">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight drop-shadow">Encomendas</h1>
                <p className="text-sm text-blue-300 mt-0.5 drop-shadow">Registro e historico de entregas da portaria</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#0a1625]" style={{ zoom: 0.95 }}>
            <main className="animate-tab p-6">
              <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-wrap gap-3 bg-[#132337] border border-blue-500/20 rounded-xl p-1.5 w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setAbaAtual('registrar_encomenda')
                      setMensagem('')
                    }}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 cursor-pointer ${abaAtual === 'registrar_encomenda' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Registrar Encomenda
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAbaAtual('registrar_entrega')
                      setMensagem('')
                    }}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 cursor-pointer ${abaAtual === 'registrar_entrega' ? 'bg-emerald-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Registrar Entrega
                  </button>
                </div>

                <div className="bg-[#0f1c2e] rounded-2xl border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.05)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5 bg-[#132337]/60">
                    <h2 className="text-base font-semibold text-white">{tituloFormulario}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{subtituloFormulario}</p>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Item / Descricao *</label>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => setItem(e.target.value)}
                          placeholder="Ex: Caixa pequena, Envelope, 2x Filtros"
                          className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Destinatario *</label>
                        <input
                          type="text"
                          value={destinatario}
                          onChange={(e) => setDestinatario(e.target.value)}
                          placeholder="Para quem e? Ex: Joao do TI"
                          className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Remetente / Loja</label>
                        <input
                          type="text"
                          value={loja}
                          onChange={(e) => setLoja(e.target.value)}
                          placeholder="Ex: Mercado Livre, Correios, Fulano"
                          className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Data e Hora</label>
                        <input
                          type="datetime-local"
                          value={dataHora}
                          onChange={(e) => setDataHora(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                        />
                      </div>

                      {abaAtual === 'registrar_entrega' && (
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Codigo / Palavra-chave *</label>
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
                        className="bg-blue-500 hover:bg-blue-400 text-white font-semibold px-6 py-2.5 rounded-xl transition shadow-[0_0_15px_rgba(59,130,246,0.25)] disabled:opacity-40"
                      >
                        {salvando ? 'Registrando...' : tituloFormulario}
                      </button>
                    </div>
                  </form>
                </div>

                {mensagem && (
                  <div className={`p-4 rounded-xl text-sm border ${mensagem.includes('Erro') ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                    {mensagem}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#0f1c2e] border border-emerald-500/20 rounded-2xl p-5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Entregues Hoje</p>
                    <p className="text-3xl font-bold text-emerald-300 mt-1">{entreguesHoje}</p>
                  </div>
                  <div className="bg-[#0f1c2e] border border-blue-500/20 rounded-2xl p-5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Historico</p>
                    <p className="text-3xl font-bold text-blue-300 mt-1">{historico.length}</p>
                  </div>
                  <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Entregas em Aberto</p>
                    <p className="text-3xl font-bold text-orange-300 mt-1">{encomendas.length}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white tracking-tight">Entregas em Aberto</h3>
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Pesquisar pacote, nome ou codigo..."
                      className="w-full max-w-sm px-4 py-2 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                    />
                  </div>

                  <div className="bg-[#0f1c2e] rounded-2xl border border-orange-500/20 overflow-hidden">
                    <div className="max-h-[52vh] overflow-y-auto overflow-x-hidden">
                      <table className="w-full table-fixed text-sm">
                        <thead>
                          <tr className="bg-[#132337]/70 border-b border-white/5 sticky top-0 z-10">
                            <th className="w-[23%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Item</th>
                            <th className="w-[23%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Loja / Remetente</th>
                            <th className="w-[20%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Destinatario</th>
                            <th className="w-[19%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Data de previsão</th>
                            <th className="w-[15%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {carregando ? (
                            <tr className="animate-pulse">
                              <td colSpan={5} className="px-5 py-4"><div className="h-6 rounded-lg bg-white/5" /></td>
                            </tr>
                          ) : pendenciasFiltradas.length === 0 ? (
                            <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Nenhuma entrega em aberto.</td></tr>
                          ) : (
                            pendenciasFiltradas.map((encomenda) => (
                              <tr key={encomenda.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 text-center font-medium text-white truncate">{encomenda.item}</td>
                                <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{encomenda.loja_remetente || 'Remetente nao informado'}</td>
                                <td className="px-4 py-3 text-center font-medium text-blue-300 truncate">{encomenda.destinatario}</td>
                                <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{formatarData(encomenda.recebido_em)}</td>
                                <td className="px-4 py-3 text-center">
                                  <button onClick={() => registrarEntregaAntiga(encomenda.id)} className="bg-emerald-500 hover:bg-emerald-400 text-[#0a1625] text-xs font-bold px-3 py-1.5 rounded-lg transition">
                                    Entregue
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-2">
                    <h3 className="text-lg font-semibold text-white tracking-tight mb-4">Historico de Entregas</h3>
                    <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 overflow-hidden">
                      <div className="max-h-[52vh] overflow-y-auto overflow-x-hidden">
                        <table className="w-full table-fixed text-sm">
                          <thead>
                            <tr className="bg-[#132337]/70 border-b border-white/5 sticky top-0 z-10">
                              <th className="w-[24%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Item</th>
                              <th className="w-[24%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Loja / Remetente</th>
                              <th className="w-[20%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Destinatario</th>
                              <th className="w-[16%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Recebido</th>
                              <th className="w-[16%] px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Entregue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {carregando ? (
                              <tr className="animate-pulse">
                                <td colSpan={5} className="px-5 py-4"><div className="h-6 rounded-lg bg-white/5" /></td>
                              </tr>
                            ) : historicoFiltrado.length === 0 ? (
                              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Nenhum historico.</td></tr>
                            ) : (
                              historicoFiltrado.map((encomenda) => (
                                <tr key={encomenda.id} className="hover:bg-white/5 transition-colors">
                                  <td className="px-4 py-3 text-center font-medium text-white truncate">{encomenda.item}</td>
                                  <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{encomenda.loja_remetente || 'Remetente nao informado'}</td>
                                  <td className="px-4 py-3 text-center font-medium text-blue-300 truncate">{encomenda.destinatario}</td>
                                  <td className="px-4 py-3 text-center text-slate-400 text-xs truncate">{formatarData(encomenda.recebido_em)}</td>
                                  <td className="px-4 py-3 text-center text-emerald-400/80 text-xs font-medium truncate">{formatarData(encomenda.entregue_em)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </RequirePermissao>
  )
}
