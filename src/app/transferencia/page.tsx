'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { useTopbarSearch } from '@/components/TopbarSearchProvider'
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

type TransferenciaMovimentacao = {
  id: number
  placa: string
  localizacao: string | null
  destino: string | null
  motorista: string | null
  observacao: string | null
  liberado_em: string | null
  liberado_por: string | null
}

export default function TransferenciaPage() {
  const supabase = useMemo(() => createClient(), [])

  const [lista, setLista] = useState<Transferencia[]>([])
  const { busca, setBusca } = useTopbarSearch()

  const carregarDados = useCallback(async function carregarDados() {
    const { data } = await supabase
      .from('TBL_MOVIMENTACOES')
      .select('id, placa, localizacao, destino, motorista, observacao, liberado_em, liberado_por')
      .eq('tipo_entidade', 'transferencia')
      .order('liberado_em', { ascending: false })
      .limit(100)

    if (data) {
      setLista((data as TransferenciaMovimentacao[]).map((t) => ({
        id: t.id,
        placa: t.placa,
        base_origem: t.localizacao || '',
        base_destino: t.destino || '',
        motorista: t.motorista,
        observacao: t.observacao,
        transferido_em: t.liberado_em,
        transferido_por: t.liberado_por,
      })))
    }
  }, [supabase])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  function formatarData(data: string | null) {
    if (!data) return '--'
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

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-[#132337] p-1.5 sm:flex-row sm:items-center">
                <Link
                  href="/portaria"
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  Controle
                </Link>
                <Link
                  href="/portaria"
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  Pedestres / Visitantes
                </Link>
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer bg-blue-500 text-white shadow-sm"
                >
                  Transferencia
                </button>
                <div className="hidden h-8 flex-1 border-l border-emerald-500/20 sm:block" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white tracking-tight">
                    Transferencias Registradas
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Mostrando os ultimos registros de movimentacao
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
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/70 text-sm">?</span>
                </div>
              </div>

              <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 shadow-[0_0_30px_rgba(16,185,129,0.05)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#132337] border-b border-emerald-500/15">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Veiculo</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Origem</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Destino</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Motorista</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Data / Hora</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Responsavel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {listaFiltrada.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <span className="text-3xl">--</span>
                              <p>Nenhuma transferencia encontrada com os filtros atuais.</p>
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
                              {t.motorista || <span className="text-slate-600 font-normal">Nao informado</span>}
                            </td>
                            <td className="px-6 py-4 text-slate-400 text-xs">
                              {formatarData(t.transferido_em)}
                            </td>
                            <td className="px-6 py-4 text-slate-500 text-xs">
                              {t.transferido_por || '--'}
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
