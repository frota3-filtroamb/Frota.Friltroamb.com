'use client'

import { useUser, UserButton } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { getRole, podeAcessar } from '@/lib/roles'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import Link from 'next/link'
import Image from 'next/image'

type IconName =
  | 'inicio'
  | 'veiculos'
  | 'portaria'
  | 'liberacao'
  | 'encomendas'
  | 'relatorios'
  | 'almoxarifado'
  | 'cadastros'
  | 'usuarios'
  | 'tema'
  | 'chevron'

type Notificacao = {
  id: string
  titulo: string
  descricao: string
  data: string | null
  href: string
}

function SidebarIcon({ nome }: { nome: IconName }) {
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

  if (nome === 'inicio') return <svg {...props}><path d="m3 10 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>
  if (nome === 'veiculos') return <svg {...props}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h10M7 14h6" /></svg>
  if (nome === 'portaria') return <svg {...props}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5M16 13h.01" /></svg>
  if (nome === 'liberacao') return <svg {...props}><path d="M4 18V7a2 2 0 0 1 2-2h9l5 5v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M14 5v5h5" /><path d="m9 14 2 2 4-5" /></svg>
  if (nome === 'encomendas') return <svg {...props}><path d="M4 8h16v11H4z" /><path d="m4 8 3-4h10l3 4" /><path d="M12 4v15" /></svg>
  if (nome === 'relatorios') return <svg {...props}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-3" /></svg>
  if (nome === 'almoxarifado') return <svg {...props}><path d="M4 8h16v11H4z" /><path d="M8 8V5h8v3" /><path d="M9 13h6" /></svg>
  if (nome === 'cadastros') return <svg {...props}><circle cx="8" cy="8" r="3" /><path d="M3 20a5 5 0 0 1 10 0" /><path d="M16 11h5M18.5 8.5v5" /></svg>
  if (nome === 'usuarios') return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11l2 2 4-4" /></svg>
  if (nome === 'chevron') return <svg {...props}><path d="m9 18 6-6-6-6" /></svg>

  return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
}

function TopBarIcon() {
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

  return <svg {...props}><path d="M15 17H9" /><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
}

function tituloDaPagina(pathname: string) {
  const titulos: Record<string, string> = {
    '/': 'Veículos',
    '/inicio': 'Início',
    '/portaria': 'Portaria/Controle',
    '/liberacao': 'Portaria/Liberação',
    '/transferencia': 'Portaria/Transferência',
    '/encomendas': 'Portaria/Encomendas',
    '/almoxarifado': 'Almoxarifado',
    '/cadastros/pessoas': 'Cadastros/Pessoas',
    '/cadastros/destinos': 'Cadastros/Destinos',
    '/usuarios': 'Usuários',
    '/relatorios/entrada-saida-veiculos': 'Relatórios/Veículos',
    '/relatorios/entrada-saida-pedestres': 'Relatórios/Pedestres',
    '/relatorios/transferencias': 'Relatórios/Transferências',
  }

  return (titulos[pathname] || 'Filtroamb').replace('/', ': ')
}

