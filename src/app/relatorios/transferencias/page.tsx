'use client'

import RequirePermissao from '@/components/RequirePermissao'
import Sidebar from '@/components/Sidebar'
import ColumnFilterHeader from '@/components/ColumnFilterHeader'
import { useTopbarSearch } from '@/components/TopbarSearchProvider'
import { usePermissions } from '@/components/PermissionsProvider'
import { lerJsonSeguro } from '@/lib/http'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

type AcaoBase = 'liberacao' | 'confirmacao'
type AcaoBanco = AcaoBase | 'correcao' | 'exclusao'

type TransferenciaAcao = {
  id: number
  transferencia_id: number | null
  acao: AcaoBanco
  data_acao: string
  placa: string | null
  base_origem: string | null
  base_destino: string | null
  motorista: string | null
  observacao: string | null
  status_transferencia: string | null
  responsavel_nome: string | null
  responsavel_email: string | null
  corrige_acao_id: number | null
  corrigido_por_nome: string | null
  corrigido_em: string | null
  motivo_correcao: string | null
}

type HistoricoAcaoRow = {
  id: number
  tipo_entidade: string
  entidade_id: number | null
  acao: AcaoBanco
  placa: string | null
  data_acao: string
  responsavel_nome: string | null
  responsavel_email: string | null
  motivo: string | null
  dados: Record<string, unknown> | null
}

type RegistroExibido = TransferenciaAcao & {
  acao_exibida: AcaoBase
  acao_original_id: number
  corrigido: boolean
}

type FormEdicao = {
  placa: string
  base_origem: string
  base_destino: string
  motorista: string
  observacao: string
  data_acao: string
  status_transferencia: string
  motivo_correcao: string
}

type ColunaFiltro = 'placa' | 'acao' | 'data' | 'origem' | 'destino' | 'motorista' | 'responsavel' | 'observacao'
type FiltrosColuna = Record<ColunaFiltro, string[]>

const FORM_VAZIO: FormEdicao = {
  placa: '',
  base_origem: '',
  base_destino: '',
  motorista: '',
  observacao: '',
  data_acao: '',
  status_transferencia: '',
  motivo_correcao: '',
}

const acaoLabel: Record<AcaoBase, string> = {
  liberacao: 'Liberacao',
  confirmacao: 'Confirmacao',
}

const FILTROS_INICIAIS: FiltrosColuna = {
  placa: [],
  acao: [],
  data: [],
  origem: [],
  destino: [],
  motorista: [],
  responsavel: [],
  observacao: [],
}

function textoJson(dados: Record<string, unknown>, campo: string) {
  const valor = dados[campo]
  return typeof valor === 'string' ? valor : null
}

function numeroJson(dados: Record<string, unknown>, campo: string) {
  const valor = dados[campo]
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string') {
    const numero = Number(valor)
    return Number.isFinite(numero) ? numero : null
  }
  return null
}

function historicoParaTransferenciaAcao(registro: HistoricoAcaoRow): TransferenciaAcao {
  const dados = registro.dados || {}

  return {
    id: registro.id,
    transferencia_id: registro.entidade_id,
    acao: registro.acao,
    data_acao: registro.data_acao,
    placa: registro.placa || textoJson(dados, 'placa'),
    base_origem: textoJson(dados, 'base_origem'),
    base_destino: textoJson(dados, 'base_destino'),
    motorista: textoJson(dados, 'motorista'),
    observacao: textoJson(dados, 'observacao'),
    status_transferencia: textoJson(dados, 'status_transferencia'),
    responsavel_nome: registro.responsavel_nome,
    responsavel_email: registro.responsavel_email,
    corrige_acao_id: numeroJson(dados, 'corrige_acao_id'),
    corrigido_por_nome: textoJson(dados, 'corrigido_por_nome'),
    corrigido_em: textoJson(dados, 'corrigido_em'),
    motivo_correcao: textoJson(dados, 'motivo_correcao') || registro.motivo,
  }
}

