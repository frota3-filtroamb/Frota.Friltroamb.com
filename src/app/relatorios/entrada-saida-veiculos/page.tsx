'use client'

import RequirePermissao from '@/components/RequirePermissao'
import Sidebar from '@/components/Sidebar'
import ColumnFilterHeader from '@/components/ColumnFilterHeader'
import { useTopbarSearch } from '@/components/TopbarSearchProvider'
import { usePermissions } from '@/components/PermissionsProvider'
import { lerJsonSeguro } from '@/lib/http'
import { formatPlateDisplay } from '@/lib/masks'
import { createClient } from '@/lib/supabase/client'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

type AcaoBase = 'liberacao' | 'saida' | 'entrada' | 'saida_autorizada'
type AcaoBanco = AcaoBase | 'correcao' | 'exclusao'

type MovimentacaoAcao = {
  id: number
  movimentacao_id: number | null
  acao: AcaoBanco
  data_acao: string
  placa: string | null
  motorista: string | null
  km: number | null
  origem: string | null
  destino: string | null
  observacao: string | null
  tipo_veiculo: string | null
  modelo_externo: string | null
  status_movimentacao: string | null
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
  porteiro_nome: string | null
  motivo: string | null
  dados: Record<string, unknown> | null
}

type RegistroExibido = MovimentacaoAcao & {
  acao_exibida: AcaoBase
  acao_original_id: number
  corrigido: boolean
}

type FormEdicao = {
  placa: string
  motorista: string
  km: string
  origem: string
  destino: string
  data_acao: string
  tipo_veiculo: string
  status_movimentacao: string
  motivo_correcao: string
}

type Veiculo = {
  NR_PLACA: string | null
  DS_MODELO: string | null
}

type OpcaoCadastro = {
  id: number | string
  nome: string | null
}

type MovimentacaoModelo = {
  id: number
  modelo_externo: string | null
}

type ColunaFiltro = 'placa' | 'acao' | 'data' | 'motorista' | 'km' | 'responsavel' | 'destino' | 'tipo' | 'obs'
type FiltrosColuna = Record<ColunaFiltro, string[]>

const FORM_VAZIO: FormEdicao = {
  placa: '',
  motorista: '',
  km: '',
  origem: '',
  destino: '',
  data_acao: '',
  tipo_veiculo: '',
  status_movimentacao: '',
  motivo_correcao: '',
}

const acaoLabel: Record<AcaoBase, string> = {
  liberacao: 'Liberacao',
  saida: 'Saida',
  entrada: 'Entrada',
  saida_autorizada: 'Saida autorizada',
}

