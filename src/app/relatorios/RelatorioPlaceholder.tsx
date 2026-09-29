'use client'

import RequirePermissao from '@/components/RequirePermissao'
import Sidebar from '@/components/Sidebar'
import type { Permissao } from '@/lib/roles'

type RelatorioPlaceholderProps = {
  permissao: Permissao
  titulo: string
  descricao: string
}

export default function RelatorioPlaceholder({
  permissao,
  titulo,
  descricao,
}: RelatorioPlaceholderProps) {
  return (
    <RequirePermissao permissao={permissao}>
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <main className="flex-1 min-h-screen overflow-y-auto bg-[#0a1625]">
          <section className="p-4 md:p-6">
            <div className="max-w-5xl rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-6 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
                Relatorios
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">{titulo}</h2>
              <p className="mt-2 text-sm text-slate-400">
                {descricao}
              </p>
            </div>
          </section>
        </main>
      </div>
    </RequirePermissao>
  )
}
