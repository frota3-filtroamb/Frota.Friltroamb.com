'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

type Encomenda = {
  id: number
  item: string
  loja_remetente: string
  destinatario: string
  recebido_em: string | null
  recebido_por: string | null
  status: string
  entregue_em: string | null
}

export default function EncomendasPage() {
  const supabase = createClient()
  
  const [encomendas, setEncomendas] = useState<Encomenda[]>([])
  const [historico, setHistorico] = useState<Encomenda[]>([])
  
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [busca, setBusca] = useState('')

  // Form states
  const [item, setItem] = useState('')
  const [loja, setLoja] = useState('')
  const [destinatario, setDestinatario] = useState('')
  const [dataHora, setDataHora] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setCarregando(true)
    try {
      const [ativos, finais] = await Promise.all([
        supabase.from('encomendas').select('*').eq('status', 'aguardando_retirada').order('recebido_em', { ascending: false }),
        supabase.from('encomendas').select('*').eq('status', 'entregue').order('entregue_em', { ascending: false }).limit(30)
      ])

      setEncomendas(ativos.data || [])
      setHistorico(finais.data || [])
    } catch (e) {
      setMensagem('Erro ao carregar dados. A tabela encomendas existe?')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!item || !destinatario) {
      setMensagem('Preencha o Item e o Destinatário')
      return
    }

    setSalvando(true)
    setMensagem('')

    const { error } = await supabase.from('encomendas').insert({
      item,
      loja_remetente: loja || null,
      destinatario,
      status: 'aguardando_retirada',
      recebido_por: 'Gestor (Portaria)',
      recebido_em: dataHora ? new Date(dataHora).toISOString() : new Date().toISOString(),
    })

    setSalvando(false)

    if (error) {
      setMensagem('Erro ao registrar encomenda: ' + error.message)
      return
    }

    setMensagem('Encomenda recebida com sucesso!')
    setItem('')
    setLoja('')
    setDestinatario('')
    setDataHora('')
    carregar()
  }

  async function registrarEntrega(id: number) {
    const { error } = await supabase.from('encomendas').update({ 
      status: 'entregue', 
      entregue_em: new Date().toISOString() 
    }).eq('id', id)
    
    if (error) setMensagem('Erro ao entregar: ' + error.message)
    else { setMensagem('Encomenda entregue!'); carregar() }
  }

  function formatarData(data: string | null) {
    if (!data) return '—'
    return new Date(data).toLocaleString('pt-BR')
  }

  const aguardando = encomendas.length
  const entreguesHoje = historico.filter((e) => e.entregue_em && new Date(e.entregue_em).toDateString() === new Date().toDateString()).length

  const eFiltradas = encomendas.filter((e) => 
    e.item?.toLowerCase().includes(busca.toLowerCase()) || 
    e.destinatario?.toLowerCase().includes(busca.toLowerCase()) || 
    e.loja_remetente?.toLowerCase().includes(busca.toLowerCase())
  )

  const hFiltrado = historico.filter((e) => 
    e.item?.toLowerCase().includes(busca.toLowerCase()) || 
    e.destinatario?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <RequirePermissao permissao="encomendas">
    <div className="min-h-screen flex bg-[#0a1625]">
      <Sidebar />

      <div className="flex-1 ml-14 flex flex-col h-screen overflow-hidden">
        {/* Banner */}
        <div className="relative h-28 md:h-36 shrink-0 overflow-hidden">
          <img src="/images/banner-frota.jpg" alt="Filtroamb" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1625]/90 via-[#0a1625]/60 to-[#0a1625]/20" />
          <div data-banner className="absolute inset-0 flex items-end pb-4 px-8">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight drop-shadow flex items-center gap-2">
                <span>📦</span> Recebimento de Encomendas
              </h1>
              <p className="text-sm text-blue-300 mt-0.5 drop-shadow">
                Registre os pacotes recebidos na portaria e gerencie as retiradas
              </p>
            </div>
          </div>
        </div>

        {/* zoom da pagina */}
        <div className="flex-1 overflow-y-auto bg-[#0a1625]" style={{ zoom: 0.95 }}>
        <main className="animate-tab p-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Formulário de Recebimento */}
            <div className="bg-[#0f1c2e] rounded-2xl border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.05)] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 bg-[#132337]/60">
                <h2 className="text-base font-semibold text-white">Registrar Nova Encomenda</h2>
                <p className="text-xs text-slate-400 mt-0.5">Dê baixa nos itens que chegaram agora</p>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Item / Descrição *
                    </label>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => setItem(e.target.value)}
                      placeholder="Ex: Caixa pequena, Envelope, 2x Filtros"
                      className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Destinatário *
                    </label>
                    <input
                      type="text"
                      value={destinatario}
                      onChange={(e) => setDestinatario(e.target.value)}
                      placeholder="Para quem é? (Ex: João do TI, Marketing)"
                      className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Remetente / Loja
                    </label>
                    <input
                      type="text"
                      value={loja}
                      onChange={(e) => setLoja(e.target.value)}
                      placeholder="Ex: Mercado Livre, Correios, Fulano"
                      className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Data e Hora do Recebimento
                    </label>
                    <input
                      type="datetime-local"
                      value={dataHora}
                      onChange={(e) => setDataHora(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={salvando}
                    className="bg-blue-500 hover:bg-blue-400 text-white font-semibold px-6 py-2.5 rounded-xl transition shadow-[0_0_15px_rgba(59,130,246,0.25)] disabled:opacity-40"
                  >
                    {salvando ? 'Registrando...' : 'Registrar Recebimento'}
                  </button>
                </div>
              </form>
            </div>

            {mensagem && (
              <div className={`p-4 rounded-xl text-sm border ${mensagem.includes('Erro') ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                {mensagem}
              </div>
            )}

            {/* Dashboards Rápidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Retirada</p>
                    <p className="text-3xl font-bold text-orange-300 mt-1">{aguardando}</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-orange-500/15 flex items-center justify-center text-xl">📦</div>
                </div>
              </div>
              <div className="bg-[#0f1c2e] border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Entregues Hoje</p>
                    <p className="text-3xl font-bold text-emerald-300 mt-1">{entreguesHoje}</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center text-xl">✅</div>
                </div>
              </div>
            </div>

            {/* Listas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white tracking-tight">Controle</h3>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar pacote ou nome..."
                  className="w-64 px-4 py-2 bg-[#132337] border border-blue-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition"
                />
              </div>

              {/* Tabela Aguardando */}
              <div className="bg-[#0f1c2e] rounded-2xl border border-orange-500/20 overflow-hidden">
                <div className="px-5 py-3 border-b border-orange-500/10 bg-orange-500/5">
                  <h4 className="text-sm font-semibold text-orange-300">Aguardando Retirada</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#132337]/50 border-b border-white/5">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Item / Loja</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Destinatário</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Recebido em</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {carregando ? (
                        <>
                          <tr className="animate-pulse">
                            <td colSpan={4} className="px-5 py-4">
                              <div className="h-6 rounded-lg bg-white/5" />
                            </td>
                          </tr>
                          <tr className="animate-pulse">
                            <td colSpan={4} className="px-5 py-4">
                              <div className="h-6 rounded-lg bg-white/5" />
                            </td>
                          </tr>
                          <tr className="animate-pulse">
                            <td colSpan={4} className="px-5 py-4">
                              <div className="h-6 rounded-lg bg-white/5" />
                            </td>
                          </tr>
                        </>
                      ) : eFiltradas.length === 0 ? (
                        <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">Nenhuma encomenda aguardando.</td></tr>
                      ) : (
                        eFiltradas.map((e) => (
                          <tr key={e.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-5 py-3">
                              <div className="font-medium text-white">{e.item}</div>
                              <div className="text-xs text-slate-400">{e.loja_remetente || 'Remetente não informado'}</div>
                            </td>
                            <td className="px-5 py-3 text-blue-300 font-medium">{e.destinatario}</td>
                            <td className="px-5 py-3 text-slate-400 text-xs">{formatarData(e.recebido_em)}</td>
                            <td className="px-5 py-3">
                              <button onClick={() => registrarEntrega(e.id)} className="bg-emerald-500 hover:bg-emerald-400 text-[#0a1625] text-xs font-bold px-3 py-1.5 rounded-lg transition">
                                Marcar Entregue
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabela Entregues (Histórico) */}
              <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 overflow-hidden mt-6">
                <div className="px-5 py-3 border-b border-emerald-500/10 bg-emerald-500/5">
                  <h4 className="text-sm font-semibold text-emerald-300">Histórico de Entregas</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#132337]/50 border-b border-white/5">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Item / Loja</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Destinatário</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Chegou</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Entregue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {hFiltrado.length === 0 ? (
                        <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">Nenhum histórico.</td></tr>
                      ) : (
                        hFiltrado.map((e) => (
                          <tr key={e.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-5 py-3">
                              <div className="font-medium text-white">{e.item}</div>
                              <div className="text-xs text-slate-400">{e.loja_remetente || 'Remetente não informado'}</div>
                            </td>
                            <td className="px-5 py-3 text-blue-300">{e.destinatario}</td>
                            <td className="px-5 py-3 text-slate-500 text-xs">{formatarData(e.recebido_em)}</td>
                            <td className="px-5 py-3 text-emerald-400/80 text-xs font-medium">{formatarData(e.entregue_em)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
