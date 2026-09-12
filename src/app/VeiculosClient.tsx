'use client'

import { useState } from 'react'

type Veiculo = {
  NR_PLACA: string
  DS_MODELO: string | null
  DS_MARCA: string | null
  NR_ANO_MODELO: number | null
  DS_COR: string | null
  DS_CHASSI: string | null
  DS_COMBUSTIVEL: string | null
  DS_TIPOVEICULO: string | null
}

export default function VeiculosClient({ veiculos }: { veiculos: Veiculo[] }) {
  const [busca, setBusca] = useState('')

  const veiculosFiltrados = veiculos.filter((v) =>
    v.NR_PLACA?.toLowerCase().includes(busca.toLowerCase()) ||
    v.DS_MODELO?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <>
      {/* Banner */}
      <div className="relative h-28 md:h-36 shrink-0 overflow-hidden">
        <img
          src="/images/banner-frota3.jpg"
          alt="Filtroamb"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1625]/85 via-[#0a1625]/50 to-[#0a1625]/20" />
        <div data-banner className="absolute inset-0 flex items-end pb-4 px-8">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight drop-shadow">
              FiltroAmb - Frota Ativa
            </h1>
            <p className="text-sm text-emerald-300 mt-0.5 drop-shadow">
              Controle de Frota
            </p>
          </div>
        </div>
      </div>
      {/* Banner */}

      <header className="bg-[#0b1f33] border-b border-emerald-500/20 shrink-0">
        <div className="px-8 py-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Veículos</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {veiculosFiltrados.length} de {veiculos.length} veículos
            </p>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por placa ou modelo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-72 pl-10 pr-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/50 transition"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/70 text-sm">🔍</span>
          </div>
        </div>
      </header>

      <main className="animate-tab flex-1 min-h-0 overflow-hidden p-6 bg-[#0a1625]" style={{ zoom: 0.80 }}>
        <div className="flex h-full min-h-0 flex-col bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 shadow-[0_0_30px_rgba(16,185,129,0.05)] overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">


            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="sticky top-0 z-10 bg-[#132337] border-b border-emerald-500/15">
                  <th className="px-4 py-3.5 text-center text-lg font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Placa</th>
                  <th className="px-4 py-3.5 text-center text-lg font-semibold text-emerald-400/90 uppercase tracking-wider">Modelo</th>
                  <th className="px-4 py-3.5 text-center text-lg font-semibold text-emerald-400/90 uppercase tracking-wider">Marca</th>
                  <th className="px-4 py-3.5 text-center text-lg font-semibold text-emerald-400/90 uppercase tracking-wider">Ano</th>
                  <th className="px-4 py-3.5 text-center text-lg font-semibold text-emerald-400/90 uppercase tracking-wider">Cor</th>
                  <th className="px-4 py-3.5 text-center text-lg font-semibold text-emerald-400/90 uppercase tracking-wider">Combustível</th>
                  <th className="px-4 py-3.5 text-center text-lg font-semibold text-emerald-400/90 uppercase tracking-wider">Setor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {veiculosFiltrados.map((v, index) => (
                  <tr
                    key={`${v.NR_PLACA}-${index}`}
                    className="hover:bg-emerald-500/5 transition-colors"
                  >
                    <td className="px-4 py-3.5 text-center font-medium text-emerald-300 whitespace-nowrap">{v.NR_PLACA}</td>
                    <td className="px-4 py-3.5 text-center text-slate-300">{v.DS_MODELO || '—'}</td>
                    <td className="px-4 py-3.5 text-center text-slate-300">{v.DS_MARCA || '—'}</td>
                    <td className="px-4 py-3.5 text-center text-slate-400">{v.NR_ANO_MODELO || '—'}</td>
                    <td className="px-4 py-3.5 text-center text-slate-400">{v.DS_COR || '—'}</td>
                    <td className="px-4 py-3.5 text-center text-slate-400">{v.DS_COMBUSTIVEL || '—'}</td>
                    <td className="px-4 py-3.5 text-center text-slate-400">{v.DS_TIPOVEICULO || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {veiculosFiltrados.length === 0 && (
            <div className="py-16 text-center text-slate-500 text-sm">
              Nenhum veículo encontrado.
            </div>
          )}
        </div>
      </main>
    </>
  )
}
