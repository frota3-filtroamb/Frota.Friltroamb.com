'use client'

import { useUser, UserButton } from '@clerk/nextjs'
import { getRole, podeAcessar } from '@/lib/roles'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import Link from 'next/link'

function SidebarIcon({ nome }: { nome: string }) {
  const props = {
    className: 'h-4 w-4',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (nome === 'veiculos') return <svg {...props}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h10M7 14h6" /></svg>
  if (nome === 'portaria') return <svg {...props}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5M16 13h.01" /></svg>
  if (nome === 'liberacao') return <svg {...props}><path d="M4 18V7a2 2 0 0 1 2-2h9l5 5v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M14 5v5h5" /><path d="m9 14 2 2 4-5" /></svg>
  if (nome === 'encomendas') return <svg {...props}><path d="M4 8h16v11H4z" /><path d="m4 8 3-4h10l3 4" /><path d="M12 4v15" /></svg>
  if (nome === 'almoxarifado') return <svg {...props}><path d="M4 8h16v11H4z" /><path d="M8 8V5h8v3" /><path d="M9 13h6" /></svg>
  if (nome === 'usuarios') return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11l2 2 4-4" /></svg>
  return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
}

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
  const podeAlmoxarifado = podeAcessar(user, 'almoxarifado')

  const temSubmenuPortaria =
    podePortaria || podeLiberacao || podeTransferencia || podeEncomendas

  const [portariaAberta, setPortariaAberta] = useState(
    pathname === '/portaria' ||
      pathname === '/liberacao' ||
      pathname === '/transferencia' ||
      pathname === '/encomendas'
  )

  const ativo = (href: string) => pathname === href
  const roleLabel = role === 'dev' ? 'Dev' : role === 'gestor' ? 'Gestor' : 'Porteiro'
  const iconWrap = 'ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors group-hover/item:text-white'

  return (
    <aside className="group/sidebar w-64 -translate-x-52 hover:translate-x-0 focus-within:translate-x-0 bg-[#101314] text-white flex flex-col fixed h-full z-30 border-r border-white/10 shadow-2xl shadow-black/30 transition-transform duration-200 ease-out">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-14 border-l border-white/10 bg-black/20 opacity-100 transition-opacity group-hover/sidebar:opacity-0" />

      <div className="px-3 py-5 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">Filtroamb</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{roleLabel}</p>
          </div>
          <img
            src={theme === 'dark' ? '/images/logo-filtroamb-dark.png' : '/images/logo-filtroamb.png'}
            alt="Filtroamb"
            className="h-8 w-8 shrink-0 object-contain"
          />
        </div>
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-5 space-y-1">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 opacity-0 transition-opacity group-hover/sidebar:opacity-100">
          Menu
        </p>

        {podeVeiculos && (
          <Link
            href="/"
            title="Veiculos"
            className={`group/item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              ativo('/')
                ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>Veiculos</span>
            <span className={iconWrap}><SidebarIcon nome="veiculos" /></span>
          </Link>
        )}

        {temSubmenuPortaria && (
          <div>
            <button
              type="button"
              onClick={() => setPortariaAberta(!portariaAberta)}
              title="Portaria"
              className={`group/item w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                pathname === '/portaria' ||
                pathname === '/liberacao' ||
                pathname === '/encomendas' ||
                pathname === '/transferencia'
                  ? 'bg-emerald-500/10 text-emerald-300 font-medium'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>Portaria</span>
              <span className={iconWrap}><SidebarIcon nome="portaria" /></span>
            </button>

            {portariaAberta && (
              <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
                {podePortaria && (
                  <Link
                    href="/portaria"
                    title="Controle"
                    className={`group/item flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      ativo('/portaria')
                        ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>Controle</span>
                    <span className={iconWrap}><SidebarIcon nome="portaria" /></span>
                  </Link>
                )}

                {podeLiberacao && (
                  <Link
                    href="/liberacao"
                    title="Liberacao"
                    className={`group/item flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      ativo('/liberacao')
                        ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>Liberacao</span>
                    <span className={iconWrap}><SidebarIcon nome="liberacao" /></span>
                  </Link>
                )}

                {podeEncomendas && (
                  <Link
                    href="/encomendas"
                    title="Encomendas"
                    className={`group/item flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      ativo('/encomendas')
                        ? 'bg-blue-500/15 text-blue-300 font-medium'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>Encomendas</span>
                    <span className={iconWrap}><SidebarIcon nome="encomendas" /></span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {podeAlmoxarifado && (
          <Link
            href="/almoxarifado"
            title="Almoxarifado"
            className={`group/item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              ativo('/almoxarifado')
                ? 'bg-cyan-500/15 text-cyan-300 font-medium'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>Almoxarifado</span>
            <span className={iconWrap}><SidebarIcon nome="almoxarifado" /></span>
          </Link>
        )}

        {podeUsuarios && (
          <Link
            href="/usuarios"
            title="Usuarios"
            className={`group/item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              ativo('/usuarios')
                ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>Usuarios</span>
            <span className={iconWrap}><SidebarIcon nome="usuarios" /></span>
          </Link>
        )}
      </nav>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Modo escuro' : 'Modo claro'}
          className="group/item w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
        >
          <span>{theme === 'dark' ? 'Modo escuro' : 'Modo claro'}</span>
          <span className={iconWrap}><SidebarIcon nome="tema" /></span>
        </button>
      </div>

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
