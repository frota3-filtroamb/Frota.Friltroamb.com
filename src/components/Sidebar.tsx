'use client'

import { useUser, UserButton } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { usePathname } from 'next/navigation'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import Link from 'next/link'
import Image from 'next/image'
import { useTopbarSearch } from '@/components/TopbarSearchProvider'
import { usePermissions } from '@/components/PermissionsProvider'
import { lerJsonSeguro } from '@/lib/http'

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

type FeedbackTipo = 'bug' | 'ideia' | 'outro'

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

function FeedbackIcon() {
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

  return <svg {...props}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>
}

function FeedbackTipoIcon({ tipo }: { tipo: FeedbackTipo }) {
  const props = {
    className: 'h-5 w-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (tipo === 'bug') return <svg {...props}><path d="M8 2v3" /><path d="M16 2v3" /><path d="M9 9h6" /><path d="M8 13h8" /><path d="M3 13h4" /><path d="M17 13h4" /><path d="M4 19l3-3" /><path d="m20 19-3-3" /><rect x="7" y="5" width="10" height="14" rx="5" /></svg>
  if (tipo === 'ideia') return <svg {...props}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14c-.9.7-1.5 1.7-1.5 3h-4c0-1.1-.5-1.9-1.5-2.5Z" /></svg>

  return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
}

function TopbarSearchIcon() {
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

  return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>
}

function MobileThemeIcon({ theme }: { theme: 'dark' | 'light' }) {
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

  if (theme === 'dark') {
    return <svg {...props}><path d="M12 3a6 6 0 0 0 9 7.5A9 9 0 1 1 12 3Z" /></svg>
  }

  return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
}

function MobileMenuIcon({ aberto = false }: { aberto?: boolean }) {
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

  if (aberto) return <svg {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  return <svg {...props}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
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
  const { busca, setBusca, limparBusca } = useTopbarSearch()
  const permissoesAtualizadas = usePermissions()
  const { user, isLoaded } = useUser()
  const role = permissoesAtualizadas.role
  const roleLabel = role === 'dev' ? 'Dev' : role === 'gestor' ? 'Gestor' : role === 'editor' ? 'Editor' : role === 'porteiro' ? 'Porteiro' : 'Basico'
  const podeUsuarios = role === 'dev'

  const podeVeiculos = permissoesAtualizadas.podeAcessar('veiculos')
  const podePortaria = permissoesAtualizadas.podeAcessar('portaria')
  const podeLiberacao = permissoesAtualizadas.podeAcessar('liberacao')
  const podeTransferencia = permissoesAtualizadas.podeAcessar('transferencia')
  const podeEncomendas = permissoesAtualizadas.podeAcessar('encomendas')
  const podeAlmoxarifado = permissoesAtualizadas.podeAcessar('almoxarifado')
  const podeCadastros = permissoesAtualizadas.podeAcessar('cadastros')
  const podeCadastroPessoas = permissoesAtualizadas.podeAcessar('cadastros.pessoas')
  const podeCadastroDestinos = permissoesAtualizadas.podeAcessar('cadastros.destinos')

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
  const [feedbackAberto, setFeedbackAberto] = useState(false)
  const [feedbackTipo, setFeedbackTipo] = useState<FeedbackTipo>('bug')
  const [feedbackTexto, setFeedbackTexto] = useState('')
  const [feedbackAnexo, setFeedbackAnexo] = useState<File | null>(null)
  const [feedbackMensagem, setFeedbackMensagem] = useState('')
  const [feedbackEnviando, setFeedbackEnviando] = useState(false)
  const [feedbackCapturando, setFeedbackCapturando] = useState(false)
  const notificacoesRef = useRef<HTMLDivElement | null>(null)
  const notificacoesMobileRef = useRef<HTMLDivElement | null>(null)
  const feedbackRef = useRef<HTMLDivElement | null>(null)
  const paginasComBusca = pathname === '/'

  useEffect(() => {
    limparBusca()
  }, [limparBusca, pathname])

  useEffect(() => {
    setPortariaAberta(false)
    setRelatoriosAberto(false)
    setCadastrosAberto(false)
  }, [pathname])

  useEffect(() => {
    if (!notificacoesAberta) return

    function fecharAoClicarFora(event: MouseEvent) {
      const target = event.target as Node
      if (!notificacoesRef.current?.contains(target) && !notificacoesMobileRef.current?.contains(target)) {
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

  useEffect(() => {
    if (!feedbackAberto) return

    function fecharAoClicarFora(event: MouseEvent) {
      const target = event.target as Node
      if (!feedbackRef.current?.contains(target)) {
        setFeedbackAberto(false)
      }
    }

    function fecharComEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFeedbackAberto(false)
      }
    }

    document.addEventListener('mousedown', fecharAoClicarFora)
    document.addEventListener('keydown', fecharComEsc)

    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora)
      document.removeEventListener('keydown', fecharComEsc)
    }
  }, [feedbackAberto])

  function abrirFeedback() {
    setNotificacoesAberta(false)
    setFeedbackMensagem('')
    setFeedbackAberto(true)
  }

  function corNaoSuportada(valor: string) {
    return /(^|[^\w-])(lab|oklab|lch|oklch|color|color-mix)\(/i.test(valor)
  }

  function corFallback(propriedade: string) {
    if (propriedade.toLowerCase().includes('background')) return 'transparent'
    if (propriedade.toLowerCase().includes('shadow')) return 'none'
    if (theme === 'dark') return 'rgb(248, 250, 252)'
    return 'rgb(15, 23, 42)'
  }

  function sanitizarCoresParaCaptura(documento: Document) {
    const janela = documento.defaultView
    if (!janela) return

    const propriedades = [
      'color',
      'backgroundColor',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
      'outlineColor',
      'textDecorationColor',
      'fill',
      'stroke',
      'boxShadow',
      'textShadow',
    ] as const

    documento.querySelector('.feedback-overlay')?.remove()

    const estiloCompatibilidade = documento.createElement('style')
    estiloCompatibilidade.textContent = `
      *, *::before, *::after {
        --tw-ring-color: rgba(16, 185, 129, 0.25) !important;
        --tw-shadow-color: rgba(15, 23, 42, 0.18) !important;
        --tw-border-opacity: 1 !important;
        --tw-bg-opacity: 1 !important;
        --tw-text-opacity: 1 !important;
      }
    `
    documento.head.appendChild(estiloCompatibilidade)

    documento.querySelectorAll('*').forEach((elemento) => {
      const estiloComputado = janela.getComputedStyle(elemento)
      const estiloInline = (elemento as HTMLElement).style

      propriedades.forEach((propriedade) => {
        const valor = estiloComputado[propriedade]
        if (valor && corNaoSuportada(valor)) {
          estiloInline[propriedade] = corFallback(propriedade)
        }
      })
    })
  }

  async function capturarTelaFeedback() {
    setFeedbackCapturando(true)
    setFeedbackMensagem('')

    try {
      const { default: html2canvas } = await import('html2canvas')
      const painel = feedbackRef.current
      if (painel) painel.style.visibility = 'hidden'

      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      const canvas = await html2canvas(document.body, {
        backgroundColor: null,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        ignoreElements: (element) => element.classList.contains('feedback-overlay'),
        onclone: sanitizarCoresParaCaptura,
      })

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.92))
      if (!blob) throw new Error('Nao foi possivel gerar a captura.')

      const arquivo = new File([blob], `feedback-${new Date().toISOString().replace(/[:.]/g, '-')}.png`, {
        type: 'image/png',
      })
      setFeedbackAnexo(arquivo)
      setFeedbackMensagem('Captura de tela anexada.')
    } catch (error) {
      setFeedbackMensagem(error instanceof Error ? error.message : 'Erro ao capturar a tela.')
    } finally {
      if (feedbackRef.current) feedbackRef.current.style.visibility = ''
      setFeedbackCapturando(false)
    }
  }

  async function enviarFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (feedbackTexto.trim().length < 8) {
      setFeedbackMensagem('Descreva o feedback com pelo menos 8 caracteres.')
      return
    }

    setFeedbackEnviando(true)
    setFeedbackMensagem('')

    try {
      const dadosFeedback = new FormData()
      dadosFeedback.set('tipo', feedbackTipo)
      dadosFeedback.set('mensagem', feedbackTexto.trim())
      dadosFeedback.set('pagina', pathname)
      if (feedbackAnexo) {
        dadosFeedback.set('anexo', feedbackAnexo)
      }

      const resposta = await fetch('/api/feedbacks', {
        method: 'POST',
        body: dadosFeedback,
      })
      const resultado = await lerJsonSeguro(resposta)

      if (!resposta.ok) {
        throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao enviar feedback.')
      }

      setFeedbackMensagem(typeof resultado.mensagem === 'string' ? resultado.mensagem : 'Feedback enviado com sucesso.')
      setFeedbackTexto('')
      setFeedbackAnexo(null)
      setTimeout(() => setFeedbackAberto(false), 900)
    } catch (error) {
      setFeedbackMensagem(error instanceof Error ? error.message : 'Erro ao enviar feedback.')
    } finally {
      setFeedbackEnviando(false)
    }
  }

  const carregarNotificacoes = useCallback(async function carregarNotificacoes() {
    if (!isLoaded || !user) {
      setNotificacoes([])
      return
    }

    setCarregandoNotificacoes(true)
    try {
      const resposta = await fetch('/api/notificacoes')
      const resultado = await lerJsonSeguro(resposta)

      if (!resposta.ok) throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao carregar notificacoes.')
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
      <header className="mobile-app-header sticky top-0 z-50 border-b border-white/10 bg-[#0b1f33] text-white min-[1025px]:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-3">
          <button
            type="button"
            onClick={() => setMobileMenuAberto(true)}
            aria-label="Abrir menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          >
            <MobileMenuIcon />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-center text-base font-bold text-white">
            {tituloDaPagina(pathname)}
          </h1>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Enviar feedback"
              title="Enviar feedback"
              onClick={abrirFeedback}
              className={`topbar-feedback-button flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 transition-colors ${feedbackAberto ? 'is-open' : ''}`}
            >
              <FeedbackIcon />
            </button>

            <div ref={notificacoesMobileRef} className="relative">
              <button
                type="button"
                aria-label="Notificacoes"
                aria-expanded={notificacoesAberta}
                onClick={() => setNotificacoesAberta((aberta) => !aberta)}
                className={`topbar-notification-button relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 transition-colors ${notificacoesAberta ? 'is-open' : ''}`}
              >
                <TopBarIcon />
                {notificacoes.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white">
                    {notificacoes.length > 9 ? '9+' : notificacoes.length}
                  </span>
                )}
              </button>

              {notificacoesAberta && (
                <div className="topbar-notification-panel absolute right-0 top-12 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-2xl border shadow-xl">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2 className="text-sm font-bold">Notificacoes</h2>
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

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300"
            >
              <MobileThemeIcon theme={theme} />
            </button>
          </div>
        </div>

        {mobileMenuAberto && (
          <div className="fixed inset-0 z-50 bg-black/45 min-[1025px]:hidden" onClick={() => setMobileMenuAberto(false)}>
            <aside
              className="sidebar-scroll h-full w-[min(82vw,320px)] overflow-y-auto bg-[#101314] p-3 shadow-2xl shadow-black/40"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <Link href="/inicio" className="flex min-w-0 items-center gap-3" onClick={() => setMobileMenuAberto(false)}>
                  <Image
                    src="/images/favicon.png"
                    alt="Filtroamb"
                    width={40}
                    height={40}
                    className="h-10 w-10 object-contain"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">Filtroamb</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{roleLabel}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setMobileMenuAberto(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300"
                >
                  <MobileMenuIcon aberto />
                </button>
              </div>

              <nav className="grid grid-cols-1 gap-1">
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
              </nav>

              <div className="mt-4 border-t border-white/10 pt-4">
                <UserButton
                  appearance={{
                    theme: theme === 'dark' ? dark : undefined,
                  }}
                />
              </div>
            </aside>
          </div>
        )}
      </header>

      <div className="hidden w-[53px] shrink-0 min-[1025px]:block" aria-hidden="true" />

      <div className="app-topbar fixed left-[53px] right-0 top-0 z-20 hidden h-14 items-center gap-5 border-b border-slate-200 bg-white px-6 text-slate-950 min-[1025px]:flex">
        <h1 className="topbar-page-title min-w-[108px] whitespace-nowrap text-lg font-bold">
          {tituloDaPagina(pathname)}
        </h1>

        {paginasComBusca && (
          <label className="topbar-search relative flex h-9 w-full max-w-md items-center">
            <span className="pointer-events-none absolute left-3 text-slate-400">
              <TopbarSearchIcon />
            </span>
            <input
              type="text"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pesquisar nesta pagina..."
              className="h-full w-full rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar pesquisa"
                className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                x
              </button>
            )}
          </label>
        )}

        <button
          type="button"
          aria-label="Enviar feedback"
          title="Enviar feedback"
          onClick={abrirFeedback}
          className={`topbar-feedback-button ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors ${feedbackAberto ? 'is-open' : ''}`}
        >
          <FeedbackIcon />
        </button>

        <div ref={notificacoesRef} className="relative flex items-center">
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

      {feedbackAberto && (
        <div className="feedback-overlay fixed inset-0 z-[80] flex items-start justify-end bg-black/35 px-4 py-16 min-[1025px]:py-20">
          <div ref={feedbackRef} className="feedback-panel w-full max-w-[340px] overflow-hidden rounded-2xl border shadow-2xl">
            <div className="feedback-header flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <FeedbackIcon />
                <h2 className="text-sm font-bold">Enviar Feedback</h2>
              </div>
              <button
                type="button"
                aria-label="Fechar feedback"
                onClick={() => setFeedbackAberto(false)}
                className="feedback-close flex h-8 w-8 items-center justify-center rounded-full"
              >
                x
              </button>
            </div>

            <form onSubmit={enviarFeedback} className="feedback-body space-y-4 p-5">
              <div className="grid grid-cols-3 gap-2">
                {(['bug', 'ideia', 'outro'] as FeedbackTipo[]).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    disabled={feedbackEnviando}
                    onClick={() => setFeedbackTipo(tipo)}
                    className={`feedback-type-button flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] font-bold uppercase ${feedbackTipo === tipo ? 'is-active' : ''}`}
                  >
                    <FeedbackTipoIcon tipo={tipo} />
                    {tipo === 'ideia' ? 'Ideia' : tipo === 'outro' ? 'Outro' : 'Bug'}
                  </button>
                ))}
              </div>

              <textarea
                value={feedbackTexto}
                onChange={(event) => setFeedbackTexto(event.target.value)}
                disabled={feedbackEnviando}
                placeholder="Conte-nos o que aconteceu ou sua ideia..."
                className="feedback-textarea h-28 w-full resize-none rounded-xl border px-3 py-3 text-sm outline-none"
              />

              <button
                type="button"
                disabled={feedbackEnviando || feedbackCapturando}
                onClick={capturarTelaFeedback}
                className="feedback-attachment flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left disabled:opacity-60"
              >
                <span className="feedback-checkbox flex h-5 w-5 shrink-0 items-center justify-center rounded border">
                  {feedbackAnexo ? 'ok' : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">
                    {feedbackCapturando ? 'Capturando tela...' : feedbackAnexo ? 'Captura de tela anexada' : 'Anexar captura de tela'}
                  </span>
                  <span className="block text-[10px]">Clique para capturar a tela atual</span>
                </span>
                <span className="text-slate-400">
                  <FeedbackIcon />
                </span>
              </button>

              {feedbackMensagem && (
                <p className="feedback-message text-center text-xs font-semibold">{feedbackMensagem}</p>
              )}

              <button type="submit" disabled={feedbackEnviando} className="feedback-submit flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black uppercase disabled:opacity-60">
                <span aria-hidden="true">&gt;</span>
                {feedbackEnviando ? 'Enviando...' : 'Enviar Feedback'}
              </button>
            </form>
          </div>
        </div>
      )}

      <aside className="group/sidebar fixed left-0 top-0 z-30 hidden h-full w-[53px] overflow-hidden bg-[#101314] text-white shadow-xl shadow-black/20 transition-[width] duration-200 ease-out hover:w-[188px] focus-within:w-[188px] min-[1025px]:flex min-[1025px]:flex-col">
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