export default function TransferenciasPage() {
  const permissoesAtualizadas = usePermissions()
  const podeEditar = ['dev', 'editor'].includes(permissoesAtualizadas.role)

  const [historico, setHistorico] = useState<TransferenciaAcao[]>([])
  const { busca, setBusca } = useTopbarSearch()
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [formEdicao, setFormEdicao] = useState<FormEdicao>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [filtrosColuna, setFiltrosColuna] = useState<FiltrosColuna>(FILTROS_INICIAIS)
  const [menuFiltroAberto, setMenuFiltroAberto] = useState<ColunaFiltro | null>(null)
  const motivoCorrecaoValido = formEdicao.motivo_correcao.trim().length >= 12

  const carregar = useCallback(async function carregar() {
    setCarregando(true)
    setMensagem('')

    try {
      const resposta = await fetch('/api/relatorios/historicos-acoes?tipo=transferencia')
      const resultado = await lerJsonSeguro(resposta)

      if (!resposta.ok) {
        throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao carregar historico.')
      }

      const data = Array.isArray(resultado.data) ? resultado.data as HistoricoAcaoRow[] : []
      setHistorico(data.map(historicoParaTransferenciaAcao))
    } catch {
      setMensagem('Erro ao carregar historico de acoes de transferencias.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const historicoVigente = useMemo(() => {
    const porId = new Map(historico.map((registro) => [registro.id, registro]))
    const correcoesPorOriginal = new Map<number, TransferenciaAcao>()

    historico.forEach((registro) => {
      if (registro.acao !== 'correcao' || !registro.corrige_acao_id) return

      const atual = correcoesPorOriginal.get(registro.corrige_acao_id)
      const dataRegistro = new Date(registro.corrigido_em || registro.data_acao).getTime()
      const dataAtual = atual ? new Date(atual.corrigido_em || atual.data_acao).getTime() : -1

      if (!atual || dataRegistro > dataAtual || (dataRegistro === dataAtual && registro.id > atual.id)) {
        correcoesPorOriginal.set(registro.corrige_acao_id, registro)
      }
    })

    return historico
      .filter((registro): registro is TransferenciaAcao & { acao: AcaoBase } => registro.acao !== 'correcao' && registro.acao !== 'exclusao')
      .map((registro) => {
        const correcao = correcoesPorOriginal.get(registro.id)
        const fonte = correcao || registro
        return {
          ...fonte,
          acao_exibida: registro.acao,
          acao_original_id: registro.id,
          corrigido: Boolean(correcao),
          corrige_acao_id: fonte.corrige_acao_id,
          corrigido_por_nome: fonte.corrigido_por_nome,
          corrigido_em: fonte.corrigido_em,
          motivo_correcao: fonte.motivo_correcao,
          transferencia_id: fonte.transferencia_id ?? registro.transferencia_id,
        }
      })
      .filter((registro) => porId.has(registro.acao_original_id))
      .sort((a, b) => new Date(b.data_acao).getTime() - new Date(a.data_acao).getTime())
  }, [historico])

  function formatarData(data: string | null) {
    if (!data) return '-'
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(data))
  }

  function paraDatetimeLocal(data: string | null) {
    if (!data) return ''
    const date = new Date(data)
    const offset = date.getTimezoneOffset()
    const local = new Date(date.getTime() - offset * 60000)
    return local.toISOString().slice(0, 16)
  }

  function dataLocalInicio(data: string) {
    if (!data) return null
    const [ano, mes, dia] = data.split('-').map(Number)
    return new Date(ano, mes - 1, dia, 0, 0, 0, 0).getTime()
  }

  function dataLocalFim(data: string) {
    if (!data) return null
    const [ano, mes, dia] = data.split('-').map(Number)
    return new Date(ano, mes - 1, dia, 23, 59, 59, 999).getTime()
  }

  function estaNoPeriodo(registro: RegistroExibido) {
    const inicio = dataLocalInicio(dataInicio)
    const fim = dataLocalFim(dataFim)
    const dataEvento = new Date(registro.data_acao).getTime()

    if (Number.isNaN(dataEvento)) return false
    if (inicio && dataEvento < inicio) return false
    if (fim && dataEvento > fim) return false
    return true
  }

  function valorColuna(registro: RegistroExibido, coluna: ColunaFiltro) {
    if (coluna === 'placa') return registro.placa || 'Nao informado'
    if (coluna === 'acao') return acaoLabel[registro.acao_exibida]
    if (coluna === 'data') return formatarData(registro.data_acao)
    if (coluna === 'origem') return registro.base_origem || 'Nao informado'
    if (coluna === 'destino') return registro.base_destino || 'Nao informado'
    if (coluna === 'motorista') return registro.motorista || 'Nao informado'
    if (coluna === 'responsavel') return registro.responsavel_nome || 'Nao informado'
    return registro.observacao || 'Nao informado'
  }

  const opcoesPorColuna = (() => {
    const colunasFiltro: ColunaFiltro[] = ['placa', 'acao', 'data', 'origem', 'destino', 'motorista', 'responsavel', 'observacao']
    return colunasFiltro.reduce((acc, coluna) => {
      acc[coluna] = Array.from(new Set(historicoVigente.map((registro) => valorColuna(registro, coluna))))
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      return acc
    }, {} as Record<ColunaFiltro, string[]>)
  })()

  function alternarFiltroColuna(coluna: ColunaFiltro, valor: string) {
    setFiltrosColuna((atuais) => {
      const selecionados = atuais[coluna]
      const proximos = selecionados.includes(valor)
        ? selecionados.filter((item) => item !== valor)
        : [...selecionados, valor]
      return { ...atuais, [coluna]: proximos }
    })
  }

  function limparFiltroColuna(coluna: ColunaFiltro) {
    setFiltrosColuna((atuais) => ({ ...atuais, [coluna]: [] }))
  }

  function iniciarEdicao(registro: RegistroExibido) {
    if (!podeEditar) return

    setMensagem('')
    setEditandoId(registro.acao_original_id)
    setFormEdicao({
      placa: registro.placa || '',
      base_origem: registro.base_origem || '',
      base_destino: registro.base_destino || '',
      motorista: registro.motorista || '',
      observacao: registro.observacao || '',
      data_acao: paraDatetimeLocal(registro.data_acao),
      status_transferencia: registro.status_transferencia || '',
      motivo_correcao: '',
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setFormEdicao(FORM_VAZIO)
  }

  async function salvarCorrecao() {
    if (!editandoId || !podeEditar) return

    if (!motivoCorrecaoValido) {
      setMensagem('Erro: informe um motivo da correcao com pelo menos 12 caracteres.')
      return
    }

    setSalvando(true)
    setMensagem('')

    try {
      const resposta = await fetch(`/api/relatorios/historicos-acoes/${editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEdicao),
      })
      const resultado = await lerJsonSeguro(resposta)

      if (!resposta.ok) throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao salvar correcao.')

      cancelarEdicao()
      setMensagem('Correcao registrada sem alterar a linha original.')
      await carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao salvar correcao: ${error.message}` : 'Erro ao salvar correcao.')
    } finally {
      setSalvando(false)
    }
  }

  const textoFiltro = busca.toLowerCase()
  const historicoFiltrado = historicoVigente.filter((registro) =>
    (
      registro.placa?.toLowerCase().includes(textoFiltro) ||
      registro.base_origem?.toLowerCase().includes(textoFiltro) ||
      registro.base_destino?.toLowerCase().includes(textoFiltro) ||
      registro.motorista?.toLowerCase().includes(textoFiltro) ||
      registro.responsavel_nome?.toLowerCase().includes(textoFiltro) ||
      acaoLabel[registro.acao_exibida].toLowerCase().includes(textoFiltro)
    ) && estaNoPeriodo(registro) && (Object.keys(filtrosColuna) as ColunaFiltro[]).every((coluna) => {
      const selecionados = filtrosColuna[coluna]
      if (selecionados.length === 0) return true
      return selecionados.includes(valorColuna(registro, coluna))
    })
  )
  const filtrosAtivos = Object.values(filtrosColuna).some((valores) => valores.length > 0)

  const colunas = podeEditar ? 9 : 8
  const registroEditando = editandoId
    ? historicoVigente.find((registro) => registro.acao_original_id === editandoId) || null
    : null

  return (
    <RequirePermissao permissao="transferencia">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <main className="app-scroll flex-1 min-h-screen overflow-y-auto bg-[#0a1625]">
          <section className="p-4 md:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-base font-semibold text-white tracking-tight">Historico de Transferencias</h1>
                <p className="mt-1 text-sm text-slate-400">
                  {podeEditar ? 'Clique em uma linha para registrar uma correcao auditavel.' : 'Visualizacao das acoes gravadas no Supabase.'}
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar placa, origem, destino..."
                  className="w-full sm:w-80 px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                />
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  De
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full sm:w-40 px-3 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm normal-case tracking-normal text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Ate
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full sm:w-40 px-3 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm normal-case tracking-normal text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                  />
                </label>
                <button
                  type="button"
                  onClick={carregar}
                  disabled={carregando}
                  title="Atualizar dados"
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#0f1c2e] border border-emerald-500/20 rounded-lg text-sm text-slate-400 hover:text-white hover:border-emerald-500/40 active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <span className={carregando ? 'animate-spin' : ''}>↻</span>
                  <span>Atualizar</span>
                </button>
              </div>
            </div>

            {mensagem && (
              <div className={`mb-4 rounded-xl border p-4 text-sm ${mensagem.includes('Erro') ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
                {mensagem}
              </div>
            )}

            {filtrosAtivos && (
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFiltrosColuna(FILTROS_INICIAIS)
                    setMenuFiltroAberto(null)
                  }}
                  className="rounded-lg border border-emerald-500/20 bg-[#132337] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:text-white cursor-pointer"
                >
                  Limpar filtros
                </button>
              </div>
            )}

            <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 overflow-hidden">
              <div className="app-scroll max-h-[68vh] overflow-y-auto overflow-x-auto">
                <table className="w-full min-w-[980px] text-xs">
                  <thead>
                    <tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10">
                      {([
                        ['placa', 'Placa'],
                        ['acao', 'Acao'],
                        ['data', 'Data/Hora'],
                        ['origem', 'De'],
                        ['destino', 'Para'],
                        ['motorista', 'Motorista'],
                        ['responsavel', 'Responsavel'],
                        ['observacao', 'Observacao'],
                      ] as Array<[ColunaFiltro, string]>).map(([coluna, label]) => (
                        <ColumnFilterHeader
                          key={coluna}
                          coluna={coluna}
                          label={label}
                          selecionados={filtrosColuna[coluna]}
                          opcoes={opcoesPorColuna[coluna]}
                          aberto={menuFiltroAberto === coluna}
                          ativo={filtrosColuna[coluna].length > 0}
                          onAbrir={(proximaColuna) => setMenuFiltroAberto(menuFiltroAberto === proximaColuna ? null : proximaColuna)}
                          onAlternar={alternarFiltroColuna}
                          onFechar={() => setMenuFiltroAberto(null)}
                          onLimpar={limparFiltroColuna}
                        />
                      ))}
                      {podeEditar && <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wide whitespace-nowrap">Editar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {carregando ? (
                      <tr>
                        <td colSpan={colunas} className="px-3 py-8 text-center text-slate-500">Carregando registros...</td>
                      </tr>
                    ) : historicoFiltrado.length === 0 ? (
                      <tr>
                        <td colSpan={colunas} className="px-3 py-8 text-center text-slate-500">Nenhum registro.</td>
                      </tr>
                    ) : (
                      historicoFiltrado.map((registro) => (
                        <Fragment key={registro.acao_original_id}>
                          <tr className="hover:bg-emerald-500/5 transition-colors">
                            <td className="px-3 py-2.5 text-center text-sm font-semibold text-emerald-300 whitespace-nowrap">{registro.placa || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{acaoLabel[registro.acao_exibida]}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{formatarData(registro.data_acao)}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.base_origem || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.base_destino || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.motorista || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.responsavel_nome || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.observacao || '-'}</td>
                            {podeEditar && (
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => iniciarEdicao(registro)}
                                  className="px-3 py-1.5 rounded-lg border border-emerald-500/25 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 transition"
                                >
                                  Corrigir
                                </button>
                              </td>
                            )}
                          </tr>
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 text-right text-xs text-slate-500">
              Total de registros: {historicoFiltrado.length}
            </div>
          </section>

          {podeEditar && registroEditando && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
              <div className="report-modal app-scroll max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-emerald-500/20 bg-[#132337] p-5 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">Corrigir registro</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {registroEditando.placa || '-'} - {acaoLabel[registroEditando.acao_exibida]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelarEdicao}
                    disabled={salvando}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    Fechar
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Data/Hora
                    <input
                      type="datetime-local"
                      value={formEdicao.data_acao}
                      onChange={(e) => setFormEdicao((atual) => ({ ...atual, data_acao: e.target.value }))}
                      className="report-modal-field w-full min-w-0 rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-3 py-2.5 text-sm normal-case tracking-normal text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                  {(['placa', 'base_origem', 'base_destino', 'motorista', 'observacao', 'status_transferencia'] as const).map((campo) => (
                    <label key={campo} className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {campo.replace('_', ' ')}
                      <input
                        type="text"
                        value={formEdicao[campo]}
                        onChange={(e) => setFormEdicao((atual) => ({ ...atual, [campo]: e.target.value }))}
                        className="report-modal-field w-full min-w-0 rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-3 py-2.5 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>
                  ))}
                  <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:col-span-2">
                    Motivo da correcao
                    <input
                      type="text"
                      value={formEdicao.motivo_correcao}
                      onChange={(e) => setFormEdicao((atual) => ({ ...atual, motivo_correcao: e.target.value }))}
                      minLength={12}
                      required
                      autoFocus
                      placeholder="Ex: ajuste de placa, horario ou base"
                      className={`report-modal-field w-full min-w-0 rounded-lg border bg-[#0f1c2e] px-3 py-2.5 text-sm normal-case tracking-normal text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition ${motivoCorrecaoValido ? 'border-emerald-500/20 focus:ring-emerald-400/40' : 'border-red-500/30 focus:ring-red-400/30'}`}
                    />
                    <span className={motivoCorrecaoValido ? 'text-[11px] normal-case tracking-normal text-slate-500' : 'text-[11px] normal-case tracking-normal text-red-300'}>
                      Minimo de 12 caracteres. Atual: {formEdicao.motivo_correcao.trim().length}
                    </span>
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={cancelarEdicao}
                    disabled={salvando}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvarCorrecao}
                    disabled={salvando || !motivoCorrecaoValido}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {salvando ? 'Salvando...' : 'Salvar correcao'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </RequirePermissao>
  )
}