export default function Sidebar() {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const { user, isLoaded } = useUser()
  const role = getRole(user)
  const roleLabel = role === 'dev' ? 'Dev' : role === 'gestor' ? 'Gestor' : role === 'editor' ? 'Editor' : role === 'porteiro' ? 'Porteiro' : 'Basico'
  const podeUsuarios = role === 'dev'

  const podeVeiculos = podeAcessar(user, 'veiculos')
  const podePortaria = podeAcessar(user, 'portaria')
  const podeLiberacao = podeAcessar(user, 'liberacao')
  const podeTransferencia = podeAcessar(user, 'transferencia')
  const podeEncomendas = podeAcessar(user, 'encomendas')
  const podeAlmoxarifado = podeAcessar(user, 'almoxarifado')
  const podeCadastros = podeAcessar(user, 'cadastros')
  const podeCadastroPessoas = podeAcessar(user, 'cadastros.pessoas')
  const podeCadastroDestinos = podeAcessar(user, 'cadastros.destinos')

  const portariaAtiva =
    pathname === '/portaria' ||
    pathname === '/liberacao' ||
    pathname === '/transferencia' ||
    pathname === '/encomendas'
  const relatoriosAtivo = pathname.startsWith('/relatorios')
  const cadastrosAtivo = pathname.startsWith('/cadastros')

  const temSubmenuPortaria = podePortaria || podeLiberacao || podeTransferencia || podeEncomendas
  const temSubmenuCadastros = podeCadastros || podeCadastroPessoas || podeCadastroDestinos
  const podeRelatorioVeiculos = podePortaria
  const podeRelatorioPedestres = podePortaria
  const podeRelatorioTransferencias = podeTransferencia
  const temSubmenuRelatorios = podeRelatorioVeiculos || podeRelatorioPedestres || podeRelatorioTransferencias

  const [portariaAberta, setPortariaAberta] = useState(false)
  const [relatoriosAberto, setRelatoriosAberto] = useState(false)
  const [cadastrosAberto, setCadastrosAberto] = useState(false)
  const [mobileMenuAberto, setMobileMenuAberto] = useState(false)
  const [notificacoesAberta, setNotificacoesAberta] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [carregandoNotificacoes, setCarregandoNotificacoes] = useState(false)
  const notificacoesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setPortariaAberta(false)
    setRelatoriosAberto(false)
    setCadastrosAberto(false)
  }, [pathname])

  useEffect(() => {
    if (!notificacoesAberta) return

    function fecharAoClicarFora(event: MouseEvent) {
      if (!notificacoesRef.current?.contains(event.target as Node)) {
        setNotificacoesAberta(false)
      }
    }

    function fecharComEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNotificacoesAberta(false)
      }
    }

    document.addEventListener('mousedown', fecharAoClicarFora)
    document.addEventListener('keydown', fecharComEsc)

    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora)
      document.removeEventListener('keydown', fecharComEsc)
    }
  }, [notificacoesAberta])

  const carregarNotificacoes = useCallback(async function carregarNotificacoes() {
    if (!isLoaded || !user) {
      setNotificacoes([])
      return
    }

    setCarregandoNotificacoes(true)
    try {
      const resposta = await fetch('/api/notificacoes')
      const resultado = await resposta.json()

      if (!resposta.ok) throw new Error(resultado.error || 'Erro ao carregar notificacoes.')
      setNotificacoes(Array.isArray(resultado.notificacoes) ? resultado.notificacoes : [])
    } catch {
      setNotificacoes([])
    } finally {
      setCarregandoNotificacoes(false)
    }
  }, [isLoaded, user])

  useEffect(() => {
    if (!isLoaded || !user) return

    carregarNotificacoes()
    const interval = setInterval(carregarNotificacoes, 30000)
    return () => clearInterval(interval)
  }, [carregarNotificacoes, isLoaded, pathname, user])

  useEffect(() => {
    if (!notificacoesAberta) return
    carregarNotificacoes()
  }, [carregarNotificacoes, notificacoesAberta])

  function formatarDataNotificacao(data: string | null) {
    if (!data) return ''
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(data)).replace(',', '')
  }

  const ativo = (href: string) => pathname === href
  const desktopRow = 'group/item grid h-10 grid-cols-[36px_1fr] items-center gap-3 rounded-lg px-1.5 text-sm transition-colors duration-200'
  const desktopIdle = 'text-slate-400 hover:bg-emerald-500/5 hover:text-emerald-300 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]'
  const desktopActive = 'font-medium text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]'
  const desktopIcon = 'flex h-9 w-9 items-center justify-center text-slate-400 transition-colors duration-200 group-hover/item:text-emerald-300 group-hover/item:drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]'
  const desktopIconActive = 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]'
  const divider = 'mt-1 pt-1'

  function mobileLinkClass(href: string, color = 'emerald') {
    const active = color === 'blue'
      ? 'bg-blue-500/15 text-blue-300 font-medium'
      : color === 'purple'
        ? 'bg-purple-500/15 text-purple-300 font-medium'
        : 'bg-emerald-500/15 text-emerald-300 font-medium'
    return `rounded-lg px-3 py-2.5 text-sm ${ativo(href) ? active : 'text-slate-300 hover:bg-white/5'}`
  }

  return (
    <>
      <header className="lg:hidden sticky top-0 z-50 bg-[#0b1f33] text-white border-b border-white/10">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setMobileMenuAberto(false)}>
            <Image
              src="/images/favicon.png"
              alt="Filtroamb"
              width={36}
              height={36}
              className="h-9 w-auto object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Gestao de Frota</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{roleLabel}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"
            >
              Tema
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuAberto(!mobileMenuAberto)}
              className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300"
            >
              Menu
            </button>
            <UserButton
              appearance={{
                theme: theme === 'dark' ? dark : undefined,
              }}
            />
          </div>
        </div>

        {mobileMenuAberto && (
          <nav className="sidebar-scroll max-h-[70dvh] overflow-y-auto border-t border-white/10 px-3 py-3">
            <div className="grid grid-cols-1 gap-1">
              <Link href="/inicio" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/inicio')}>
                Inicio
              </Link>

              {podeVeiculos && (
                <Link href="/" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/')}>
                  Veiculos
                </Link>
              )}

              {temSubmenuPortaria && (
                <div className="rounded-xl border border-white/10 p-2">
                  <button
                    type="button"
                    onClick={() => setPortariaAberta(!portariaAberta)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-200"
                  >
                    <span>Portaria</span>
                    <span>{portariaAberta ? 'Fechar' : 'Abrir'}</span>
                  </button>

                  {portariaAberta && (
                    <div className="mt-1 grid grid-cols-1 gap-1">
                      {podePortaria && (
                        <Link href="/portaria" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/portaria')}>
                          Controle
                        </Link>
                      )}
                      {podeLiberacao && (
                        <Link href="/liberacao" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/liberacao')}>
                          Liberacao
                        </Link>
                      )}
                      {podeEncomendas && (
                        <Link href="/encomendas" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/encomendas', 'blue')}>
                          Encomendas
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}

              {temSubmenuRelatorios && (
                <div className="rounded-xl border border-white/10 p-2">
                  <button
                    type="button"
                    onClick={() => setRelatoriosAberto(!relatoriosAberto)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-200"
                  >
                    <span>Relatorios</span>
                    <span>{relatoriosAberto ? 'Fechar' : 'Abrir'}</span>
                  </button>

                  {relatoriosAberto && (
                    <div className="mt-1 grid grid-cols-1 gap-1">
                      {podeRelatorioVeiculos && (
                        <Link href="/relatorios/entrada-saida-veiculos" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/relatorios/entrada-saida-veiculos')}>
                          Entrada/Saida Veiculos
                        </Link>
                      )}
                      {podeRelatorioPedestres && (
                        <Link href="/relatorios/entrada-saida-pedestres" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/relatorios/entrada-saida-pedestres', 'purple')}>
                          Entrada/Saida Pedestres
                        </Link>
                      )}
                      {podeRelatorioTransferencias && (
                        <Link href="/relatorios/transferencias" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/relatorios/transferencias', 'blue')}>
                          Transferencias
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}

              {podeAlmoxarifado && (
                <Link href="/almoxarifado" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/almoxarifado')}>
                  Almoxarifado
                </Link>
              )}

              {temSubmenuCadastros && (
                <div className="rounded-xl border border-white/10 p-2">
                  <button
                    type="button"
                    onClick={() => setCadastrosAberto(!cadastrosAberto)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-200"
                  >
                    <span>Cadastros</span>
                    <span>{cadastrosAberto ? 'Fechar' : 'Abrir'}</span>
                  </button>

                  {cadastrosAberto && (
                    <div className="mt-1 grid grid-cols-1 gap-1">
                      {podeCadastroPessoas && (
                        <Link href="/cadastros/pessoas" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/cadastros/pessoas')}>
                          Pessoas
                        </Link>
                      )}
                      {podeCadastroDestinos && (
                        <Link href="/cadastros/destinos" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/cadastros/destinos')}>
                          Destinos
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}

              {podeUsuarios && (
                <Link href="/usuarios" onClick={() => setMobileMenuAberto(false)} className={mobileLinkClass('/usuarios')}>
                  Usuarios
                </Link>
              )}
            </div>
          </nav>
        )}
      </header>

      <div className="hidden w-[53px] shrink-0 lg:block" aria-hidden="true" />

      <div className="app-topbar fixed left-[53px] right-0 top-0 z-20 hidden h-14 items-center gap-5 border-b border-slate-200 bg-white px-6 text-slate-950 lg:flex">
        <h1 className="min-w-[108px] whitespace-nowrap text-lg font-bold">
          {tituloDaPagina(pathname)}
        </h1>

        <div ref={notificacoesRef} className="relative ml-auto flex items-center">
          <button
            type="button"
            aria-label="Notificações"
            title="Notificações"
            aria-expanded={notificacoesAberta}
            onClick={() => setNotificacoesAberta((aberta) => !aberta)}
            className={`topbar-notification-button relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${notificacoesAberta ? 'is-open' : ''}`}
          >
            <TopBarIcon />
            {notificacoes.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white">
                {notificacoes.length > 9 ? '9+' : notificacoes.length}
              </span>
            )}
          </button>

          {notificacoesAberta && (
            <div className="topbar-notification-panel absolute right-0 top-12 w-[320px] overflow-hidden rounded-2xl border shadow-xl">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-bold">Notificações</h2>
                <span className={`h-1.5 w-1.5 rounded-full ${notificacoes.length > 0 ? 'bg-orange-400' : 'bg-emerald-400'}`} aria-hidden="true" />
              </div>

              {carregandoNotificacoes ? (
                <div className="flex min-h-[108px] items-center justify-center px-4 py-8">
                  <p className="text-center text-xs font-medium italic">Carregando alertas...</p>
                </div>
              ) : notificacoes.length === 0 ? (
                <div className="flex min-h-[108px] items-center justify-center px-4 py-8">
                  <p className="text-center text-xs font-medium italic">Nenhum alerta recente.</p>
                </div>
              ) : (
                <div className="app-scroll max-h-[320px] overflow-y-auto py-1">
                  {notificacoes.map((notificacao) => (
                    <Link
                      key={notificacao.id}
                      href={notificacao.href}
                      onClick={() => setNotificacoesAberta(false)}
                      className="block border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-orange-500/10"
                    >
                      <p className="text-sm font-semibold">{notificacao.titulo}</p>
                      <p className="mt-1 text-xs">{notificacao.descricao}</p>
                      {notificacao.data && (
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide">{formatarDataNotificacao(notificacao.data)}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="group/sidebar fixed left-0 top-0 z-30 hidden h-full w-[53px] overflow-hidden bg-[#101314] text-white shadow-xl shadow-black/20 transition-[width] duration-200 ease-out hover:w-[188px] focus-within:w-[188px] lg:flex lg:flex-col">
        <Link
          href="/inicio"
          title="Inicio"
          className="grid h-[72px] grid-cols-[53px_1fr] items-center transition-colors duration-200 hover:bg-emerald-500/5"
        >
          <span className="flex h-[72px] w-[53px] items-center justify-center">
            <Image
              src="/images/favicon.png"
              alt="Filtroamb"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
          </span>
          <span className="min-w-0 pr-4 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
            <span className="block truncate text-sm font-semibold text-white">Filtroamb</span>
            <span className="block text-[10px] uppercase tracking-wider text-slate-500">{roleLabel}</span>
          </span>
        </Link>

        <nav className="sidebar-rail-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-4">
          <div className="space-y-1">
            <Link
              href="/inicio"
              title="Inicio"
              className={`${desktopRow} ${ativo('/inicio') ? desktopActive : desktopIdle}`}
            >
              <span className={`${desktopIcon} ${ativo('/inicio') ? desktopIconActive : ''}`}><SidebarIcon nome="inicio" /></span>
              <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">Inicio</span>
            </Link>

            {podeVeiculos && (
              <Link
                href="/"
                title="Veiculos"
                className={`${desktopRow} ${ativo('/') ? desktopActive : desktopIdle}`}
              >
                <span className={`${desktopIcon} ${ativo('/') ? desktopIconActive : ''}`}><SidebarIcon nome="veiculos" /></span>
                <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">Veiculos</span>
              </Link>
            )}

            {temSubmenuPortaria && (
              <div className={divider}>
                <button
                  type="button"
                  onClick={() => setPortariaAberta(!portariaAberta)}
                  title="Portaria"
                  className={`${desktopRow} w-full ${portariaAtiva ? desktopActive : desktopIdle}`}
                >
                  <span className={`${desktopIcon} ${portariaAtiva ? desktopIconActive : ''}`}><SidebarIcon nome="portaria" /></span>
                  <span className="flex min-w-0 items-center justify-between gap-2 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                    <span className="truncate">Portaria</span>
                    <span className={`text-slate-500 transition-transform ${portariaAberta ? 'rotate-90' : ''}`}><SidebarIcon nome="chevron" /></span>
                  </span>
                </button>

                {portariaAberta && (
                  <div className="ml-[47px] mt-1 space-y-1 pl-2">
                    {podePortaria && (
                      <Link href="/portaria" title="Controle" className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${ativo('/portaria') ? desktopActive : desktopIdle}`}>
                        Controle
                      </Link>
                    )}
                    {podeLiberacao && (
                      <Link href="/liberacao" title="Liberacao" className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${ativo('/liberacao') ? desktopActive : desktopIdle}`}>
                        Liberacao
                      </Link>
                    )}
                    {podeEncomendas && (
                      <Link href="/encomendas" title="Encomendas" className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${ativo('/encomendas') ? desktopActive : desktopIdle}`}>
                        Encomendas
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {temSubmenuRelatorios && (
              <div className={divider}>
                <button
                  type="button"
                  onClick={() => setRelatoriosAberto(!relatoriosAberto)}
                  title="Relatorios"
                  className={`${desktopRow} w-full ${relatoriosAtivo ? desktopActive : desktopIdle}`}
                >
                  <span className={`${desktopIcon} ${relatoriosAtivo ? desktopIconActive : ''}`}><SidebarIcon nome="relatorios" /></span>
                  <span className="flex min-w-0 items-center justify-between gap-2 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                    <span className="truncate">Relatorios</span>
                    <span className={`text-slate-500 transition-transform ${relatoriosAberto ? 'rotate-90' : ''}`}><SidebarIcon nome="chevron" /></span>
                  </span>
                </button>

                {relatoriosAberto && (
                  <div className="ml-[47px] mt-1 space-y-1 pl-2">
                    {podeRelatorioVeiculos && (
                      <Link href="/relatorios/entrada-saida-veiculos" title="Relatorio de veiculos" className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${ativo('/relatorios/entrada-saida-veiculos') ? desktopActive : desktopIdle}`}>
                        Veiculos
                      </Link>
                    )}
                    {podeRelatorioPedestres && (
                      <Link href="/relatorios/entrada-saida-pedestres" title="Relatorio de pedestres" className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${ativo('/relatorios/entrada-saida-pedestres') ? desktopActive : desktopIdle}`}>
                        Pedestres
                      </Link>
                    )}
                    {podeRelatorioTransferencias && (
                      <Link href="/relatorios/transferencias" title="Relatorio de transferencias" className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${ativo('/relatorios/transferencias') ? desktopActive : desktopIdle}`}>
                        Transferencias
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {podeAlmoxarifado && (
              <div className={divider}>
                <Link
                  href="/almoxarifado"
                  title="Almoxarifado"
                  className={`${desktopRow} ${ativo('/almoxarifado') ? desktopActive : desktopIdle}`}
                >
                  <span className={`${desktopIcon} ${ativo('/almoxarifado') ? desktopIconActive : ''}`}><SidebarIcon nome="almoxarifado" /></span>
                  <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">Almoxarifado</span>
                </Link>
              </div>
            )}

            {temSubmenuCadastros && (
              <div className={divider}>
                <button
                  type="button"
                  onClick={() => setCadastrosAberto(!cadastrosAberto)}
                  title="Cadastros"
                  className={`${desktopRow} w-full ${cadastrosAtivo ? desktopActive : desktopIdle}`}
                >
                  <span className={`${desktopIcon} ${cadastrosAtivo ? desktopIconActive : ''}`}><SidebarIcon nome="cadastros" /></span>
                  <span className="flex min-w-0 items-center justify-between gap-2 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                    <span className="truncate">Cadastros</span>
                    <span className={`text-slate-500 transition-transform ${cadastrosAberto ? 'rotate-90' : ''}`}><SidebarIcon nome="chevron" /></span>
                  </span>
                </button>

                {cadastrosAberto && (
                  <div className="ml-[47px] mt-1 space-y-1 pl-2">
                    {podeCadastroPessoas && (
                      <Link href="/cadastros/pessoas" title="Pessoas" className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${ativo('/cadastros/pessoas') ? desktopActive : desktopIdle}`}>
                        Pessoas
                      </Link>
                    )}
                    {podeCadastroDestinos && (
                      <Link href="/cadastros/destinos" title="Destinos" className={`block rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${ativo('/cadastros/destinos') ? desktopActive : desktopIdle}`}>
                        Destinos
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {podeUsuarios && (
              <div className={divider}>
                <Link
                  href="/usuarios"
                  title="Usuarios"
                  className={`${desktopRow} ${ativo('/usuarios') ? desktopActive : desktopIdle}`}
                >
                  <span className={`${desktopIcon} ${ativo('/usuarios') ? desktopIconActive : ''}`}><SidebarIcon nome="usuarios" /></span>
                  <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">Usuarios</span>
                </Link>
              </div>
            )}
          </div>
        </nav>

        <div className="px-1.5 py-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={theme === 'dark' ? 'Modo escuro' : 'Modo claro'}
            className={`${desktopRow} w-full ${desktopIdle}`}
          >
            <span className={desktopIcon}><SidebarIcon nome="tema" /></span>
            <span className="truncate text-left opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
              {theme === 'dark' ? 'Modo escuro' : 'Modo claro'}
            </span>
          </button>

          <div className="mt-2 grid h-10 grid-cols-[36px_1fr] items-center gap-3 px-1.5">
            <span className="flex h-9 w-9 items-center justify-center">
              <UserButton
                appearance={{
                  theme: theme === 'dark' ? dark : undefined,
                }}
              />
            </span>
            <span className="min-w-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
              <span className="block truncate text-[11px] text-slate-500">Sistema Interno</span>
              <span className="block text-[10px] text-slate-600">v1.8</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
