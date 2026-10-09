'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import Sidebar from '@/components/Sidebar'
import { type Permissao } from '@/lib/roles'
import { usePermissions } from '@/components/PermissionsProvider'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Atalho = {
  href: string
  titulo: string
  descricao: string
  permissao: Permissao | 'usuarios'
  cor: 'emerald' | 'blue' | 'purple' | 'orange'
}

type Movimentacao = {
  id: number
  tipo_entidade: 'veiculo' | 'pedestre' | 'transferencia'
  tipo_veiculo: string | null
  placa: string | null
  nome: string | null
  motorista: string | null
  destino: string | null
  localizacao: string | null
  status: string
  liberado_em: string | null
  entrada_em: string | null
  saida_em: string | null
}

type HistoricoAcao = {
  id: number
  tipo_entidade: string
  acao: string
  placa: string | null
  data_acao: string | null
  dados: Record<string, unknown> | null
}

type KpiCard = {
  titulo: string
  valor: number
  detalhe: string
  cor: 'emerald' | 'blue' | 'orange' | 'purple'
  icone: string
}

const ATALHOS: Atalho[] = [
  {
    href: '/',
    titulo: 'Veiculos',
    descricao: 'Frota e cadastros',
    permissao: 'veiculos',
    cor: 'emerald',
  },
  {
    href: '/liberacao',
    titulo: 'Liberacao',
    descricao: 'Entradas e saidas',
    permissao: 'liberacao',
    cor: 'blue',
  },
  {
    href: '/portaria',
    titulo: 'Controle',
    descricao: 'Portaria e autorizacoes',
    permissao: 'portaria',
    cor: 'orange',
  },
  {
    href: '/encomendas',
    titulo: 'Encomendas',
    descricao: 'Recebimento e retiradas',
    permissao: 'encomendas',
    cor: 'purple',
  },
  {
    href: '/relatorios/entrada-saida-veiculos',
    titulo: 'Relatorios',
    descricao: 'Historico da operacao',
    permissao: 'portaria',
    cor: 'emerald',
  },
  {
    href: '/usuarios',
    titulo: 'Usuarios',
    descricao: 'Perfis e permissoes',
    permissao: 'usuarios',
    cor: 'blue',
  },
]

const corClasses: Record<Atalho['cor'], string> = {
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50',
  blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300 hover:border-blue-400/50',
  purple: 'border-purple-500/20 bg-purple-500/10 text-purple-300 hover:border-purple-400/50',
  orange: 'border-orange-500/20 bg-orange-500/10 text-orange-300 hover:border-orange-400/50',
}

function saudacao() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function hojeIntervalo() {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

function formatarDataCurta(data: string | null) {
  if (!data) return '--'
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(data))
}

function formatarHora(data: string | null) {
  if (!data) return '--:--'
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(data))
}

function textoJson(dados: Record<string, unknown> | null, campo: string) {
  const valor = dados?.[campo]
  return typeof valor === 'string' ? valor : null
}

function statusLabel(status: string) {
  if (status === 'aguardando_entrada') return 'Aguardando entrada'
  if (status === 'aguardando_saida') return 'Aguardando saida'
  if (status === 'saida_autorizada') return 'Saida autorizada'
  if (status === 'em_rota') return 'Em rota'
  if (status === 'em_visita') return 'Em visita'
  if (status === 'aguardando_confirmacao') return 'Aguardando'
  if (status === 'finalizado' || status === 'concluida') return 'Concluido'
  return status || 'Nao informado'
}

function acaoLabel(acao: string) {
  if (acao === 'liberacao') return 'Liberacao'
  if (acao === 'entrada') return 'Entrada'
  if (acao === 'saida') return 'Saida'
  if (acao === 'confirmacao') return 'Confirmacao'
  if (acao === 'saida_autorizada') return 'Saida autorizada'
  return acao || 'Acao'
}

