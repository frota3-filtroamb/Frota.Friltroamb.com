'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

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

export default function TransferenciaPage() {
  const supabase = createClient()

  const [lista, setLista] = useState<Transferencia[]>([])
  const [busca, setBusca] = useState('')

  async function carregarDados() {
    const { data } = await supabase
      .from('transferencias')
      .select('*')
      .order('transferido_em', { ascending: false })
      .limit(100)
      
    if (data) setLista(data)
  }

  useEffect(() => {
    carregarDados()
  }, [])

  function formatarData(data: string | null) {
    if (!data) return '—'
    return new Date(data).toLocaleString('pt-BR')
  }

  const listaFiltrada = lista.filter((t) => {
    const texto = busca.toLowerCase()
    return (
      t.placa?.toLowerCase().includes(texto) ||
      t.base_origem?.toLowerCase().includes(texto) ||
      t.base_destino?.toLowerCase().includes(texto) ||
      t.motorista?.toLowerCase().includes(texto)
    )
  })

  return (
    <RequirePermissao permissao="transferencia">
    <div className="min-h-screen flex bg-[#0a1625]">
      <Sidebar />

      <div className="flex-1 ml-14 flex flex-col h-screen overflow-hidden">
        {/* Banner */}
        <div className="relative h-44 shrink-0 overflow-hidden">
          <img
            src="/images/banner-frota.jpg"
            alt="Filtroamb"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1625]/90 via-[#0a1625]/55 to-transparent" />
          <div data-banner className="absolute inset-0 flex items-end pb-5 px-8">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow">
                Histórico de Transferências
              </h1>
              <p className="text-sm text-emerald-300 mt-1 drop-shadow">
                Consulte as movimentações de bases da frota
              </p>
            </div>
          </div>
        </div>

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap gap-3 bg-[#132337] border border-emerald-500/20 rounded-xl p-1.5 w-fit mb-6">
              <Link
                href="/portaria"
                className="px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md cursor-pointer text-slate-400 hover:text-white"
              >
                Controle
              </Link>
              <Link
                href="/portaria"
                className="px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md cursor-pointer text-slate-400 hover:text-white"
              >
                Pedestres / Visitantes
              </Link>
              <button
                type="button"
                className="px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md cursor-pointer bg-blue-500 text-white shadow-sm"
              >
                Transferência
              </button>
            </div>

            {/* Header da Tabela */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Transferências Registradas
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Mostrando os últimos registros de movimentação
                </p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar placa, base, motorista..."
                  className="w-full sm:w-80 pl-10 pr-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition shadow-sm"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/70 text-sm">🔍</span>
              </div>
            </div>

            {/* Tabela Profissional */}
            <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 shadow-[0_0_30px_rgba(16,185,129,0.05)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-[#132337] border-b border-emerald-500/15">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Veículo</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Origem</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Destino</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Motorista</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Data / Hora</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {listaFiltrada.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <span className="text-3xl">📭</span>
                            <p>Nenhuma transferência encontrada com os filtros atuais.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      listaFiltrada.map((t) => (
                        <tr key={t.id} className="hover:bg-emerald-500/5 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-md inline-block whitespace-nowrap">
                              {t.placa}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                              {t.base_origem}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                              {t.base_destino}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400 font-medium">
                            {t.motorista || <span className="text-slate-600 font-normal">Não informado</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs">
                            {formatarData(t.transferido_em)}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {t.transferido_por || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-4 text-right text-xs text-slate-500">
              Total de registros: {listaFiltrada.length}
            </div>
          </div>
        </main>
      </div>
    </div>
    </RequirePermissao>
  )
}
