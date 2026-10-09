'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useUser } from '@clerk/nextjs'
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { useTopbarSearch } from '@/components/TopbarSearchProvider'
import { usePermissions } from '@/components/PermissionsProvider'
import { lerJsonSeguro } from '@/lib/http'
import { formatCpf, formatPhone, formatPlate, formatPlateDisplay, onlyDigits } from '@/lib/masks'
import { useRouter, useSearchParams } from 'next/navigation'

type Veiculo = {
  NR_PLACA: string
  DS_MODELO: string | null
  DS_MARCA: string | null
}

type Item = {
  id: number | string
  nome: string
}

type Movimentacao = {
  id: number
  origem_tabela?: string | null
  origem_id?: number | null
  placa: string
  km: number | null
  motorista: string | null
  localizacao: string | null
  destino: string | null
  observacao: string | null
  status: string
  liberado_em: string | null
  saida_em: string | null
  entrada_em: string | null
  tipo_veiculo?: string | null
  gestor_responsavel_id?: string | null
  gestor_responsavel_nome?: string | null
  gestor_responsavel_email?: string | null
  gestor_responsavel_setor?: string | null
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
}

type Transferencia = {
  id: number
  placa: string
  km: number | null
  base_origem: string
  base_destino: string
  motorista: string | null
  observacao: string | null
  status: string | null
  transferido_em: string | null
  transferido_por: string | null
}

type TransferenciaMovimentacao = {
  id: number
  placa: string
  km: number | null
  localizacao: string | null
  destino: string | null
  motorista: string | null
  observacao: string | null
  status: string | null
  liberado_em: string | null
  liberado_por: string | null
}

type AcaoMovimentacao = {
  entidade_id: number | string | null
  acao: string
}

type FiltroResumoVeiculos = 'todos' | 'interno' | 'externo' | 'transferencia'
type AcaoPendente = {
  tipo: string
  id: number
  titulo: string
  descricao: string
}

function PortariaContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded } = useUser()
  const permissoesAtualizadas = usePermissions()

  const [abaAtual, setAbaAtual] = useState<'veiculos' | 'autorizacoes' | 'pedestres' | 'veiculo_interno'>('veiculos')
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [acoesMovimentacoes, setAcoesMovimentacoes] = useState<AcaoMovimentacao[]>([])
  const [pedestres, setPedestres] = useState<Pedestre[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [motoristas, setMotoristas] = useState<Item[]>([])
  const [porteiros, setPorteiros] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [registrandoInterno, setRegistrandoInterno] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const { busca, setBusca } = useTopbarSearch()
  const [acaoEmAndamentoId, setAcaoEmAndamentoId] = useState<string | null>(null)
  const [transferenciaParaConfirmar, setTransferenciaParaConfirmar] = useState<Transferencia | null>(null)
  const [movimentoVeiculoInterno, setMovimentoVeiculoInterno] = useState<'entrada' | 'saida'>('entrada')
  const [buscaPlacaInterna, setBuscaPlacaInterna] = useState('')
  const [veiculoInternoSelecionado, setVeiculoInternoSelecionado] = useState<Veiculo | null>(null)
  const [mostrarListaPlacaInterna, setMostrarListaPlacaInterna] = useState(false)
  const [buscaMotoristaInterno, setBuscaMotoristaInterno] = useState('')
  const [motoristaInternoSelecionado, setMotoristaInternoSelecionado] = useState('')
  const [mostrarListaMotoristaInterno, setMostrarListaMotoristaInterno] = useState(false)
  const [dataHoraInterno, setDataHoraInterno] = useState('')
  const [filtroResumoVeiculos, setFiltroResumoVeiculos] = useState<FiltroResumoVeiculos>('todos')
  const [acaoPendente, setAcaoPendente] = useState<AcaoPendente | null>(null)
  const [porteiroSelecionadoId, setPorteiroSelecionadoId] = useState('')

  const podeControleVeiculos = permissoesAtualizadas.podeAcessarDetalhe('portaria', 'portaria.veiculos')
  const podeControlePedestres = permissoesAtualizadas.podeAcessarDetalhe('portaria', 'portaria.pedestres')
  const roleUsuario = permissoesAtualizadas.role
  const emailUsuario = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || ''
  const podeAutorizarSaida = ['dev', 'gestor', 'editor'].includes(roleUsuario)
  const podeControleVeiculoInterno = podeControleVeiculos
  const identificadorControle =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    'Usuario nao identificado'
  const abasPermitidas = useMemo(
    () => [
      podeControleVeiculos ? 'veiculos' : null,
      podeControleVeiculoInterno ? 'veiculo_interno' : null,
      podeControlePedestres ? 'pedestres' : null,
    ].filter(Boolean) as typeof abaAtual[],
    [podeControleVeiculos, podeControlePedestres, podeControleVeiculoInterno],
  )

  const veiculosFiltradosPorPlaca = useMemo(() => {
    const buscaNormalizada = formatPlate(buscaPlacaInterna)
    if (!buscaNormalizada) return []

    return Array.from(
      new Map(
        veiculos
          .filter((veiculo) => formatPlate(veiculo.NR_PLACA || '').includes(buscaNormalizada))
          .map((veiculo) => [veiculo.NR_PLACA, veiculo]),
      ).values(),
    ).slice(0, 8)
  }, [buscaPlacaInterna, veiculos])

  const motoristasFiltrados = useMemo(() => (
    motoristas
      .filter((motorista) => motorista.nome.toLowerCase().includes(buscaMotoristaInterno.toLowerCase()))
      .slice(0, 8)
  ), [buscaMotoristaInterno, motoristas])
  const carregar = useCallback(async function carregar() {
    setCarregando(true)
    try {
      const [vAtivos, pAtivos, tQuery, acoesQuery, veiculosQuery, motoristasResponse, porteirosResponse] = await Promise.all([
        supabase.from('TBL_MOVIMENTACOES').select('*').eq('tipo_entidade', 'veiculo').in('status', ['aguardando_entrada', 'aguardando_saida', 'saida_autorizada', 'em_rota']).order('liberado_em', { ascending: false }),
        supabase.from('TBL_MOVIMENTACOES').select('*').eq('tipo_entidade', 'pedestre').in('status', ['aguardando_entrada', 'em_visita']).order('liberado_em', { ascending: false }),
        supabase.from('TBL_MOVIMENTACOES').select('id, placa, km, localizacao, destino, motorista, observacao, status, liberado_em, liberado_por').eq('tipo_entidade', 'transferencia').eq('status', 'aguardando_confirmacao').order('liberado_em', { ascending: false }).limit(100).returns<TransferenciaMovimentacao[]>(),
        supabase.from('TBL_HISTORICOS_ACOES').select('entidade_id, acao').eq('tipo_entidade', 'veiculo').eq('acao', 'saida_autorizada'),
        supabase.from('TBL_VEICULOS').select('NR_PLACA, DS_MODELO, DS_MARCA').order('NR_PLACA'),
        fetch('/api/cadastros/pessoas/selecao?tipo=motorista', { cache: 'no-store' }),
        fetch('/api/cadastros/pessoas/selecao?tipo=porteiro', { cache: 'no-store' }),
      ])

      const [motoristasResultado, porteirosResultado] = await Promise.all([
        motoristasResponse.ok ? lerJsonSeguro(motoristasResponse) : Promise.resolve({ pessoas: [] }),
        porteirosResponse.ok ? lerJsonSeguro(porteirosResponse) : Promise.resolve({ pessoas: [] }),
      ])

      setMovimentacoes(vAtivos.data || [])
      setAcoesMovimentacoes(acoesQuery.data || [])
      setPedestres(pAtivos.data || [])
      setTransferencias((tQuery.data || []).map((t) => ({
        id: t.id,
        placa: t.placa,
        km: t.km,
        base_origem: t.localizacao || '',
        base_destino: t.destino || '',
        motorista: t.motorista,
        observacao: t.observacao,
        status: t.status,
        transferido_em: t.liberado_em,
        transferido_por: t.liberado_por,
      })))
      setVeiculos(veiculosQuery.data || [])
      setMotoristas(Array.isArray(motoristasResultado.pessoas) ? motoristasResultado.pessoas : [])
      setPorteiros(Array.isArray(porteirosResultado.pessoas) ? porteirosResultado.pessoas : [])
    } catch {
      setMensagem('Erro ao carregar dados. Verifique a tabela no banco.')
    } finally {
      setCarregando(false)
    }
  }, [supabase])

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 30000)
    return () => clearInterval(interval)
  }, [carregar])

  useEffect(() => {
    if (!isLoaded || abasPermitidas.length === 0 || abasPermitidas.includes(abaAtual)) return
    setAbaAtual(abasPermitidas[0])
    setMensagem('')
  }, [isLoaded, abasPermitidas, abaAtual])

  useEffect(() => {
    const aba = searchParams.get('aba')
    if (!isLoaded || !podeControleVeiculos || (aba !== 'autorizacoes' && aba !== 'veiculos')) return
    setAbaAtual('veiculos')
    setMensagem('')
  }, [isLoaded, searchParams, podeControleVeiculos])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setMostrarListaPlacaInterna(false)
        setMostrarListaMotoristaInterno(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selecionarAba(aba: typeof abaAtual) {
    setAbaAtual(aba)
    setMensagem('')
    if (aba !== 'veiculos') setFiltroResumoVeiculos('todos')
    router.replace('/portaria')
  }

  async function registrarLiberacaoSegura(dados: Record<string, unknown>) {
    const resposta = await fetch('/api/liberacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
    const texto = await resposta.text()
    let resultado: { error?: string; mensagem?: string } = {}
    try {
      resultado = texto ? JSON.parse(texto) : {}
    } catch {
      throw new Error('Resposta invalida da API de liberacao.')
    }

    if (!resposta.ok) {
      throw new Error(resultado.error || 'Erro ao registrar veiculo interno.')
    }

    setMensagem(typeof resultado.mensagem === 'string' ? resultado.mensagem : 'Veiculo interno registrado.')
    await carregar()
  }

  async function registrarMovimentoVeiculoInterno(e: FormEvent) {
    e.preventDefault()
    const placaFinal = veiculoInternoSelecionado?.NR_PLACA

    if (!placaFinal) {
      setMensagem('Selecione um veiculo da lista.')
      return
    }
    if (!motoristaInternoSelecionado) {
      setMensagem('Selecione um motorista.')
      return
    }
    if (!dataHoraInterno) {
      setMensagem('Preencha a data/hora.')
      return
    }

    setRegistrandoInterno(true)
    setMensagem('')

    try {
      await registrarLiberacaoSegura({
        tipo: 'veiculo_interno',
        placa: placaFinal,
        motorista: motoristaInternoSelecionado,
        origem: 'Matriz Filtroamb',
        movimento: movimentoVeiculoInterno,
        data: dataHoraInterno,
      })
      setVeiculoInternoSelecionado(null)
      setBuscaPlacaInterna('')
      setMotoristaInternoSelecionado('')
      setBuscaMotoristaInterno('')
      setDataHoraInterno('')
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao registrar veiculo interno: ${error.message}` : 'Erro ao registrar veiculo interno.')
    } finally {
      setRegistrandoInterno(false)
    }
  }

  async function executarPortariaSegura(tipo: string, id: number, porteiroId?: string) {
    const resposta = await fetch('/api/portaria/acoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id, porteiro_id: porteiroId }),
    })
    const texto = await resposta.text()
    let resultado: { error?: string; mensagem?: string } = {}
    try {
      resultado = texto ? JSON.parse(texto) : {}
    } catch {
      throw new Error('Resposta invalida da API da portaria.')
    }

    if (!resposta.ok) {
      throw new Error(resultado.error || 'Erro ao executar acao da portaria.')
    }

    setMensagem(typeof resultado.mensagem === 'string' ? resultado.mensagem : 'Acao registrada.')
    await carregar()
  }

  function chaveAcao(tipo: string, id: number) {
    return `${tipo}:${id}`
  }

  function abrirConfirmacaoAcao(acao: AcaoPendente) {
    if (acaoEmAndamentoId) return
    setMensagem('')
    setPorteiroSelecionadoId('')
    setAcaoPendente(acao)
  }

  function abrirConfirmacaoTransferencia(transferencia: Transferencia) {
    if (acaoEmAndamentoId) return
    setMensagem('')
    setPorteiroSelecionadoId('')
    setTransferenciaParaConfirmar(transferencia)
  }

  async function confirmarAcaoPendente() {
    if (!acaoPendente || acaoEmAndamentoId) return

    if (!porteiroSelecionadoId) {
      setMensagem('Selecione o porteiro responsavel pela acao.')
      return
    }

    const chave = chaveAcao(acaoPendente.tipo, acaoPendente.id)
    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura(acaoPendente.tipo, acaoPendente.id, porteiroSelecionadoId)
      setAcaoPendente(null)
      setPorteiroSelecionadoId('')
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro: ${error.message}` : 'Erro ao executar acao da portaria.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  async function registrarSaidaVeiculoSegura(movimentacao: Movimentacao) {
    abrirConfirmacaoAcao({
      tipo: 'veiculo_saida',
      id: movimentacao.id,
      titulo: 'Registrar saida - Responsavel',
      descricao: `Selecione o porteiro que esta liberando a saida do veiculo ${movimentacao.placa}.`,
    })
  }

  async function registrarEntradaVeiculoSegura(id: number) {
    abrirConfirmacaoAcao({
      tipo: 'veiculo_entrada',
      id,
      titulo: 'Registrar entrada - Responsavel',
      descricao: 'Selecione o porteiro que esta registrando a entrada.',
    })
  }

  async function registrarEntradaPedestreSegura(id: number) {
    abrirConfirmacaoAcao({
      tipo: 'pedestre_entrada',
      id,
      titulo: 'Registrar entrada de pedestre - Responsavel',
      descricao: 'Selecione o porteiro que esta registrando a entrada do pedestre.',
    })
  }

  async function registrarSaidaPedestreSegura(id: number) {
    abrirConfirmacaoAcao({
      tipo: 'pedestre_saida',
      id,
      titulo: 'Registrar saida de pedestre - Responsavel',
      descricao: 'Selecione o porteiro que esta registrando a saida do pedestre.',
    })
  }

  async function confirmarTransferenciaSegura(transferencia: Transferencia) {
    const chave = chaveAcao('transferencia_confirmar', transferencia.id)
    if (acaoEmAndamentoId) return

    if (!porteiroSelecionadoId) {
      setMensagem('Selecione o porteiro responsavel pela acao.')
      return
    }

    setTransferenciaParaConfirmar(null)
    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura('transferencia_confirmar', transferencia.id, porteiroSelecionadoId)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao confirmar transferencia: ${error.message}` : 'Erro ao confirmar transferencia.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  async function autorizarSaidaVeiculoSegura(movimentacao: Movimentacao) {
    const chave = chaveAcao('veiculo_autorizar_saida', movimentacao.id)
    if (acaoEmAndamentoId) return

    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura('veiculo_autorizar_saida', movimentacao.id)
      setAbaAtual('veiculos')
      router.replace('/portaria')
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao autorizar saida: ${error.message}` : 'Erro ao autorizar saida.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  function formatarData(data: string | null) {
    if (!data) return '--'
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(data)).replace(',', '')
  }

  function isVeiculoInterno(tipo: string | null | undefined) {
    const tipoNormalizado = (tipo || '').toLowerCase().trim()
    return tipoNormalizado === 'interno' || tipoNormalizado === 'interno_entrada' || tipoNormalizado === 'interno_saida'
  }

  function isVeiculoExterno(tipo: string | null | undefined) {
    const tipoNormalizado = (tipo || '').toLowerCase().trim()
    return tipoNormalizado === 'externo' || tipoNormalizado === 'veiculo_externo'
  }

  function deveMostrarAcaoSaida(m: Movimentacao) {
    const veiculoJaEntrouESemSaida = Boolean(m.entrada_em) && !m.saida_em && !isVeiculoInterno(m.tipo_veiculo)
    return m.status === 'aguardando_saida' || m.status === 'saida_autorizada' || (isVeiculoExterno(m.tipo_veiculo) && Boolean(m.entrada_em)) || veiculoJaEntrouESemSaida
  }

  function idsHistoricoMovimentacao(movimentacao: Movimentacao) {
    return new Set([
      String(movimentacao.id),
      movimentacao.origem_tabela === 'movimentacoes' && movimentacao.origem_id ? String(movimentacao.origem_id) : null,
    ].filter(Boolean) as string[])
  }

  function temSaidaAutorizada(movimentacao: Movimentacao) {
    const ids = idsHistoricoMovimentacao(movimentacao)
    return acoesMovimentacoes.some((acao) => acao.entidade_id && ids.has(String(acao.entidade_id)) && acao.acao === 'saida_autorizada')
  }

  function saidaAutorizada(m: Movimentacao) {
    return m.status === 'saida_autorizada' || temSaidaAutorizada(m)
  }

  const vInternos = movimentacoes.filter((m) => isVeiculoInterno(m.tipo_veiculo)).length
  const vExternos = movimentacoes.filter((m) => isVeiculoExterno(m.tipo_veiculo)).length
  const vTransferencias = transferencias.filter((t) => t.status === 'aguardando_confirmacao').length
  const vTotalAberto = vInternos + vExternos + vTransferencias
  const pAguardando = pedestres.filter((p) => p.status === 'aguardando_entrada').length
  const pEmVisita = pedestres.filter((p) => p.status === 'em_visita').length

  const textoFiltro = busca.toLowerCase()
  const mFiltradasPorBusca = movimentacoes.filter((m) => m.placa?.toLowerCase().includes(textoFiltro) || m.motorista?.toLowerCase().includes(textoFiltro) || m.destino?.toLowerCase().includes(textoFiltro))
  const mFiltradas = mFiltradasPorBusca.filter((m) => {
    if (filtroResumoVeiculos === 'todos') return true
    if (filtroResumoVeiculos === 'interno') return isVeiculoInterno(m.tipo_veiculo)
    if (filtroResumoVeiculos === 'externo') return isVeiculoExterno(m.tipo_veiculo)
    return false
  })
  const autorizacoesPendentes = mFiltradas.filter((m) =>
    isVeiculoExterno(m.tipo_veiculo) &&
    Boolean(m.entrada_em) &&
    !m.saida_em &&
    !saidaAutorizada(m) &&
    (roleUsuario !== 'gestor' || Boolean(emailUsuario && m.gestor_responsavel_email?.toLowerCase() === emailUsuario))
  )
  const digitosFiltro = onlyDigits(busca)
  const pFiltrados = pedestres.filter((p) => p.nome?.toLowerCase().includes(textoFiltro) || p.cpf_rg?.includes(textoFiltro) || (digitosFiltro && onlyDigits(p.cpf_rg || '').includes(digitosFiltro)) || p.empresa?.toLowerCase().includes(textoFiltro))
  const transferenciasFiltradas = transferencias.filter((t) => t.placa?.toLowerCase().includes(textoFiltro) || t.base_origem?.toLowerCase().includes(textoFiltro) || t.base_destino?.toLowerCase().includes(textoFiltro) || t.motorista?.toLowerCase().includes(textoFiltro))
  const transferenciasPendentes = transferenciasFiltradas.filter((t) => t.status === 'aguardando_confirmacao' && (filtroResumoVeiculos === 'todos' || filtroResumoVeiculos === 'transferencia'))
  const filtroCardAtivo = (filtro: FiltroResumoVeiculos) => filtroResumoVeiculos === filtro
  const classeCardResumo = (filtro: FiltroResumoVeiculos, cor: 'orange' | 'blue' | 'emerald' | 'neutral') => {
    const ativo = filtroCardAtivo(filtro)
    const borda = cor === 'orange' ? 'border-orange-500/20' : cor === 'blue' ? 'border-blue-500/20' : 'border-emerald-500/20'
    const brilho = cor === 'orange' ? 'ring-orange-400/30' : cor === 'blue' ? 'ring-blue-400/30' : 'ring-emerald-400/30'
    return `group rounded-2xl border ${borda} bg-[#0f1c2e] p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_12px_30px_rgba(16,185,129,0.08)] cursor-pointer ${ativo ? `ring-2 ${brilho}` : ''}`
  }
  const alternarFiltroResumo = (filtro: FiltroResumoVeiculos) => {
    setFiltroResumoVeiculos((atual) => (atual === filtro || filtro === 'todos' ? 'todos' : filtro))
  }

  return (
    <RequirePermissao permissao="portaria">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <div className="app-scroll flex-1 overflow-y-auto overflow-x-hidden bg-[#0a1625]">
            <div className="portaria-controle-page flex-1 px-4 py-6 md:px-8 xl:px-14">
              {mensagem && <div className={`mb-4 p-4 rounded-xl text-sm border ${mensagem.includes('Erro') ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>{mensagem}</div>}
              {abasPermitidas.length === 0 && <div className="p-6 rounded-2xl border border-white/10 bg-[#0f1c2e] text-slate-400">Nenhum topico do controle liberado para este usuario.</div>}

              {abasPermitidas.length > 0 && (
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-[#132337] p-1.5 min-[1025px]:flex-row min-[1025px]:items-center">
                  <div className="flex flex-wrap gap-1.5 min-[1025px]:flex-nowrap">
                    {podeControleVeiculos && (
                      <button
                        data-topic-button
                        onClick={() => selecionarAba('veiculos')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'veiculos' ? 'bg-emerald-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        Veiculos
                      </button>
                    )}
                    {podeControleVeiculoInterno && (
                      <button
                        data-topic-button
                        onClick={() => selecionarAba('veiculo_interno')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'veiculo_interno' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        Veiculo Interno
                      </button>
                    )}
                    {podeControleVeiculos && podeAutorizarSaida && abaAtual === 'autorizacoes' && (
                      <button
                        data-topic-button
                        onClick={() => selecionarAba('veiculos')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'autorizacoes' ? 'bg-orange-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        Autorizações
                      </button>
                    )}
                    {podeControlePedestres && (
                      <button
                        data-topic-button
                        onClick={() => selecionarAba('pedestres')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${abaAtual === 'pedestres' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        Pedestres / Visitantes
                      </button>
                    )}
                  </div>

                  <div className="relative min-w-[240px] flex-1">
                    <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={abaAtual === 'pedestres' ? 'Filtrar nome, cpf, empresa...' : 'Filtrar placa, motorista, destino...'} className="w-full pl-10 pr-4 py-2.5 bg-[#0f1c2e] border border-emerald-500/20 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/70 text-sm">🔍</span>
                  </div>

                  <button
                    onClick={carregar}
                    disabled={carregando}
                    title="Atualizar dados"
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#0f1c2e] border border-emerald-500/20 rounded-lg text-sm text-slate-400 hover:text-white hover:border-emerald-500/40 active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <span className={carregando ? 'animate-spin' : ''}>↻</span>
                    <span>Atualizar</span>
                  </button>
                </div>
              )}

              {abasPermitidas.length > 0 && (
                <div key={abaAtual} className="animate-tab">
                  {carregando ? (
                    <div className="space-y-6 animate-pulse">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-white/5 border border-white/5" />)}</div>
                      <div className="rounded-2xl border border-white/5 bg-[#0f1c2e] overflow-hidden"><div className="h-12 bg-[#132337]" /><div className="space-y-3 p-5"><div className="h-10 rounded-lg bg-white/5" /><div className="h-10 rounded-lg bg-white/5" /><div className="h-10 rounded-lg bg-white/5" /></div></div>
                    </div>
                  ) : abaAtual === 'veiculos' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <button type="button" onClick={() => alternarFiltroResumo('interno')} className={classeCardResumo('interno', 'blue')}>
                          <p className="text-xs text-slate-400 uppercase tracking-wider group-hover:text-slate-300">Veiculo Interno</p>
                          <p className="text-3xl font-bold text-blue-300 mt-1">{vInternos}</p>
                        </button>
                        <button type="button" onClick={() => alternarFiltroResumo('externo')} className={classeCardResumo('externo', 'orange')}>
                          <p className="text-xs text-slate-400 uppercase tracking-wider group-hover:text-slate-300">Veiculo Externo</p>
                          <p className="text-3xl font-bold text-orange-300 mt-1">{vExternos}</p>
                        </button>
                        <button type="button" onClick={() => alternarFiltroResumo('transferencia')} className={classeCardResumo('transferencia', 'emerald')}>
                          <p className="text-xs text-slate-400 uppercase tracking-wider group-hover:text-slate-300">Transferencia</p>
                          <p className="text-3xl font-bold text-emerald-300 mt-1">{vTransferencias}</p>
                        </button>
                        <button type="button" onClick={() => alternarFiltroResumo('todos')} className={classeCardResumo('todos', 'neutral')}>
                          <p className="text-xs text-slate-400 uppercase tracking-wider group-hover:text-slate-300">Total em Aberto</p>
                          <p className="text-3xl font-bold text-white mt-1">{vTotalAberto}</p>
                        </button>
                      </div>
                      <div className="mb-8 hidden overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] shadow-[0_0_30px_rgba(16,185,129,0.05)] min-[1025px]:block">
                        <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-hidden">
                          <table className="w-full table-fixed text-xs">
                            <thead>
                              <tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10">
                                <th className="w-[15%] px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Placa</th>
                                <th className="w-[18%] px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Motorista</th>
                                <th className="w-[14%] px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Destino</th>
                                <th className="w-[8%] px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">KM</th>
                                <th className="w-[11%] px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Liberacao</th>
                                <th className="w-[10%] px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Saida</th>
                                <th className="w-[12%] px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Status</th>
                                <th className="w-[14%] px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Acao</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {mFiltradas.length === 0 && transferenciasPendentes.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">Nenhum veiculo em andamento.</td>
                                </tr>
                              ) : (
                                <>
                                  {mFiltradas.map((m) => (
                                    <tr key={`movimentacao-${m.id}`} className="hover:bg-emerald-500/5 transition-colors">
                                      <td className="px-3 py-2.5 text-center text-white">
                                        <div className="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap">
                                          <span className="shrink-0 font-semibold text-emerald-300 tracking-wide text-sm">{m.placa}</span>
                                          {isVeiculoInterno(m.tipo_veiculo) && (
                                            <span className="inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/25 whitespace-nowrap">
                                              Interno
                                            </span>
                                          )}
                                          {m.tipo_veiculo === 'externo' && (
                                            <span className="inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-orange-500/15 text-orange-300 border border-orange-500/25 whitespace-nowrap">
                                              Externo
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="min-w-0 px-3 py-2.5 text-center text-[13px] font-semibold text-white truncate" title={m.motorista || undefined}>{m.motorista || '--'}</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white truncate" title={m.destino || undefined}>{m.destino || '--'}</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.km ? m.km.toLocaleString('pt-BR') : '--'}</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{formatarData(m.liberado_em)}</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{formatarData(m.saida_em)}</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">
                                        <span className={`inline-flex min-h-6 w-[116px] items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${isVeiculoExterno(m.tipo_veiculo) && !m.entrada_em ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : isVeiculoExterno(m.tipo_veiculo) && !saidaAutorizada(m) ? 'bg-orange-500/10 text-orange-300 border border-orange-500/20' : m.status === 'aguardando_saida' || m.status === 'saida_autorizada' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20' : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'}`}>
                                          {m.status === 'finalizado' ? 'Finalizado' : isVeiculoExterno(m.tipo_veiculo) && !m.entrada_em ? 'Aguardando Entrada' : isVeiculoExterno(m.tipo_veiculo) && !saidaAutorizada(m) ? 'Aguardando gestor' : m.status === 'aguardando_saida' || m.status === 'saida_autorizada' ? 'Aguardando Saida' : 'Em Rota'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                        {m.status === 'finalizado' ? (
                                          <span className="inline-flex min-h-6 w-[116px] items-center justify-center px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[11px] font-semibold text-emerald-300">
                                            Sem acao
                                          </span>
                                        ) : isVeiculoExterno(m.tipo_veiculo) && !m.entrada_em ? (
                                          <button
                                            onClick={() => registrarEntradaVeiculoSegura(m.id)}
                                            disabled={acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id)}
                                            className="inline-flex min-h-6 w-[116px] items-center justify-center rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-[#0a1625] transition-all duration-150 hover:bg-emerald-400 hover:brightness-110 active:brightness-95 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            {acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id) ? 'Registrando...' : 'Registrar Entrada'}
                                          </button>
                                        ) : isVeiculoExterno(m.tipo_veiculo) && !saidaAutorizada(m) ? (
                                          <span className="inline-flex min-h-6 w-[116px] items-center justify-center px-3 py-1 rounded-full border border-orange-500/20 bg-orange-500/10 text-[11px] font-semibold text-orange-300">
                                            Aguardando gestor
                                          </span>
                                        ) : deveMostrarAcaoSaida(m) ? (
                                          <button
                                            onClick={() => registrarSaidaVeiculoSegura(m)}
                                            disabled={acaoEmAndamentoId === chaveAcao('veiculo_saida', m.id)}
                                            className="inline-flex min-h-6 w-[116px] items-center justify-center rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-semibold text-[#0a1625] transition-all duration-150 hover:bg-orange-400 hover:brightness-110 active:brightness-95 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            {acaoEmAndamentoId === chaveAcao('veiculo_saida', m.id) ? 'Registrando...' : 'Registrar Saida'}
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => registrarEntradaVeiculoSegura(m.id)}
                                            disabled={acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id)}
                                            className="inline-flex min-h-6 w-[116px] items-center justify-center rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-[#0a1625] transition-all duration-150 hover:bg-emerald-400 hover:brightness-110 active:brightness-95 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            {acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id) ? 'Registrando...' : 'Registrar Entrada'}
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {transferenciasPendentes.map((t) => (
                                    <tr key={`transferencia-${t.id}`} className="hover:bg-emerald-500/5 transition-colors">
                                      <td className="px-3 py-2.5 text-center text-white">
                                        <div className="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap">
                                          <span className="shrink-0 font-semibold text-emerald-300 tracking-wide text-sm">{t.placa}</span>
                                          <span className="inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase bg-sky-500/15 text-sky-300 border border-sky-500/25 whitespace-nowrap">
                                            Transferencia
                                          </span>
                                        </div>
                                      </td>
                                      <td className="min-w-0 px-3 py-2.5 text-center text-[13px] font-semibold text-white truncate" title={t.motorista || undefined}>{t.motorista || '--'}</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white truncate" title={`${t.base_origem} -> ${t.base_destino}`}>{t.base_origem} &rarr; {t.base_destino}</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{t.km ? t.km.toLocaleString('pt-BR') : '--'}</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{formatarData(t.transferido_em)}</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">--</td>
                                      <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">
                                        <span title="Aguardando confirmacao" className="inline-flex min-h-6 w-[116px] items-center justify-center rounded-full border border-sky-500/20 bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300 whitespace-nowrap">
                                          Aguardando
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                        <button
                                          onClick={() => abrirConfirmacaoTransferencia(t)}
                                          disabled={acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id)}
                                          className="inline-flex min-h-6 w-[116px] items-center justify-center rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-[#0a1625] transition-all duration-150 hover:bg-emerald-400 hover:brightness-110 active:brightness-95 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id) ? 'Registrando...' : 'Confirmar'}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="mb-8 space-y-3 min-[1025px]:hidden">
                        {mFiltradas.length === 0 && transferenciasPendentes.length === 0 ? (
                          <div className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5 text-center text-sm text-slate-500">
                            Nenhum veiculo em andamento.
                          </div>
                        ) : (
                          <>
                            {mFiltradas.map((m) => (
                              <div key={`movimentacao-${m.id}`} className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-4 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-lg font-bold tracking-wide text-emerald-300">{m.placa}</p>
                                      {isVeiculoInterno(m.tipo_veiculo) && (
                                        <span className="rounded-full border border-blue-500/25 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                                          Interno
                                        </span>
                                      )}
                                      {m.tipo_veiculo === 'externo' && (
                                        <span className="rounded-full border border-orange-500/25 bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-300">
                                          Externo
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isVeiculoExterno(m.tipo_veiculo) && !m.entrada_em ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : isVeiculoExterno(m.tipo_veiculo) && !saidaAutorizada(m) ? 'border border-orange-500/20 bg-orange-500/10 text-orange-300' : m.status === 'aguardando_saida' || m.status === 'saida_autorizada' ? 'border border-orange-500/20 bg-orange-500/15 text-orange-300' : 'border border-blue-500/20 bg-blue-500/15 text-blue-300'}`}>
                                    {m.status === 'finalizado' ? 'Finalizado' : isVeiculoExterno(m.tipo_veiculo) && !m.entrada_em ? 'Aguardando Entrada' : isVeiculoExterno(m.tipo_veiculo) && !saidaAutorizada(m) ? 'Aguardando gestor' : m.status === 'aguardando_saida' || m.status === 'saida_autorizada' ? 'Aguardando Saida' : 'Em Rota'}
                                  </span>
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motorista</p>
                                    <p className="mt-1 font-semibold text-white">{m.motorista || '--'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Destino</p>
                                    <p className="mt-1 font-semibold text-white">{m.destino || '--'}</p>
                                  </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                  <div className="rounded-xl bg-[#132337]/70 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Liberacao</p>
                                    <p className="mt-1 font-semibold text-slate-200">{formatarData(m.liberado_em)}</p>
                                  </div>
                                  <div className="rounded-xl bg-[#132337]/70 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Saida</p>
                                    <p className="mt-1 font-semibold text-slate-200">{formatarData(m.saida_em)}</p>
                                  </div>
                                </div>

                                <div className="mt-4">
                                  {m.status === 'finalizado' ? (
                                    <span className="flex w-full items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm font-semibold text-emerald-300">
                                      Sem acao
                                    </span>
                                  ) : isVeiculoExterno(m.tipo_veiculo) && !m.entrada_em ? (
                                    <button
                                      onClick={() => registrarEntradaVeiculoSegura(m.id)}
                                      disabled={acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id)}
                                      className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id) ? 'Registrando...' : 'Registrar Entrada'}
                                    </button>
                                  ) : isVeiculoExterno(m.tipo_veiculo) && !saidaAutorizada(m) ? (
                                    <span className="flex w-full items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-3 text-sm font-semibold text-orange-300">
                                      Aguardando gestor
                                    </span>
                                  ) : deveMostrarAcaoSaida(m) ? (
                                    <button
                                      onClick={() => registrarSaidaVeiculoSegura(m)}
                                      disabled={acaoEmAndamentoId === chaveAcao('veiculo_saida', m.id)}
                                      className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-[#0a1625] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {acaoEmAndamentoId === chaveAcao('veiculo_saida', m.id) ? 'Registrando...' : 'Registrar Saida'}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => registrarEntradaVeiculoSegura(m.id)}
                                      disabled={acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id)}
                                      className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {acaoEmAndamentoId === chaveAcao('veiculo_entrada', m.id) ? 'Registrando...' : 'Registrar Entrada'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {transferenciasPendentes.map((t) => (
                              <div key={`transferencia-${t.id}`} className="rounded-2xl border border-sky-500/15 bg-[#0f1c2e] p-4 shadow-[0_0_24px_rgba(14,165,233,0.05)]">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-lg font-bold tracking-wide text-emerald-300">{t.placa}</p>
                                    <span className="rounded-full border border-sky-500/25 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
                                      Transferencia
                                    </span>
                                  </div>
                                  <span className="shrink-0 rounded-full border border-sky-500/20 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-300">
                                    Aguardando confirmacao
                                  </span>
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motorista</p>
                                    <p className="mt-1 font-semibold text-white">{t.motorista || '--'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Destino</p>
                                    <p className="mt-1 font-semibold text-white">{t.base_origem} &rarr; {t.base_destino}</p>
                                  </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                  <div className="rounded-xl bg-[#132337]/70 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Liberacao</p>
                                    <p className="mt-1 font-semibold text-slate-200">{formatarData(t.transferido_em)}</p>
                                  </div>
                                  <div className="rounded-xl bg-[#132337]/70 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">KM</p>
                                    <p className="mt-1 font-semibold text-slate-200">{t.km ? t.km.toLocaleString('pt-BR') : '--'}</p>
                                  </div>
                                  <div className="rounded-xl bg-[#132337]/70 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Responsavel</p>
                                    <p className="mt-1 font-semibold text-slate-200">{t.transferido_por || '--'}</p>
                                  </div>
                                </div>

                                <button
                                  onClick={() => abrirConfirmacaoTransferencia(t)}
                                  disabled={acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id)}
                                  className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id) ? 'Registrando...' : 'Confirmar Transferencia'}
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </>
                  ) : abaAtual === 'veiculo_interno' ? (
                    <form onSubmit={registrarMovimentoVeiculoInterno} className="rounded-2xl border border-sky-500/15 bg-[#0f1c2e] overflow-visible">
                      <div className="px-6 py-3 border-b border-white/5 bg-[#132337]/60 flex items-center justify-between rounded-t-2xl">
                        <div>
                          <h2 className="text-sm font-semibold text-white">
                            Registrar {movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de Veiculo Interno
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">Movimentos internos da frota propria Filtroamb</p>
                        </div>
                        <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                          Veiculo Interno
                        </span>
                      </div>

                      <div className="p-6">
                        <div className="mb-5 grid w-full grid-cols-2 gap-3 rounded-xl border border-sky-500/15 bg-[#132337]/60 p-1.5">
                          <button
                            type="button"
                            onClick={() => { setMovimentoVeiculoInterno('entrada'); setMensagem('') }}
                            className={`rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${movimentoVeiculoInterno === 'entrada' ? 'bg-sky-500 text-white shadow-[0_0_18px_rgba(14,165,233,0.25)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                          >
                            Entrada
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMovimentoVeiculoInterno('saida'); setMensagem('') }}
                            className={`rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${movimentoVeiculoInterno === 'saida' ? 'bg-orange-500 text-[#0a1625] shadow-[0_0_18px_rgba(249,115,22,0.22)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                          >
                            Saida
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                          <div className="space-y-4">
                            <div data-dropdown className="relative">
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Veiculo</label>
                              <input
                                type="text"
                                value={buscaPlacaInterna}
                                onChange={(e) => {
                                  setBuscaPlacaInterna(formatPlateDisplay(e.target.value))
                                  setVeiculoInternoSelecionado(null)
                                  setMostrarListaPlacaInterna(true)
                                }}
                                onFocus={() => setMostrarListaPlacaInterna(true)}
                                placeholder="Buscar por placa..."
                                className="w-full px-4 py-2.5 bg-[#132337] border border-sky-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 uppercase transition"
                              />
                              {mostrarListaPlacaInterna && !veiculoInternoSelecionado && buscaPlacaInterna.length >= 1 && (
                                <div className="app-scroll absolute z-50 w-full mt-1.5 bg-[#132337] border border-sky-500/25 rounded-xl shadow-2xl max-h-52 overflow-auto">
                                  {veiculosFiltradosPorPlaca.length > 0 ? (
                                    veiculosFiltradosPorPlaca.map((veiculo) => (
                                      <button
                                        key={veiculo.NR_PLACA}
                                        type="button"
                                        onClick={() => {
                                          setVeiculoInternoSelecionado(veiculo)
                                          setBuscaPlacaInterna(formatPlateDisplay(veiculo.NR_PLACA))
                                          setMostrarListaPlacaInterna(false)
                                        }}
                                        className="w-full text-left px-4 py-2.5 border-b border-white/5 last:border-0 text-sm text-slate-200 hover:bg-sky-500/10"
                                      >
                                        <div className="font-semibold text-sky-300">{formatPlateDisplay(veiculo.NR_PLACA)}</div>
                                        <div className="text-xs text-slate-400">{veiculo.DS_MODELO || 'Sem modelo'}{veiculo.DS_MARCA ? ` - ${veiculo.DS_MARCA}` : ''}</div>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-4 py-3 text-sm text-slate-400">Nenhuma placa encontrada.</div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Data e Hora</label>
                              <input
                                type="datetime-local"
                                value={dataHoraInterno}
                                onChange={(e) => setDataHoraInterno(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#132337] border border-sky-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition"
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div data-dropdown className="relative">
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Motorista</label>
                              <input
                                type="text"
                                value={buscaMotoristaInterno}
                                onChange={(e) => {
                                  setBuscaMotoristaInterno(e.target.value)
                                  setMotoristaInternoSelecionado('')
                                  setMostrarListaMotoristaInterno(true)
                                }}
                                onFocus={() => setMostrarListaMotoristaInterno(true)}
                                placeholder="Buscar motorista..."
                                className="w-full px-4 py-2.5 bg-[#132337] border border-sky-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition"
                              />
                              {mostrarListaMotoristaInterno && !motoristaInternoSelecionado && (
                                <div className="app-scroll absolute z-50 w-full mt-1.5 bg-[#132337] border border-sky-500/25 rounded-xl shadow-2xl max-h-52 overflow-auto">
                                  {motoristasFiltrados.length > 0 ? (
                                    motoristasFiltrados.map((motorista) => (
                                      <button
                                        key={motorista.id}
                                        type="button"
                                        onClick={() => {
                                          setMotoristaInternoSelecionado(motorista.nome)
                                          setBuscaMotoristaInterno(motorista.nome)
                                          setMostrarListaMotoristaInterno(false)
                                        }}
                                        className="w-full text-left px-4 py-2.5 border-b border-white/5 last:border-0 text-sm text-slate-200 hover:bg-sky-500/10"
                                      >
                                        {motorista.nome}
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-4 py-3 text-sm text-slate-400">Nenhum motorista encontrado.</div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Identificador</label>
                              <div className="w-full px-4 py-2.5 border rounded-xl text-sm font-semibold bg-sky-500/10 border-sky-500/25 text-sky-300">
                                {identificadorControle}
                              </div>
                            </div>
                          </div>

                          <div className="xl:col-span-2 pt-2">
                            <button
                              type="submit"
                              disabled={registrandoInterno}
                              className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-[0_0_20px_rgba(14,165,233,0.25)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {registrandoInterno ? 'Registrando...' : `Registrar ${movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de Veiculo Interno`}
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  ) : abaAtual === 'autorizacoes' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Gestor</p><p className="text-3xl font-bold text-orange-300 mt-1">{autorizacoesPendentes.length}</p></div>
                      </div>
                      <div className="mb-8 hidden overflow-hidden rounded-2xl border border-orange-500/15 bg-[#0f1c2e] shadow-[0_0_30px_rgba(249,115,22,0.05)] min-[1025px]:block">
                        <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-auto">
                          <table className="w-full min-w-[760px] text-xs">
                            <thead>
                              <tr className="bg-[#132337] border-b border-orange-500/15 sticky top-0 z-10">
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Placa</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Motorista</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Horario Liberado</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Destino</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Gestor</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Setor</th>
                                <th className="px-3 py-2.5 text-center text-[13px] font-semibold text-orange-300 uppercase tracking-wider whitespace-nowrap">Acao</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {autorizacoesPendentes.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Nenhum veiculo externo aguardando autorizacao de saida.</td>
                                </tr>
                              ) : (
                                autorizacoesPendentes.map((m) => (
                                  <tr key={m.id} className="hover:bg-orange-500/5 transition-colors">
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <span className="font-semibold text-orange-300 whitespace-nowrap tracking-wide text-sm">{m.placa}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.motorista || '--'}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{formatarData(m.entrada_em || m.liberado_em)}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.destino || '--'}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.gestor_responsavel_nome || '--'}</td>
                                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold text-white whitespace-nowrap">{m.gestor_responsavel_setor || '--'}</td>
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => autorizarSaidaVeiculoSegura(m)}
                                        disabled={acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', m.id)}
                                        className="bg-orange-500 hover:bg-orange-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', m.id) ? 'Registrando...' : 'Autorizar Saida'}
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="mb-8 space-y-3 min-[1025px]:hidden">
                        {autorizacoesPendentes.length === 0 ? (
                          <div className="rounded-2xl border border-orange-500/15 bg-[#0f1c2e] p-5 text-center text-sm text-slate-500">
                            Nenhum veiculo externo aguardando autorizacao de saida.
                          </div>
                        ) : (
                          autorizacoesPendentes.map((m) => (
                            <div key={m.id} className="rounded-2xl border border-orange-500/15 bg-[#0f1c2e] p-4 shadow-[0_0_24px_rgba(249,115,22,0.05)]">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-lg font-bold tracking-wide text-orange-300">{m.placa}</p>
                                <span className="shrink-0 rounded-full border border-orange-500/20 bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold text-orange-300">
                                  Aguardando Gestor
                                </span>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motorista</p>
                                  <p className="mt-1 font-semibold text-white">{m.motorista || '--'}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Destino</p>
                                  <p className="mt-1 font-semibold text-white">{m.destino || '--'}</p>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-xl bg-[#132337]/70 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Liberado</p>
                                  <p className="mt-1 font-semibold text-slate-200">{formatarData(m.entrada_em || m.liberado_em)}</p>
                                </div>
                                <div className="rounded-xl bg-[#132337]/70 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Gestor</p>
                                  <p className="mt-1 font-semibold text-slate-200">{m.gestor_responsavel_nome || '--'}</p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => autorizarSaidaVeiculoSegura(m)}
                                disabled={acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', m.id)}
                                className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-[#0a1625] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', m.id) ? 'Registrando...' : 'Autorizar Saida'}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : abaAtual === 'pedestres' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Entrada</p><p className="text-3xl font-bold text-orange-300 mt-1">{pAguardando}</p></div>
                        <div className="bg-[#0f1c2e] border border-purple-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Em Visita</p><p className="text-3xl font-bold text-purple-300 mt-1">{pEmVisita}</p></div>
                        <div className="bg-[#0f1c2e] border border-emerald-500/15 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Total em Aberto</p><p className="text-3xl font-bold text-white mt-1">{pAguardando + pEmVisita}</p></div>
                      </div>
                      <div className="mb-8 hidden overflow-hidden rounded-2xl border border-purple-500/15 bg-[#0f1c2e] shadow-[0_0_30px_rgba(168,85,247,0.05)] min-[1025px]:block">
                        <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-hidden">
                          <table className="w-full table-fixed text-xs">
                            <thead>
                              <tr className="bg-[#132337] border-b border-purple-500/15 sticky top-0 z-10">
                                <th className="w-[14%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Nome</th>
                                <th className="w-[13%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Empresa</th>
                                <th className="w-[13%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">CPF</th>
                                <th className="w-[13%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Telefone</th>
                                <th className="w-[13%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Destino</th>
                                <th className="w-[15%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Liberacao</th>
                                <th className="w-[11%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Status</th>
                                <th className="w-[8%] px-2 py-2.5 text-center text-[12px] font-semibold text-purple-400/90 uppercase tracking-wider">Acao</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {pFiltrados.length === 0 ? (
                                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Nenhum pedestre em andamento.</td></tr>
                              ) : (
                                pFiltrados.map((p) => (
                                  <tr key={p.id} className="hover:bg-purple-500/5 transition-colors">
                                    <td className="px-2 py-2.5 text-center font-semibold text-purple-300 text-[14px] truncate">{p.nome}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{p.empresa || 'Sem empresa'}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{p.cpf_rg ? formatCpf(p.cpf_rg) : '--'}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{p.telefone ? formatPhone(p.telefone) : '--'}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{p.destino || '--'}</td>
                                    <td className="px-2 py-2.5 text-center text-slate-300 text-[14px] truncate">{formatarData(p.liberado_em)}</td>
                                    <td className="px-2 py-2.5 text-center">
                                      <span className={`inline-flex max-w-full px-2 py-0.5 rounded-full text-[9px] font-medium truncate ${p.status === 'aguardando_entrada' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20' : 'bg-purple-500/15 text-purple-300 border border-purple-500/20'}`}>
                                        {p.status === 'aguardando_entrada' ? 'Aguardando Entrada' : 'Em Visita'}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                      {p.status === 'aguardando_entrada' ? (
                                        <button
                                          onClick={() => registrarEntradaPedestreSegura(p.id)}
                                          disabled={acaoEmAndamentoId === chaveAcao('pedestre_entrada', p.id)}
                                          className="bg-emerald-500 hover:bg-emerald-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-2 py-1 rounded-lg transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {acaoEmAndamentoId === chaveAcao('pedestre_entrada', p.id) ? 'Registrando...' : 'Entrou'}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => registrarSaidaPedestreSegura(p.id)}
                                          disabled={acaoEmAndamentoId === chaveAcao('pedestre_saida', p.id)}
                                          className="bg-orange-500 hover:bg-orange-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-2 py-1 rounded-lg transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {acaoEmAndamentoId === chaveAcao('pedestre_saida', p.id) ? 'Registrando...' : 'Saiu'}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="mb-8 space-y-3 min-[1025px]:hidden">
                        {pFiltrados.length === 0 ? (
                          <div className="rounded-2xl border border-purple-500/15 bg-[#0f1c2e] p-5 text-center text-sm text-slate-500">
                            Nenhum pedestre em andamento.
                          </div>
                        ) : (
                          pFiltrados.map((p) => (
                            <div key={p.id} className="rounded-2xl border border-purple-500/15 bg-[#0f1c2e] p-4 shadow-[0_0_24px_rgba(168,85,247,0.05)]">
                              <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 text-lg font-bold text-purple-300">{p.nome}</p>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${p.status === 'aguardando_entrada' ? 'border border-orange-500/20 bg-orange-500/15 text-orange-300' : 'border border-purple-500/20 bg-purple-500/15 text-purple-300'}`}>
                                  {p.status === 'aguardando_entrada' ? 'Aguardando Entrada' : 'Em Visita'}
                                </span>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Empresa</p>
                                  <p className="mt-1 font-semibold text-white">{p.empresa || 'Sem empresa'}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Destino</p>
                                  <p className="mt-1 font-semibold text-white">{p.destino || '--'}</p>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-xl bg-[#132337]/70 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">CPF</p>
                                  <p className="mt-1 font-semibold text-slate-200">{p.cpf_rg ? formatCpf(p.cpf_rg) : '--'}</p>
                                </div>
                                <div className="rounded-xl bg-[#132337]/70 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Liberacao</p>
                                  <p className="mt-1 font-semibold text-slate-200">{formatarData(p.liberado_em)}</p>
                                </div>
                              </div>

                              {p.status === 'aguardando_entrada' ? (
                                <button
                                  onClick={() => registrarEntradaPedestreSegura(p.id)}
                                  disabled={acaoEmAndamentoId === chaveAcao('pedestre_entrada', p.id)}
                                  className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {acaoEmAndamentoId === chaveAcao('pedestre_entrada', p.id) ? 'Registrando...' : 'Entrou'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => registrarSaidaPedestreSegura(p.id)}
                                  disabled={acaoEmAndamentoId === chaveAcao('pedestre_saida', p.id)}
                                  className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-[#0a1625] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {acaoEmAndamentoId === chaveAcao('pedestre_saida', p.id) ? 'Registrando...' : 'Saiu'}
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5"><p className="text-xs text-slate-400 uppercase tracking-wider">Aguardando Confirmacao</p><p className="text-3xl font-bold text-orange-300 mt-1">{transferenciasPendentes.length}</p></div>
                      </div>
                      <div className="hidden overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] shadow-[0_0_30px_rgba(16,185,129,0.05)] min-[1025px]:block">
                        <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10">
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Veiculo</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Origem</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Destino</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Motorista</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Data / Hora</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Responsavel</th>
                                <th className="px-3 py-2.5 text-left text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Acao</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {transferenciasPendentes.length === 0 ? (
                                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Nenhuma transferencia aguardando confirmacao.</td></tr>
                              ) : (
                                transferenciasPendentes.map((t) => (
                                  <tr key={t.id} className="hover:bg-emerald-500/5 transition-colors">
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      <div className="font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md inline-block whitespace-nowrap text-[13px]">
                                        {t.placa}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{t.base_origem}</td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{t.base_destino}</td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{t.motorista || <span className="text-slate-600 font-normal">Nao informado</span>}</td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{formatarData(t.transferido_em)}</td>
                                    <td className="px-3 py-2.5 text-slate-300 text-[13px] whitespace-nowrap">{t.transferido_por || '--”'}</td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      <button
                                        onClick={() => abrirConfirmacaoTransferencia(t)}
                                        disabled={acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id)}
                                        className="bg-emerald-500 hover:bg-emerald-400 hover:brightness-110 active:brightness-95 text-[#0a1625] text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id) ? 'Registrando...' : 'Confirmar'}
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="space-y-3 min-[1025px]:hidden">
                        {transferenciasPendentes.length === 0 ? (
                          <div className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5 text-center text-sm text-slate-500">
                            Nenhuma transferencia aguardando confirmacao.
                          </div>
                        ) : (
                          transferenciasPendentes.map((t) => (
                            <div key={t.id} className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-4 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-lg font-bold tracking-wide text-emerald-300">{t.placa}</p>
                                <span className="shrink-0 rounded-full border border-orange-500/20 bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold text-orange-300">
                                  Aguardando
                                </span>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motorista</p>
                                  <p className="mt-1 font-semibold text-white">{t.motorista || 'Nao informado'}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Destino</p>
                                  <p className="mt-1 font-semibold text-white">{t.base_destino}</p>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-xl bg-[#132337]/70 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Origem</p>
                                  <p className="mt-1 font-semibold text-slate-200">{t.base_origem}</p>
                                </div>
                                <div className="rounded-xl bg-[#132337]/70 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Data / Hora</p>
                                  <p className="mt-1 font-semibold text-slate-200">{formatarData(t.transferido_em)}</p>
                                </div>
                              </div>

                              <button
                                onClick={() => abrirConfirmacaoTransferencia(t)}
                                disabled={acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id)}
                                className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {acaoEmAndamentoId === chaveAcao('transferencia_confirmar', t.id) ? 'Registrando...' : 'Confirmar'}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {acaoPendente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-emerald-500/20 bg-[#0f1c2e] p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">{acaoPendente.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{acaoPendente.descricao}</p>

              <div className="mt-5">
                <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Porteiro responsavel
                </p>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {porteiros.map((porteiro, index) => {
                    const selecionado = porteiroSelecionadoId === String(porteiro.id)

                    return (
                      <button
                        key={porteiro.id}
                        type="button"
                        onClick={() => setPorteiroSelecionadoId(String(porteiro.id))}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                          selecionado
                            ? 'border-emerald-400 bg-emerald-500/15 text-white'
                            : 'border-white/10 bg-[#132337]/70 text-slate-300 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-white'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs ${
                            selecionado
                              ? 'border-emerald-300 bg-emerald-500 text-[#0a1625]'
                              : 'border-slate-600 text-slate-400'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="truncate">{porteiro.nome}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {porteiros.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-orange-300">
                  Nenhum porteiro ativo cadastrado.
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAcaoPendente(null)
                    setPorteiroSelecionadoId('')
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarAcaoPendente}
                  disabled={acaoEmAndamentoId === chaveAcao(acaoPendente.tipo, acaoPendente.id)}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {acaoEmAndamentoId === chaveAcao(acaoPendente.tipo, acaoPendente.id) ? 'Registrando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {transferenciaParaConfirmar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-emerald-500/20 bg-[#0f1c2e] p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Confirmar transferencia?</h3>
              <p className="mt-2 text-sm text-slate-400">
                Tem certeza que deseja confirmar a transferencia do veiculo {transferenciaParaConfirmar.placa}?
              </p>
              <div className="mt-4 rounded-xl border border-white/5 bg-[#132337]/70 p-3 text-sm text-slate-300">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Destino</span>
                  <span className="font-semibold text-white">{transferenciaParaConfirmar.base_destino}</span>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <span className="text-slate-500">KM</span>
                  <span className="font-semibold text-white">{transferenciaParaConfirmar.km ? transferenciaParaConfirmar.km.toLocaleString('pt-BR') : '--'}</span>
                </div>
              </div>
              <div className="mt-5">
                <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Porteiro responsavel
                </p>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {porteiros.map((porteiro, index) => {
                    const selecionado = porteiroSelecionadoId === String(porteiro.id)

                    return (
                      <button
                        key={porteiro.id}
                        type="button"
                        onClick={() => setPorteiroSelecionadoId(String(porteiro.id))}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                          selecionado
                            ? 'border-emerald-400 bg-emerald-500/15 text-white'
                            : 'border-white/10 bg-[#132337]/70 text-slate-300 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-white'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs ${
                            selecionado
                              ? 'border-emerald-300 bg-emerald-500 text-[#0a1625]'
                              : 'border-slate-600 text-slate-400'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="truncate">{porteiro.nome}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {porteiros.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-orange-300">
                  Nenhum porteiro ativo cadastrado.
                </p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTransferenciaParaConfirmar(null)
                    setPorteiroSelecionadoId('')
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => confirmarTransferenciaSegura(transferenciaParaConfirmar)}
                  disabled={acaoEmAndamentoId === chaveAcao('transferencia_confirmar', transferenciaParaConfirmar.id)}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {acaoEmAndamentoId === chaveAcao('transferencia_confirmar', transferenciaParaConfirmar.id) ? 'Registrando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequirePermissao>
  )
}

export default function PortariaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a1625]" />}>
      <PortariaContent />
    </Suspense>
  )
}