function nomeHistorico(acao: HistoricoAcao) {
  return acao.placa || textoJson(acao.dados, 'placa') || textoJson(acao.dados, 'nome') || 'Registro'
}

function destinoHistorico(acao: HistoricoAcao) {
  const origem = textoJson(acao.dados, 'base_origem')
  const destino = textoJson(acao.dados, 'base_destino') || textoJson(acao.dados, 'destino')
  return origem && destino ? `${origem} -> ${destino}` : destino || 'Nao informado'
}

export default function InicioPage() {
  const supabase = useMemo(() => createClient(), [])
  const { user } = useUser()
  const permissoesAtualizadas = usePermissions()
  const [mensagemPermissao, setMensagemPermissao] = useState('')
  const [carregandoPainel, setCarregandoPainel] = useState(true)
  const [erroPainel, setErroPainel] = useState('')
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [historicoHoje, setHistoricoHoje] = useState<HistoricoAcao[]>([])
  const [totalVeiculos, setTotalVeiculos] = useState(0)

  const nome = user?.firstName || user?.fullName || 'Usuario'
  const role = permissoesAtualizadas.role
  const perfilOperacional = role === 'porteiro' || role === 'dev' || role === 'editor'
  const hojeTexto = useMemo(() => formatarDataCurta(new Date().toISOString()), [])

  const atalhosPermitidos = ATALHOS.filter((atalho) => {
    if (atalho.permissao === 'usuarios') return role === 'dev'
    return permissoesAtualizadas.podeAcessar(atalho.permissao)
  })

  const carregarPainel = useCallback(async function carregarPainel() {
    setCarregandoPainel(true)
    setErroPainel('')

    const { inicio, fim } = hojeIntervalo()

    try {
      const [movimentacoesQuery, historicoQuery, veiculosQuery] = await Promise.all([
        supabase
          .from('TBL_MOVIMENTACOES')
          .select('id, tipo_entidade, tipo_veiculo, placa, nome, motorista, destino, localizacao, status, liberado_em, entrada_em, saida_em')
          .in('status', ['aguardando_entrada', 'aguardando_saida', 'saida_autorizada', 'em_rota', 'em_visita', 'aguardando_confirmacao'])
          .order('liberado_em', { ascending: false })
          .limit(200)
          .returns<Movimentacao[]>(),
        supabase
          .from('TBL_HISTORICOS_ACOES')
          .select('id, tipo_entidade, acao, placa, data_acao, dados')
          .gte('data_acao', inicio)
          .lt('data_acao', fim)
          .order('data_acao', { ascending: false })
          .limit(80)
          .returns<HistoricoAcao[]>(),
        supabase
          .from('TBL_VEICULOS')
          .select('NR_PLACA', { count: 'exact', head: true }),
      ])

      if (movimentacoesQuery.error) throw movimentacoesQuery.error
      if (historicoQuery.error) throw historicoQuery.error
      if (veiculosQuery.error) throw veiculosQuery.error

      setMovimentacoes(movimentacoesQuery.data || [])
      setHistoricoHoje(historicoQuery.data || [])
      setTotalVeiculos(veiculosQuery.count || 0)
    } catch {
      setErroPainel('Erro ao carregar os indicadores da operacao.')
    } finally {
      setCarregandoPainel(false)
    }
  }, [supabase])

  useEffect(() => {
    carregarPainel()
  }, [carregarPainel])

  useEffect(() => {
    try {
      const mensagem = window.sessionStorage.getItem('frota_access_denied_message')
      if (!mensagem) return

      setMensagemPermissao(mensagem)
      window.sessionStorage.removeItem('frota_access_denied_message')

      const timeout = window.setTimeout(() => {
        setMensagemPermissao('')
      }, 7000)

      return () => window.clearTimeout(timeout)
    } catch {
      return undefined
    }
  }, [])

  const kpis = useMemo<KpiCard[]>(() => {
    const abertas = movimentacoes.length
    const aguardandoAcao = movimentacoes.filter((m) =>
      m.status === 'aguardando_entrada' ||
      m.status === 'aguardando_saida' ||
      m.status === 'saida_autorizada' ||
      m.status === 'aguardando_confirmacao'
    ).length
    const pedestresEmVisita = movimentacoes.filter((m) => m.tipo_entidade === 'pedestre' && m.status === 'em_visita').length
    const transferenciasPendentes = movimentacoes.filter((m) => m.tipo_entidade === 'transferencia' && m.status === 'aguardando_confirmacao').length

    if (perfilOperacional) {
      return [
        { titulo: 'Veiculos na frota', valor: totalVeiculos, detalhe: 'Base atual de veiculos', cor: 'emerald', icone: 'V' },
        { titulo: 'Movimentacoes abertas', valor: abertas, detalhe: 'Fluxos em andamento', cor: 'blue', icone: 'M' },
        { titulo: 'Aguardando acao', valor: aguardandoAcao, detalhe: 'Requer atencao da portaria', cor: 'orange', icone: '!' },
        {
          titulo: transferenciasPendentes > 0 ? 'Transferencias pendentes' : 'Pedestres em visita',
          valor: transferenciasPendentes > 0 ? transferenciasPendentes : pedestresEmVisita,
          detalhe: transferenciasPendentes > 0 ? 'Aguardando confirmacao' : 'Visitantes dentro da unidade',
          cor: 'purple',
          icone: 'P',
        },
      ]
    }

    return [
      { titulo: 'Acessos liberados', valor: atalhosPermitidos.length, detalhe: 'Rotas disponiveis no seu perfil', cor: 'emerald', icone: 'A' },
      { titulo: 'Movimentacoes abertas', valor: abertas, detalhe: 'Operacao em andamento', cor: 'blue', icone: 'M' },
      { titulo: 'Acoes hoje', valor: historicoHoje.length, detalhe: 'Registros no historico', cor: 'orange', icone: 'H' },
      { titulo: 'Veiculos na frota', valor: totalVeiculos, detalhe: 'Base atual de veiculos', cor: 'purple', icone: 'V' },
    ]
  }, [atalhosPermitidos.length, historicoHoje.length, movimentacoes, perfilOperacional, totalVeiculos])

  const fluxoPorHora = useMemo(() => {
    const horas = Array.from({ length: 10 }, (_, index) => 7 + index)
    return horas.map((hora) => {
      const entradas = historicoHoje.filter((acao) => acao.data_acao && acao.acao === 'entrada' && new Date(acao.data_acao).getHours() === hora).length
      const saidas = historicoHoje.filter((acao) => acao.data_acao && acao.acao === 'saida' && new Date(acao.data_acao).getHours() === hora).length
      return { hora, entradas, saidas }
    })
  }, [historicoHoje])

  const maxFluxo = Math.max(1, ...fluxoPorHora.flatMap((item) => [item.entradas, item.saidas]))
  const statusResumo = useMemo(() => ({
    aguardandoEntrada: movimentacoes.filter((m) => m.status === 'aguardando_entrada').length,
    emRota: movimentacoes.filter((m) => m.status === 'em_rota').length,
    aguardandoSaida: movimentacoes.filter((m) => m.status === 'aguardando_saida' || m.status === 'saida_autorizada').length,
    pedestres: movimentacoes.filter((m) => m.status === 'em_visita').length,
    transferencias: movimentacoes.filter((m) => m.status === 'aguardando_confirmacao').length,
  }), [movimentacoes])

  const totalStatus = Math.max(1, Object.values(statusResumo).reduce((total, valor) => total + valor, 0))
  const donutStyle = {
    background: `conic-gradient(#10b981 0 ${statusResumo.aguardandoEntrada / totalStatus * 100}%, #60a5fa 0 ${(statusResumo.aguardandoEntrada + statusResumo.emRota) / totalStatus * 100}%, #f59e0b 0 ${(statusResumo.aguardandoEntrada + statusResumo.emRota + statusResumo.aguardandoSaida) / totalStatus * 100}%, #a78bfa 0 ${(statusResumo.aguardandoEntrada + statusResumo.emRota + statusResumo.aguardandoSaida + statusResumo.pedestres) / totalStatus * 100}%, #38bdf8 0 100%)`,
  }

  const ultimasAcoes = historicoHoje.slice(0, 5)

  return (
    <div className="min-h-screen flex bg-[#0a1625]">
      <Sidebar />

      <main className="app-scroll flex-1 overflow-y-auto bg-[#0a1625]">
        {mensagemPermissao && (
          <div className="access-denied-toast fixed right-5 top-20 z-50 max-w-sm rounded-2xl border border-orange-500/25 bg-[#111827] p-4 text-sm text-slate-200 shadow-2xl shadow-black/30">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-sm font-bold text-orange-300">
                !
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-white">Acesso bloqueado</p>
                <p className="mt-1 leading-relaxed text-slate-300">{mensagemPermissao}</p>
              </div>
              <button
                type="button"
                onClick={() => setMensagemPermissao('')}
                aria-label="Fechar aviso"
                className="ml-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white/5 hover:text-white"
              >
                x
              </button>
            </div>
          </div>
        )}

        <div className="inicio-hero relative h-[220px] w-full overflow-hidden">
          <Image
            src="/images/banner-frota3.jpg"
            alt="Gestao de Frota"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="inicio-hero-overlay absolute inset-0 bg-gradient-to-r from-[#061322]/90 via-[#061322]/65 to-[#061322]/25" />
          <div className="inicio-hero-fade absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0a1625] to-transparent" />

          <div className="absolute inset-0 flex items-end px-4 pb-8 md:px-8 xl:px-14">
            <div>
              <p className="inicio-hero-kicker text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Filtroamb - Frota Ativa</p>
              <h1 className="inicio-hero-title mt-2 text-3xl font-bold text-white md:text-4xl">{saudacao()}, {nome}</h1>
              <p className="inicio-hero-subtitle mt-2 text-sm font-semibold text-slate-300">Sua operacao em movimento. Tudo sob controle.</p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs text-slate-400">
                <span>{hojeTexto}</span>
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                <span className="text-emerald-300">Operacao ativa</span>
              </div>
            </div>
          </div>
        </div>

        <section className="px-4 pb-8 pt-4 md:px-8 xl:px-14">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Visao geral da operacao</h2>
              <p className="mt-1 text-sm text-slate-500">Acompanhe os principais indicadores da sua unidade.</p>
            </div>
          </div>

          {erroPainel && (
            <div className="mb-4 rounded-2xl border border-orange-500/25 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-300">
              {erroPainel}
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.titulo} className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400/30 hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{kpi.titulo}</p>
                    <p className={`mt-3 text-4xl font-bold ${kpi.cor === 'emerald' ? 'text-emerald-300' : kpi.cor === 'blue' ? 'text-blue-300' : kpi.cor === 'orange' ? 'text-orange-300' : 'text-purple-300'}`}>
                      {carregandoPainel ? '--' : kpi.valor.toLocaleString('pt-BR')}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{kpi.detalhe}</p>
                  </div>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${kpi.cor === 'emerald' ? 'bg-emerald-500/10 text-emerald-300' : kpi.cor === 'blue' ? 'bg-blue-500/10 text-blue-300' : kpi.cor === 'orange' ? 'bg-orange-500/10 text-orange-300' : 'bg-purple-500/10 text-purple-300'}`}>
                    {kpi.icone}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.9fr]">
            <section className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">Fluxo de movimentacoes</h2>
                  <p className="mt-1 text-sm text-slate-500">Entradas e saidas registradas hoje.</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Entradas</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />Saidas</span>
                </div>
              </div>

              <div className="flex h-56 items-end gap-3 border-b border-dashed border-slate-700/70 pb-4">
                {fluxoPorHora.map((item) => (
                  <div key={item.hora} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-40 w-full items-end justify-center gap-1.5">
                      <span className="w-3 rounded-t-md bg-emerald-400" style={{ height: `${Math.max(4, item.entradas / maxFluxo * 100)}%` }} title={`${item.entradas} entradas`} />
                      <span className="w-3 rounded-t-md bg-blue-400" style={{ height: `${Math.max(4, item.saidas / maxFluxo * 100)}%` }} title={`${item.saidas} saidas`} />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">{String(item.hora).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Dados do dia atual</span>
                <span>{historicoHoje.filter((a) => a.acao === 'entrada').length} entradas / {historicoHoje.filter((a) => a.acao === 'saida').length} saidas</span>
              </div>
            </section>

            <aside className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-white">Status da portaria</h2>
                <p className="mt-1 text-sm text-slate-500">Distribuicao dos fluxos abertos.</p>
              </div>

              <div className="grid items-center gap-6 sm:grid-cols-[160px_1fr] xl:grid-cols-1 2xl:grid-cols-[160px_1fr]">
                <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full" style={donutStyle}>
                  <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[#0f1c2e]">
                    <span className="text-3xl font-bold text-white">{movimentacoes.length}</span>
                    <span className="text-[11px] text-slate-500">abertos</span>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  {[
                    ['Aguardando entrada', statusResumo.aguardandoEntrada, 'bg-emerald-400'],
                    ['Em rota', statusResumo.emRota, 'bg-blue-400'],
                    ['Aguardando saida', statusResumo.aguardandoSaida, 'bg-orange-400'],
                    ['Pedestres em visita', statusResumo.pedestres, 'bg-purple-400'],
                    ['Transferencias', statusResumo.transferencias, 'bg-sky-400'],
                  ].map(([label, value, color]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-slate-400">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        {label}
                      </span>
                      <span className="font-bold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          <section className="mb-5 rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5">
            <div className="mb-4 flex flex-col gap-1">
              <h2 className="text-base font-semibold text-white">Acesso rapido</h2>
              <p className="text-sm text-slate-500">As principais rotinas, a um clique.</p>
            </div>

            {atalhosPermitidos.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#132337] p-5 text-sm text-slate-400">
                Nenhum atalho liberado para este usuario.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {atalhosPermitidos.map((atalho) => (
                  <Link key={atalho.href} href={atalho.href} className={`group rounded-xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_35px_rgba(0,0,0,0.18)] ${corClasses[atalho.cor]}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{atalho.titulo}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{atalho.descricao}</p>
                      </div>
                      <span className="text-lg transition group-hover:translate-x-1">-&gt;</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e]">
            <div className="flex items-start justify-between gap-4 border-b border-emerald-500/10 p-5">
              <div>
                <h2 className="text-base font-semibold text-white">Ultimas movimentacoes</h2>
                <p className="mt-1 text-sm text-slate-500">O que esta acontecendo hoje na operacao.</p>
              </div>
              <Link href="/relatorios/entrada-saida-veiculos" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">
                Ver todas -&gt;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-500/10 bg-[#132337]/70">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Registro</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Horario</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Destino</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {ultimasAcoes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                        Nenhuma movimentacao registrada hoje.
                      </td>
                    </tr>
                  ) : (
                    ultimasAcoes.map((acao) => (
                      <tr key={acao.id} className="hover:bg-emerald-500/5">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-white">{nomeHistorico(acao)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{textoJson(acao.dados, 'motorista') || textoJson(acao.dados, 'nome') || acao.tipo_entidade}</p>
                        </td>
                        <td className="px-5 py-3 text-slate-300">{acaoLabel(acao.acao)}</td>
                        <td className="px-5 py-3 text-slate-300">{formatarHora(acao.data_acao)}</td>
                        <td className="px-5 py-3 text-slate-300">{destinoHistorico(acao)}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                            {statusLabel(textoJson(acao.dados, 'status_movimentacao') || textoJson(acao.dados, 'status_transferencia') || 'concluida')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}