const FILTROS_INICIAIS: FiltrosColuna = {
  placa: [],
  acao: [],
  data: [],
  motorista: [],
  km: [],
  responsavel: [],
  destino: [],
  tipo: [],
  obs: [],
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

function historicoParaMovimentacaoAcao(registro: HistoricoAcaoRow): MovimentacaoAcao {
  const dados = registro.dados || {}

  return {
    id: registro.id,
    movimentacao_id: registro.entidade_id,
    acao: registro.acao,
    data_acao: registro.data_acao,
    placa: registro.placa || textoJson(dados, 'placa'),
    motorista: textoJson(dados, 'motorista'),
    km: numeroJson(dados, 'km'),
    origem: textoJson(dados, 'origem'),
    destino: textoJson(dados, 'destino'),
    observacao: textoJson(dados, 'observacao'),
    tipo_veiculo: textoJson(dados, 'tipo_veiculo'),
    modelo_externo: textoJson(dados, 'modelo_externo'),
    status_movimentacao: textoJson(dados, 'status_movimentacao'),
    responsavel_nome: registro.responsavel_nome,
    responsavel_email: registro.responsavel_email,
    corrige_acao_id: numeroJson(dados, 'corrige_acao_id'),
    corrigido_por_nome: textoJson(dados, 'corrigido_por_nome'),
    corrigido_em: textoJson(dados, 'corrigido_em'),
    motivo_correcao: textoJson(dados, 'motivo_correcao') || registro.motivo,
  }
}

export default function EntradaSaidaVeiculosPage() {
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
  const [veiculosCadastro, setVeiculosCadastro] = useState<Veiculo[]>([])
  const [motoristasCadastro, setMotoristasCadastro] = useState<OpcaoCadastro[]>([])
  const [destinosCadastro, setDestinosCadastro] = useState<OpcaoCadastro[]>([])
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<number | null>(null)
  const [motivoExclusao, setMotivoExclusao] = useState('')
  const [excluindoId, setExcluindoId] = useState<number | null>(null)
  const [filtrosColuna, setFiltrosColuna] = useState<FiltrosColuna>(FILTROS_INICIAIS)
  const [menuFiltroAberto, setMenuFiltroAberto] = useState<ColunaFiltro | null>(null)
  const motivoCorrecaoValido = formEdicao.motivo_correcao.trim().length >= 12
  const motivoExclusaoValido = motivoExclusao.trim().length >= 12

  const carregar = useCallback(async function carregar() {
    setCarregando(true)
    setMensagem('')

    try {
      const resposta = await fetch('/api/relatorios/historicos-acoes?tipo=veiculo')
      const resultado = await lerJsonSeguro(resposta)

      if (!resposta.ok) {
        throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao carregar historico.')
      }

      const data = Array.isArray(resultado.data) ? resultado.data as HistoricoAcaoRow[] : []
      const acoes = (data || []).map(historicoParaMovimentacaoAcao)
      const movimentacaoIds = Array.from(new Set(
        acoes
          .map((acao) => acao.movimentacao_id)
          .filter((id): id is number => typeof id === 'number'),
      ))

      if (movimentacaoIds.length === 0) {
        setHistorico(acoes)
        return
      }

      const { data: movimentacoesModelos } = await supabase
        .from('TBL_MOVIMENTACOES')
        .select('id, modelo_externo')
        .eq('tipo_entidade', 'veiculo')
        .in('id', movimentacaoIds)
        .returns<MovimentacaoModelo[]>()

      const modeloPorMovimentacao = new Map(
        (movimentacoesModelos || []).map((movimentacao) => [movimentacao.id, movimentacao.modelo_externo]),
      )

      setHistorico(acoes.map((acao) => ({
        ...acao,
        modelo_externo: acao.modelo_externo || modeloPorMovimentacao.get(acao.movimentacao_id || 0) || null,
      })))
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : 'Erro desconhecido.'
      setMensagem(`Erro ao carregar historico de acoes de veiculos: ${detalhe}`)
    } finally {
      setCarregando(false)
    }
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    async function carregarCadastros() {
      const [veiculosQuery, motoristasQuery, destinosQuery] = await Promise.all([
        supabase.from('TBL_VEICULOS').select('NR_PLACA, DS_MODELO').order('NR_PLACA'),
        supabase.from('TBL_CADASTROS').select('id, nome').order('nome'),
        supabase.from('TBL_DESTINOS').select('id, nome').order('nome'),
      ])

      if (!veiculosQuery.error) setVeiculosCadastro(veiculosQuery.data || [])
      if (!motoristasQuery.error) setMotoristasCadastro(motoristasQuery.data || [])
      if (!destinosQuery.error) setDestinosCadastro(destinosQuery.data || [])
    }

    carregarCadastros()
  }, [supabase])

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
      .filter((registro): registro is MovimentacaoAcao & { acao: AcaoBase } => registro.acao !== 'correcao' && registro.acao !== 'exclusao')
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
          movimentacao_id: fonte.movimentacao_id ?? registro.movimentacao_id,
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

  function formatarNumero(valor: number | null) {
    if (valor === null) return '-'
    return valor.toLocaleString('pt-BR')
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

  function formatarTipoVeiculo(tipo: string | null, modeloExterno?: string | null) {
    if (!tipo) return '-'
    if ((tipo === 'externo' || tipo === 'veiculo_externo') && modeloExterno) {
      return `Externo - ${modeloExterno}`
    }
    if (tipo === 'interno_entrada') return 'Interno Entrada'
    if (tipo === 'interno_saida') return 'Interno Saida'
    return tipo.charAt(0).toUpperCase() + tipo.slice(1)
  }

  function valorColuna(registro: RegistroExibido, coluna: ColunaFiltro) {
    if (coluna === 'placa') return registro.placa || 'Nao informado'
    if (coluna === 'acao') return acaoLabel[registro.acao_exibida]
    if (coluna === 'data') return formatarData(registro.data_acao)
    if (coluna === 'motorista') return registro.motorista || 'Nao informado'
    if (coluna === 'km') return formatarNumero(registro.km)
    if (coluna === 'responsavel') return registro.responsavel_nome || 'Nao informado'
    if (coluna === 'destino') return registro.destino || 'Nao informado'
    if (coluna === 'tipo') return formatarTipoVeiculo(registro.tipo_veiculo, registro.modelo_externo)
    return registro.observacao || 'Nao informado'
  }

  const opcoesPorColuna = (() => {
    const colunasFiltro: ColunaFiltro[] = ['placa', 'acao', 'data', 'motorista', 'km', 'responsavel', 'destino', 'tipo', 'obs']
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
      motorista: registro.motorista || '',
      km: registro.km === null ? '' : String(registro.km),
      origem: registro.origem || '',
      destino: registro.destino || '',
      data_acao: paraDatetimeLocal(registro.data_acao),
      tipo_veiculo: registro.tipo_veiculo || '',
      status_movimentacao: registro.status_movimentacao || '',
      motivo_correcao: '',
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setFormEdicao(FORM_VAZIO)
  }

  function iniciarExclusao(registro: RegistroExibido) {
    if (!podeEditar) return
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
      const resposta = await fetch(`/api/relatorios/historicos-acoes/${editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: formEdicao.placa,
          motorista: formEdicao.motorista,
          km: formEdicao.km,
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
    if (!podeEditar || excluindoId) return

    if (!motivoExclusaoValido) {
      setMensagem('Erro: informe um motivo da exclusao com pelo menos 12 caracteres.')
      return
    }

    setExcluindoId(registro.acao_original_id)
    setMensagem('')

    try {
      const resposta = await fetch(`/api/relatorios/historicos-acoes/${registro.acao_original_id}`, {
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
      registro.placa?.toLowerCase().includes(textoFiltro) ||
      registro.motorista?.toLowerCase().includes(textoFiltro) ||
      registro.origem?.toLowerCase().includes(textoFiltro) ||
      registro.destino?.toLowerCase().includes(textoFiltro) ||
      registro.observacao?.toLowerCase().includes(textoFiltro) ||
      acaoLabel[registro.acao_exibida].toLowerCase().includes(textoFiltro)
    ) && estaNoPeriodo(registro) && (Object.keys(filtrosColuna) as ColunaFiltro[]).every((coluna) => {
      const selecionados = filtrosColuna[coluna]
      if (selecionados.length === 0) return true
      return selecionados.includes(valorColuna(registro, coluna))
    })
  )
  const filtrosAtivos = Object.values(filtrosColuna).some((valores) => valores.length > 0)

  const colunas = podeEditar ? 10 : 9
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
                <h1 className="text-base font-semibold text-white tracking-tight">Historico de Acoes</h1>
                <p className="mt-1 text-sm text-slate-400">
                  {podeEditar ? 'Clique em uma linha para registrar uma correcao auditavel.' : 'Visualizacao das acoes gravadas no Supabase.'}
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar placa, motorista, origem, destino..."
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
                <table className="w-full min-w-[1040px] text-xs">
                  <thead>
                    <tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10">
                      {([
                        ['placa', 'Placa'],
                        ['acao', 'Acao'],
                        ['data', 'Data/Hora'],
                        ['motorista', 'Motorista'],
                        ['km', 'KM'],
                        ['responsavel', 'Responsavel'],
                        ['destino', 'Destino'],
                        ['tipo', 'Tipo'],
                        ['obs', 'OBS'],
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
                      {podeEditar && <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wide whitespace-nowrap">Acoes</th>}
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
                          <tr key={registro.acao_original_id} className="hover:bg-emerald-500/5 transition-colors">
                            <td className="px-3 py-2.5 text-center text-sm font-semibold text-emerald-300 whitespace-nowrap">{registro.placa || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{acaoLabel[registro.acao_exibida]}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{formatarData(registro.data_acao)}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.motorista || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{formatarNumero(registro.km)}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.responsavel_nome || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{registro.destino || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-sm font-bold whitespace-nowrap">{formatarTipoVeiculo(registro.tipo_veiculo, registro.modelo_externo)}</td>
                            <td className="max-w-[180px] truncate px-3 py-2.5 text-center text-sm font-bold" title={registro.observacao || undefined}>{registro.observacao || '-'}</td>
                            {podeEditar && (
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => iniciarEdicao(registro)}
                                    disabled={excluindoId === registro.acao_original_id}
                                    className="px-3 py-1.5 rounded-lg border border-emerald-500/25 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 transition disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Corrigir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => iniciarExclusao(registro)}
                                    disabled={excluindoId === registro.acao_original_id}
                                    className="px-3 py-1.5 rounded-lg border border-red-500/25 text-xs font-semibold text-red-300 hover:bg-red-500/10 transition disabled:cursor-not-allowed disabled:opacity-50"
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
                  <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Placa
                    <input
                      type="text"
                      list="relatorio-veiculos-placas"
                      value={formEdicao.placa}
                      onChange={(e) => setFormEdicao((atual) => ({ ...atual, placa: e.target.value }))}
                      className="report-modal-field w-full min-w-0 rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-3 py-2.5 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                    <datalist id="relatorio-veiculos-placas">
                      {veiculosCadastro
                        .filter((veiculo) => veiculo.NR_PLACA)
                        .map((veiculo) => (
                          <option key={veiculo.NR_PLACA || ''} value={formatPlateDisplay(veiculo.NR_PLACA || '')}>
                            {veiculo.DS_MODELO || 'Veiculo cadastrado'}
                          </option>
                        ))}
                    </datalist>
                  </label>

                  <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Motorista
                    <input
                      type="text"
                      list="relatorio-veiculos-motoristas"
                      value={formEdicao.motorista}
                      onChange={(e) => setFormEdicao((atual) => ({ ...atual, motorista: e.target.value }))}
                      className="report-modal-field w-full min-w-0 rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-3 py-2.5 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                    <datalist id="relatorio-veiculos-motoristas">
                      {motoristasCadastro
                        .filter((motorista) => motorista.nome)
                        .map((motorista) => (
                          <option key={motorista.id} value={motorista.nome || ''} />
                        ))}
                    </datalist>
                  </label>

                  <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    KM
                    <input
                      type="number"
                      value={formEdicao.km}
                      onChange={(e) => setFormEdicao((atual) => ({ ...atual, km: e.target.value }))}
                      className="report-modal-field w-full min-w-0 rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-3 py-2.5 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>

                  <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Destino
                    <input
                      type="text"
                      list="relatorio-veiculos-destinos"
                      value={formEdicao.destino}
                      onChange={(e) => setFormEdicao((atual) => ({ ...atual, destino: e.target.value }))}
                      className="report-modal-field w-full min-w-0 rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-3 py-2.5 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                    <datalist id="relatorio-veiculos-destinos">
                      {destinosCadastro
                        .filter((destino) => destino.nome)
                        .map((destino) => (
                          <option key={destino.id} value={destino.nome || ''} />
                        ))}
                    </datalist>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:col-span-2">
                    Motivo da correcao
                    <input
                      type="text"
                      value={formEdicao.motivo_correcao}
                      onChange={(e) => setFormEdicao((atual) => ({ ...atual, motivo_correcao: e.target.value }))}
                      minLength={12}
                      required
                      autoFocus
                      placeholder="Ex: ajuste de horario, motorista ou destino"
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
                      {registroExcluindo.placa || '-'} - {acaoLabel[registroExcluindo.acao_exibida]}
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
                    placeholder="Ex: km errado, motorista."
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
