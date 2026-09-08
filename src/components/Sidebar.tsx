'use client'

import { useUser, UserButton } from '@clerk/nextjs'
import { getRole, podeAcessar } from '@/lib/roles'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import Link from 'next/link'

export default function Sidebar() {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const { user } = useUser()
  const role = getRole(user)
  const podeUsuarios = role === 'dev'

  const podeVeiculos = podeAcessar(user, 'veiculos')
  const podePortaria = podeAcessar(user, 'portaria')
  const podeLiberacao = podeAcessar(user, 'liberacao')
  const podeTransferencia = podeAcessar(user, 'transferencia')
  const podeEncomendas = podeAcessar(user, 'encomendas')

  const temSubmenuPortaria =
    podePortaria || podeLiberacao || podeTransferencia || podeEncomendas

  const [portariaAberta, setPortariaAberta] = useState(
    pathname === '/portaria' ||
      pathname === '/liberacao' ||
      pathname === '/transferencia' ||
      pathname === '/encomendas'
  )

  const ativo = (href: string) => pathname === href

  return (
    <aside className="w-64 bg-[#0b1f33] text-white flex flex-col fixed h-full z-20 border-r border-white/5">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img
            src={theme === 'dark' ? '/images/logo-filtroamb-dark.png' : '/images/logo-filtroamb.png'}
            alt="Filtroamb"
            className="h-13 w-auto object-contain"
          />
        </div>
        <p className="text-[15px] text-slate-400 mt-2">Gestão de Frota</p>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
          {role === 'dev' ? 'Dev' : role === 'gestor' ? 'Gestor' : 'Porteiro'}
        </p>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Menu
        </p>

        {podeVeiculos && (
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              ativo('/')
                ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="text-base">🚚</span>
            <span>Veículos</span>
          </Link>
        )}

        {temSubmenuPortaria && (
          <div>
            <button
              type="button"
              onClick={() => setPortariaAberta(!portariaAberta)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                pathname === '/portaria' ||
                pathname === '/liberacao' ||
                pathname === '/encomendas' ||
                pathname === '/transferencia'
                  ? 'bg-emerald-500/10 text-emerald-300 font-medium'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="text-base">🚪</span>
                <span>Portaria</span>
              </span>
              <span className={`text-xs transition-transform ${portariaAberta ? 'rotate-90' : ''}`}>
                ▶
              </span>
            </button>

            {portariaAberta && (
              <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
                {podePortaria && (
                  <Link
                    href="/portaria"
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      ativo('/portaria')
                        ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>Controle</span>
                  </Link>
                )}

                {podeLiberacao && (
                  <Link
                    href="/liberacao"
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      ativo('/liberacao')
                        ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>Liberação</span>
                  </Link>
                )}

                {podeEncomendas && (
                  <Link
                    href="/encomendas"
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      ativo('/encomendas')
                        ? 'bg-blue-500/15 text-blue-300 font-medium'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="mr-1">📦</span>
                    <span>Encomendas</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {podeUsuarios && (
          <Link
            href="/usuarios"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              ativo('/usuarios')
                ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="text-base">US</span>
            <span>Usuarios</span>
          </Link>
        )}
      </nav>

      {/* Tema */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
        >
          <span className="flex items-center gap-3">
            <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span>{theme === 'dark' ? 'Modo escuro' : 'Modo claro'}</span>
          </span>
        </button>
      </div>

      {/* Rodapé */}
      <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-slate-500">Sistema Interno</p>
          <p className="text-[10px] text-slate-600 mt-0.5">v1.7</p>
        </div>
        <UserButton />
      </div>
    </aside>
  )
}
