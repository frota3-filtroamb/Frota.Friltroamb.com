'use client'

import RequirePermissao from '@/components/RequirePermissao'
import Sidebar from '@/components/Sidebar'
import { useTopbarSearch } from '@/components/TopbarSearchProvider'
import { usePermissions } from '@/components/PermissionsProvider'
import { lerJsonSeguro } from '@/lib/http'
import { createClient } from '@/lib/supabase/client'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

type AcaoBase = 'liberacao' | 'saida' | 'entrada'
type AcaoBanco = AcaoBase | 'correcao'

type MovimentacaoAcao = {
  id: number
  movimentacao_pedestre_id: number | null
  acao: AcaoBanco
  data_acao: string
  nome: string | null
  cpf_rg: string | null
  telefone: string | null
  empresa: string | null
  destino: string | null
  status_movimentacao: string | null
  responsavel_nome: string | null
  responsavel_email: string | null
  responsavel_id: string | null
  corrige_acao_id: number | null
  corrigido_por_nome: string | null
  corrigido_em: string | null
  motivo_correcao: string | null
  sintetico?: boolean
}

type Pedestre = {
  id: number
  nome: string
  cpf_rg: string | null
  telefone: string | null
  empresa: string | null
  destino: string | null
  status: string
  liberado_em: string | null
  entrada_em: string | null
  saida_em: string | null
  liberado_por?: string | null
}

type RegistroExibido = MovimentacaoAcao & {
  acao_exibida: AcaoBase
  acao_original_id: number
  corrigido: boolean
}

type FormEdicao = {
  nome: string
  empresa: string
  destino: string
  data_acao: string
  motivo_correcao: string
}

const FORM_VAZIO: FormEdicao = {
  nome: '',
  empresa: '',
  destino: '',
  data_acao: '',
  motivo_correcao: '',
}

const acaoLabel: Record<AcaoBase, string> = {
  liberacao: 'Liberacao',
  saida: 'Saida',
  entrada: 'Entrada',
}


export default function EntradaSaidaPedestresPage() {
  const supabase = useMemo(() => createClient(), [])
  const permissoesAtualizadas = usePermissions()
  const podeEditar = ['dev', 'editor'].includes(permissoesAtualizadas.role)

  const [historico, setHistorico] = useState<MovimentacaoAcao[]>([])
  const { busca, setBusca } = useTopbarSearch()
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [formEdicao, setFormEdicao] = useState<FormEdicao>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<number | null>(null)
  const [motivoExclusao, setMotivoExclusao] = useState('')
  const [excluindoId, setExcluindoId] = useState<number | null>(null)
  const motivoCorrecaoValido = formEdicao.motivo_correcao.trim().length >= 12
  const motivoExclusaoValido = motivoExclusao.trim().length >= 12

  const carregar = useCallback(async function carregar() {
    setCarregando(true)
    setMensagem('')

    try {
      const { data, error } = await supabase
        .from('movimentacoes_pedestres_acoes')
        .select('*')
        .order('data_acao', { ascending: false })
        .limit(3000)

      if (error) throw error

      const acoes = data || []
      const { data: pedestres, error: pedestresError } = await supabase
        .from('movimentacoes_pedestres')
        .select('*')
        .order('liberado_em', { ascending: false })
        .limit(3000)

      if (pedestresError) throw pedestresError

      const idsComLiberacao = new Set(
        acoes
          .filter((acao) => acao.acao === 'liberacao' && acao.movimentacao_pedestre_id)
          .map((acao) => acao.movimentacao_pedestre_id),
      )
      const pedestresSemLiberacao = (pedestres || []).filter((pedestre: Pedestre) => !idsComLiberacao.has(pedestre.id))

      let acoesFaltantes: MovimentacaoAcao[] = []
      if (pedestresSemLiberacao.length > 0) {
        const novasAcoes = pedestresSemLiberacao.map((pedestre: Pedestre) => ({
          movimentacao_pedestre_id: pedestre.id,
          acao: 'liberacao',
          data_acao: pedestre.liberado_em || new Date().toISOString(),
          nome: pedestre.nome,
          cpf_rg: pedestre.cpf_rg,
          telefone: pedestre.telefone,
          empresa: pedestre.empresa,
          destino: pedestre.destino,
          status_movimentacao: pedestre.status,
          responsavel_nome: pedestre.liberado_por || null,
        }))

        const { data: inseridas, error: inserirError } = await supabase
          .from('movimentacoes_pedestres_acoes')
          .insert(novasAcoes)
          .select('*')

        if (inserirError) {
          acoesFaltantes = pedestresSemLiberacao.map((pedestre: Pedestre) => ({
            id: -pedestre.id,
            movimentacao_pedestre_id: pedestre.id,
            acao: 'liberacao' as const,
            data_acao: pedestre.liberado_em || new Date().toISOString(),
            nome: pedestre.nome,
            cpf_rg: pedestre.cpf_rg,
            telefone: pedestre.telefone,
            empresa: pedestre.empresa,
            destino: pedestre.destino,
            status_movimentacao: pedestre.status,
            responsavel_nome: pedestre.liberado_por || null,
            responsavel_email: null,
            responsavel_id: null,
            corrige_acao_id: null,
            corrigido_por_nome: null,
            corrigido_em: null,
            motivo_correcao: null,
            sintetico: true,
          }))
        } else {
          acoesFaltantes = inseridas || []
        }
      }

      setHistorico([...acoes, ...acoesFaltantes])
    } catch {
      setMensagem('Erro ao carregar historico de acoes de pedestres.')
    } finally {
      setCarregando(false)
    }
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  const historicoVigente = useMemo(() => {
    const porId = new Map(historico.map((registro) => [registro.id, registro]))
    const correcoesPorOriginal = new Map<number, MovimentacaoAcao>()

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
      .filter((registro): registro is MovimentacaoAcao & { acao: AcaoBase } => registro.acao !== 'correcao')
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
          movimentacao_pedestre_id: fonte.movimentacao_pedestre_id ?? registro.movimentacao_pedestre_id,
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

  function iniciarEdicao(registro: RegistroExibido) {
    if (!podeEditar) return

    setMensagem('')
    setEditandoId(registro.acao_original_id)
    setConfirmandoExclusaoId(null)
    setFormEdicao({
      nome: registro.nome || '',
      empresa: registro.empresa || '',
      destino: registro.destino || '',
      data_acao: paraDatetimeLocal(registro.data_acao),
      motivo_correcao: '',
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setFormEdicao(FORM_VAZIO)
  }

  function iniciarExclusao(registro: RegistroExibido) {
    if (!podeEditar || registro.sintetico) return
    setMensagem('')
    setEditandoId(null)
    setConfirmandoExclusaoId(registro.acao_original_id)
    setMotivoExclusao('')
  }

  function cancelarExclusao() {
    setConfirmandoExclusaoId(null)
    setMotivoExclusao('')
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
      const resposta = await fetch(`/api/relatorios/movimentacoes-pedestres-acoes/${editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formEdicao.nome,
          cpf_rg: null,
          telefone: null,
          empresa: formEdicao.empresa,
          destino: formEdicao.destino,
          data_acao: formEdicao.data_acao,
          motivo_correcao: formEdicao.motivo_correcao,
        }),
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

  async function excluirRegistro(registro: RegistroExibido) {
    if (!podeEditar || excluindoId || registro.sintetico) return

    if (!motivoExclusaoValido) {
      setMensagem('Erro: informe um motivo da exclusao com pelo menos 12 caracteres.')
      return
    }

    setExcluindoId(registro.acao_original_id)
    setMensagem('')

    try {
      const resposta = await fetch(`/api/relatorios/movimentacoes-pedestres-acoes/${registro.acao_original_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo_exclusao: motivoExclusao.trim() }),
      })
      const resultado = await lerJsonSeguro(resposta)

      if (!resposta.ok) throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao excluir registro.')

      if (editandoId === registro.acao_original_id) cancelarEdicao()
      cancelarExclusao()
      setMensagem('Registro excluido e arquivado na tabela de exclusoes.')
      await carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao excluir registro: ${error.message}` : 'Erro ao excluir registro.')
    } finally {
      setExcluindoId(null)
    }
  }

  const textoFiltro = busca.toLowerCase()
  const historicoFiltrado = historicoVigente.filter((registro) =>
    (
      registro.nome?.toLowerCase().includes(textoFiltro) ||
      registro.cpf_rg?.toLowerCase().includes(textoFiltro) ||
      registro.empresa?.toLowerCase().includes(textoFiltro) ||
      registro.destino?.toLowerCase().includes(textoFiltro) ||
      registro.responsavel_nome?.toLowerCase().includes(textoFiltro) ||
      acaoLabel[registro.acao_exibida].toLowerCase().includes(textoFiltro)
    ) && estaNoPeriodo(registro)
  )

  const colunas = podeEditar ? 7 : 6
  const registroEditando = editandoId
    ? historicoVigente.find((registro) => registro.acao_original_id === editandoId) || null
    : null
  const registroExcluindo = confirmandoExclusaoId
    ? historicoVigente.find((registro) => registro.acao_original_id === confirmandoExclusaoId) || null
    : null

  return (
    <RequirePermissao permissao="portaria">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <main className="app-scroll flex-1 min-h-screen overflow-y-auto bg-[#0a1625]">
          <section className="p-4 md:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-base font-semibold text-white tracking-tight">Historico de Pedestres</h1>
                <p className="mt-1 text-sm text-slate-400">
                  {podeEditar ? 'Clique em uma linha para registrar uma correcao auditavel.' : 'Visualizacao das acoes gravadas no Supabase.'}
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar nome, empresa, destino..."
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

            <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 overflow-hidden">
              <div className="app-scroll max-h-[68vh] overflow-y-auto overflow-x-auto">
                <table className="w-full min-w-[900px] text-xs">
                  <thead>
                    <tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10">
                      <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wide whitespace-nowrap">Nome</th>
                      <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wide whitespace-nowrap">Acao</th>
                      <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wide whitespace-nowrap">Data/Hora</th>
                      <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wide whitespace-nowrap">Empresa</th>
                      <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wide whitespace-nowrap">Destino</th>
                      <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wide whitespace-nowrap">Responsavel</th>
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
                            <td className="px-3 py-2.5 text-center text-sm font-semibold text-emerald-300 whitespace-nowrap">{registro.nome || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{acaoLabel[registro.acao_exibida]}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{formatarData(registro.data_acao)}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.empresa || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.destino || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.responsavel_nome || '-'}</td>
                            {podeEditar && (
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => iniciarEdicao(registro)}
                                    disabled={registro.sintetico || excluindoId === registro.acao_original_id}
                                    title={registro.sintetico ? 'Aguardando gravacao da acao no banco' : undefined}
                                    className="px-3 py-1.5 rounded-lg border border-emerald-500/25 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 transition disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Corrigir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => iniciarExclusao(registro)}
                                    disabled={registro.sintetico || excluindoId === registro.acao_original_id}
                                    title={registro.sintetico ? 'Aguardando gravacao da acao no banco' : undefined}
                                    className="px-3 py-1.5 rounded-lg border border-red-500/25 text-xs font-semibold text-red-300 hover:bg-red-500/10 transition disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {excluindoId === registro.acao_original_id ? 'Excluindo...' : 'Excluir'}
                                  </button>
                                </div>
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
                      {registroEditando.nome || '-'} - {acaoLabel[registroEditando.acao_exibida]}
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
                  {(['nome', 'empresa', 'destino'] as const).map((campo) => (
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
                      placeholder="Ex: ajuste de horario, nome ou destino"
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

          {podeEditar && registroExcluindo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
              <div className="report-modal w-full max-w-xl rounded-2xl border border-red-500/20 bg-[#132337] p-5 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-red-300">Excluir registro</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {registroExcluindo.nome || '-'} - {acaoLabel[registroExcluindo.acao_exibida]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelarExclusao}
                    disabled={excluindoId === registroExcluindo.acao_original_id}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    Fechar
                  </button>
                </div>

                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Motivo da exclusao
                  <input
                    type="text"
                    value={motivoExclusao}
                    onChange={(e) => setMotivoExclusao(e.target.value)}
                    minLength={12}
                    autoFocus
                    placeholder="Ex: liberacao lancada por engano."
                    className={`report-modal-field w-full min-w-0 rounded-lg border bg-[#0f1c2e] px-3 py-2.5 text-sm normal-case tracking-normal text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition ${motivoExclusaoValido ? 'border-red-500/25 focus:ring-red-400/30' : 'border-red-500/40 focus:ring-red-400/30'}`}
                  />
                  <span className={motivoExclusaoValido ? 'text-[11px] normal-case tracking-normal text-slate-500' : 'text-[11px] normal-case tracking-normal text-red-300'}>
                    Minimo de 12 caracteres. Atual: {motivoExclusao.trim().length}
                  </span>
                </label>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={cancelarExclusao}
                    disabled={excluindoId === registroExcluindo.acao_original_id}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => excluirRegistro(registroExcluindo)}
                    disabled={excluindoId === registroExcluindo.acao_original_id || !motivoExclusaoValido}
                    className="rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {excluindoId === registroExcluindo.acao_original_id ? 'Excluindo...' : 'Confirmar exclusao'}
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
