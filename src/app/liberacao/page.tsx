'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useUser } from '@clerk/nextjs'
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { usePermissions } from '@/components/PermissionsProvider'
import { lerJsonSeguro } from '@/lib/http'
import { formatCpf, formatPhone, formatPlate, formatPlateDisplay, onlyDigits } from '@/lib/masks'

type Veiculo = {
  NR_PLACA: string
  DS_MODELO: string | null
  DS_MARCA: string | null
  NR_ANO_MODELO: number | null
}

type Item = {
  id: number | string
  nome: string
}

type GestorAutorizacao = {
  id: string
  nome: string
  email: string
  setor: string
}

type RegistroKm = {
  placa: string | null
  km: number | string | null
}

type RegistroHistoricoKm = {
  placa: string | null
  dados: {
    placa?: string | null
    km?: number | string | null
  } | null
}

type MovimentacaoAutorizacao = {
  id: number
  origem_tabela: string | null
  origem_id: number | null
  placa: string
  km: number | null
  motorista: string | null
  localizacao: string | null
  destino: string | null
  status: string
  liberado_em: string | null
  saida_em: string | null
  entrada_em: string | null
  tipo_veiculo: string | null
  gestor_responsavel_nome: string | null
  gestor_responsavel_email: string | null
  gestor_responsavel_setor: string | null
}

type AcaoMovimentacao = {
  entidade_id: number | string | null
  acao: string
}

type TipoLiberacao = 'interno' | 'externo' | 'veiculo_interno' | 'transferencia' | 'pedestre' | 'autorizacoes'

function placasIguaisKm(a: string | null | undefined, b: string) {
  const placaA = formatPlate(a || '')
  const placaB = formatPlate(b)
  return Boolean(placaA && placaB && placaA === placaB)
}

function kmParaNumero(valor: unknown) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string') {
    const parsed = Number(valor.replace(/\D/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function maiorKmDosRegistros(registros: RegistroKm[], placa: string) {
  return registros.reduce<number | null>((maior, registro) => {
    if (!placasIguaisKm(registro.placa, placa)) return maior
    const kmRegistro = kmParaNumero(registro.km)
    if (kmRegistro === null) return maior
    return maior === null || kmRegistro > maior ? kmRegistro : maior
  }, null)
}

function padraoBuscaPlacaKm(placa: string) {
  const limpa = formatPlate(placa)
  return limpa ? `%${limpa.split('').join('%')}%` : '%'
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

function isVeiculoExterno(tipo: string | null | undefined) {
  const tipoNormalizado = (tipo || '').toLowerCase().trim()
  return tipoNormalizado === 'externo' || tipoNormalizado === 'veiculo_externo'
}

export default function LiberacaoPage() {
  const supabase = useMemo(() => createClient(), [])
  const { user, isLoaded } = useUser()
  const permissoesAtualizadas = usePermissions()

  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [origens, setOrigens] = useState<Item[]>([])
  const [destinos, setDestinos] = useState<Item[]>([])
  const [motoristas, setMotoristas] = useState<Item[]>([])
  const [gestores, setGestores] = useState<GestorAutorizacao[]>([])
  const [erroGestores, setErroGestores] = useState('')
  const [movimentacoesAutorizacao, setMovimentacoesAutorizacao] = useState<MovimentacaoAutorizacao[]>([])
  const [acoesMovimentacoes, setAcoesMovimentacoes] = useState<AcaoMovimentacao[]>([])

  const [tipoVeiculo, setTipoVeiculo] = useState<TipoLiberacao>('interno')
  const [movimentoVeiculoInterno, setMovimentoVeiculoInterno] = useState<'entrada' | 'saida'>('entrada')

  const [buscaPlaca, setBuscaPlaca] = useState('')
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<Veiculo | null>(null)
  const [mostrarListaPlaca, setMostrarListaPlaca] = useState(false)
  const [indicePlacaAtivo, setIndicePlacaAtivo] = useState(-1)

  const [placaExterna, setPlacaExterna] = useState('')
  const [modeloExterno, setModeloExterno] = useState('')

  const [buscaMotorista, setBuscaMotorista] = useState('')
  const [motoristaSelecionado, setMotoristaSelecionado] = useState('')
  const [mostrarListaMotorista, setMostrarListaMotorista] = useState(false)

  const origemPadrao = 'Matriz Filtroamb'

  const [buscaDestino, setBuscaDestino] = useState('')
  const [destinoSelecionado, setDestinoSelecionado] = useState('')
  const [mostrarListaDestino, setMostrarListaDestino] = useState(false)

  const [buscaGestor, setBuscaGestor] = useState('')
  const [gestorSelecionado, setGestorSelecionado] = useState<GestorAutorizacao | null>(null)
  const [mostrarListaGestor, setMostrarListaGestor] = useState(false)

  const [km, setKm] = useState('')
  const [dataHora, setDataHora] = useState('')
  const [observacaoVeiculoEmpresa, setObservacaoVeiculoEmpresa] = useState('')
  const [observacaoTransferencia, setObservacaoTransferencia] = useState('')
  const [kmTransferencia, setKmTransferencia] = useState('')
  const [observacaoVeiculoExterno, setObservacaoVeiculoExterno] = useState('')

  // States specific to Transferencia
  const [baseOrigem, setBaseOrigem] = useState('')
  const [baseDestino, setBaseDestino] = useState('')
  const [mostrarListaBaseOrigem, setMostrarListaBaseOrigem] = useState(false)
  const [mostrarListaBaseDestino, setMostrarListaBaseDestino] = useState(false)

  // States specific to Pedestre
  const [nomePedestre, setNomePedestre] = useState('')
  const [cpfPedestre, setCpfPedestre] = useState('')
  const [telefonePedestre, setTelefonePedestre] = useState('')
  const [empresaPedestre, setEmpresaPedestre] = useState('')
  const [observacaoPedestre, setObservacaoPedestre] = useState('')

  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [acaoEmAndamentoId, setAcaoEmAndamentoId] = useState<string | null>(null)

  const podeVeiculoEmpresa = permissoesAtualizadas.podeAcessarDetalhe('liberacao', 'liberacao.veiculo_empresa')
  const podeVeiculoExterno = permissoesAtualizadas.podeAcessarDetalhe('liberacao', 'liberacao.veiculo_externo')
  const podePedestre = permissoesAtualizadas.podeAcessarDetalhe('liberacao', 'liberacao.pedestre')
  const podeTransferencia = permissoesAtualizadas.podeAcessarDetalhe('liberacao', 'liberacao.transferencia')
  const roleUsuario = permissoesAtualizadas.role
  const emailUsuario = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || ''
  const podeAutorizarSaida = ['dev', 'gestor', 'editor'].includes(roleUsuario)
  const podeAutorizacoes = podeVeiculoExterno && podeAutorizarSaida

  const tiposPermitidos = useMemo(() => [
    podeVeiculoEmpresa ? 'interno' : null,
    podeVeiculoExterno ? 'externo' : null,
    podePedestre ? 'pedestre' : null,
    podeTransferencia ? 'transferencia' : null,
    podeAutorizacoes ? 'autorizacoes' : null,
  ].filter(Boolean) as TipoLiberacao[], [podeVeiculoEmpresa, podeVeiculoExterno, podePedestre, podeTransferencia, podeAutorizacoes])

  const placaExternaNormalizada = formatPlate(placaExterna)
  const placaExternaPertenceEmpresa =
    tipoVeiculo === 'externo' &&
    placaExternaNormalizada.length === 7 &&
    veiculos.some((veiculo) => formatPlate(veiculo.NR_PLACA || '') === placaExternaNormalizada)
  const mensagemListaPlaca = veiculos.length === 0
    ? 'Nenhum veiculo carregado.'
    : 'Nenhuma placa encontrada.'

  const veiculosFiltradosPorPlaca = useMemo(() => {
    const buscaNormalizada = formatPlate(buscaPlaca)
    if (!buscaNormalizada) return []

    return Array.from(
      new Map(
        veiculos
          .filter((veiculo) => formatPlate(veiculo.NR_PLACA || '').includes(buscaNormalizada))
          .map((veiculo) => [veiculo.NR_PLACA, veiculo]),
      ).values(),
    ).slice(0, 8)
  }, [buscaPlaca, veiculos])

  function selecionarVeiculoPorPlaca(veiculo: Veiculo) {
    setVeiculoSelecionado(veiculo)
    setBuscaPlaca(formatPlateDisplay(veiculo.NR_PLACA))
    setMostrarListaPlaca(false)
    setIndicePlacaAtivo(-1)
  }

  function navegarListaPlaca(event: KeyboardEvent<HTMLInputElement>) {
    if (!mostrarListaPlaca || veiculoSelecionado || veiculosFiltradosPorPlaca.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndicePlacaAtivo((indice) => (indice + 1) % veiculosFiltradosPorPlaca.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndicePlacaAtivo((indice) => (indice <= 0 ? veiculosFiltradosPorPlaca.length - 1 : indice - 1))
      return
    }

    if (event.key === 'Enter') {
      const selecionado = veiculosFiltradosPorPlaca[indicePlacaAtivo >= 0 ? indicePlacaAtivo : 0]
      if (selecionado) {
        event.preventDefault()
        selecionarVeiculoPorPlaca(selecionado)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setMostrarListaPlaca(false)
      setIndicePlacaAtivo(-1)
    }
  }

  async function registrarLiberacaoSegura(dados: Record<string, unknown>) {
    const resposta = await fetch('/api/liberacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
    const resultado = await lerJsonSeguro(resposta)

    if (!resposta.ok) {
      throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao registrar liberacao.')
    }

    return typeof resultado.mensagem === 'string' ? resultado.mensagem : 'Registro criado com sucesso.'
  }

  async function executarPortariaSegura(tipo: string, id: number) {
    const resposta = await fetch('/api/portaria/acoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id }),
    })
    const resultado = await lerJsonSeguro(resposta)

    if (!resposta.ok) {
      throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao executar acao da portaria.')
    }

    setMensagem(typeof resultado.mensagem === 'string' ? resultado.mensagem : 'Acao registrada.')
    await carregarDados()
  }

  function chaveAcao(tipo: string, id: number) {
    return `${tipo}:${id}`
  }

  async function autorizarSaidaVeiculoSegura(movimentacao: MovimentacaoAutorizacao) {
    const chave = chaveAcao('veiculo_autorizar_saida', movimentacao.id)
    if (acaoEmAndamentoId) return

    setAcaoEmAndamentoId(chave)
    try {
      await executarPortariaSegura('veiculo_autorizar_saida', movimentacao.id)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao autorizar saida: ${error.message}` : 'Erro ao autorizar saida.')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  const carregarGestores = useCallback(async function carregarGestores() {
    setErroGestores('')

    try {
      const resposta = await fetch('/api/gestores-autorizacao', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const resultado = await lerJsonSeguro(resposta)

      if (!resposta.ok) {
        throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao carregar gestores.')
      }

      setGestores(Array.isArray(resultado.gestores) ? resultado.gestores : [])
    } catch (error) {
      const mensagemErro = error instanceof Error ? error.message : 'Erro ao carregar gestores.'
      setGestores([])
      setErroGestores(mensagemErro)
      if (tipoVeiculo === 'externo') {
        setMensagem(`Erro ao carregar gestores: ${mensagemErro}`)
      }
    }
  }, [tipoVeiculo])

  const carregarDados = useCallback(async function carregarDados() {
    const [v, o, d, motoristasResponse, autorizacoes, acoes] = await Promise.all([
      supabase.from('TBL_VEICULOS').select('NR_PLACA, DS_MODELO, DS_MARCA, NR_ANO_MODELO').order('NR_PLACA'),
      supabase.from('TBL_ORIGENS').select('id, nome').order('nome'),
      supabase.from('TBL_DESTINOS').select('id, nome').order('nome'),
      fetch('/api/cadastros/pessoas/selecao?tipo=motorista', { cache: 'no-store' }),
      supabase
        .from('TBL_MOVIMENTACOES')
        .select('id, origem_tabela, origem_id, placa, km, motorista, localizacao, destino, status, liberado_em, saida_em, entrada_em, tipo_veiculo, gestor_responsavel_nome, gestor_responsavel_email, gestor_responsavel_setor')
        .eq('tipo_entidade', 'veiculo')
        .in('tipo_veiculo', ['externo', 'veiculo_externo'])
        .is('saida_em', null)
        .order('liberado_em', { ascending: false })
        .returns<MovimentacaoAutorizacao[]>(),
      supabase
        .from('TBL_HISTORICOS_ACOES')
        .select('entidade_id, acao')
        .eq('tipo_entidade', 'veiculo')
        .eq('acao', 'saida_autorizada')
        .returns<AcaoMovimentacao[]>(),
    ])
    if (v.data) setVeiculos(v.data)
    if (o.data) setOrigens(o.data)
    if (d.data) setDestinos(d.data)
    if (motoristasResponse.ok) {
      const resultado = await lerJsonSeguro(motoristasResponse)
      setMotoristas(Array.isArray(resultado.pessoas) ? resultado.pessoas : [])
    } else {
      setMotoristas([])
    }
    if (autorizacoes.data) setMovimentacoesAutorizacao(autorizacoes.data)
    if (acoes.data) setAcoesMovimentacoes(acoes.data)

    if (autorizacoes.error || acoes.error) {
      const erro = autorizacoes.error?.message || acoes.error?.message || 'Erro desconhecido'
      setMensagem(`Erro ao carregar autorizacoes: ${erro}`)
    }

    await carregarGestores()
  }, [carregarGestores, supabase])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useEffect(() => {
    if (!isLoaded || tiposPermitidos.length === 0 || tiposPermitidos.includes(tipoVeiculo)) return
    setTipoVeiculo(tiposPermitidos[0])
    setMensagem('')
  }, [isLoaded, tiposPermitidos, tipoVeiculo])

  useEffect(() => {
    if (!isLoaded || !podeAutorizacoes || typeof window === 'undefined') return
    const aba = new URLSearchParams(window.location.search).get('aba')
    if (aba === 'autorizacoes') {
      setTipoVeiculo('autorizacoes')
      setMensagem('')
    }
  }, [isLoaded, podeAutorizacoes])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setMostrarListaPlaca(false)
        setMostrarListaMotorista(false)
        setMostrarListaDestino(false)
        setMostrarListaBaseOrigem(false)
        setMostrarListaBaseDestino(false)
        setMostrarListaGestor(false)
        setIndicePlacaAtivo(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function idsHistoricoMovimentacao(movimentacao: MovimentacaoAutorizacao) {
    return new Set([
      String(movimentacao.id),
      movimentacao.origem_tabela === 'movimentacoes' && movimentacao.origem_id ? String(movimentacao.origem_id) : null,
    ].filter(Boolean) as string[])
  }

  function temSaidaAutorizada(movimentacao: MovimentacaoAutorizacao) {
    const ids = idsHistoricoMovimentacao(movimentacao)
    return acoesMovimentacoes.some((acao) => acao.entidade_id && ids.has(String(acao.entidade_id)) && acao.acao === 'saida_autorizada')
  }

  function podeAutorizarMovimentacao(movimentacao: MovimentacaoAutorizacao) {
    return podeAutorizarSaida &&
      (roleUsuario !== 'gestor' || Boolean(emailUsuario && movimentacao.gestor_responsavel_email?.toLowerCase() === emailUsuario))
  }

  const autorizacoesPendentes = movimentacoesAutorizacao.filter((movimentacao) =>
    isVeiculoExterno(movimentacao.tipo_veiculo) &&
    Boolean(movimentacao.entrada_em) &&
    !movimentacao.saida_em &&
    movimentacao.status !== 'saida_autorizada' &&
    !temSaidaAutorizada(movimentacao) &&
    podeAutorizarMovimentacao(movimentacao)
  )

  async function validarKmVeiculo(placa: string) {
    const kmAtual = Number(km.replace(/\D/g, ''))

    if (!Number.isFinite(kmAtual) || kmAtual <= 0) {
      setMensagem('Informe um KM maior que zero')
      return null
    }

    const padraoPlaca = padraoBuscaPlacaKm(placa)
    const [movimentacoesQuery, acoesQuery] = await Promise.all([
      supabase
        .from('TBL_MOVIMENTACOES')
        .select('placa, km')
        .eq('tipo_entidade', 'veiculo')
        .ilike('placa', padraoPlaca)
        .not('km', 'is', null)
        .limit(1000)
        .returns<RegistroKm[]>(),
      supabase
        .from('TBL_HISTORICOS_ACOES')
        .select('placa, dados')
        .eq('tipo_entidade', 'veiculo')
        .ilike('placa', padraoPlaca)
        .limit(1000)
        .returns<RegistroHistoricoKm[]>(),
    ])

    if (movimentacoesQuery.error || acoesQuery.error) {
      const erro = movimentacoesQuery.error?.message || acoesQuery.error?.message || 'Erro desconhecido'
      setMensagem('Erro ao validar KM: ' + erro)
      return null
    }

    const maiorMovimentacoes = maiorKmDosRegistros(movimentacoesQuery.data || [], placa)
    const registrosHistorico = (acoesQuery.data || []).map((registro) => ({
      placa: registro.placa || registro.dados?.placa || null,
      km: registro.dados?.km ?? null,
    }))
    const maiorAcoes = maiorKmDosRegistros(registrosHistorico, placa)
    const kmsRegistrados = [maiorMovimentacoes, maiorAcoes].filter((kmRegistro): kmRegistro is number => kmRegistro !== null)
    const ultimoKm = kmsRegistrados.length ? Math.max(...kmsRegistrados) : 0
    if (ultimoKm > 0 && kmAtual < ultimoKm) {
      setMensagem(`KM informado nao pode ser menor que o ultimo registrado (${ultimoKm})`)
      return null
    }

    return kmAtual
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!tiposPermitidos.includes(tipoVeiculo)) {
      setMensagem('Voce nao tem permissao para acessar este topico.')
      return
    }

    if (tipoVeiculo === 'autorizacoes') return

    if (tipoVeiculo === 'veiculo_interno') {
      await registrarMovimentoVeiculoInterno()
      return
    }

    if (tipoVeiculo === 'pedestre') {
      if (!nomePedestre) {
        setMensagem('Preencha o nome do pedestre/visitante')
        return
      }
      if (!destinoSelecionado && !buscaDestino) {
        setMensagem('Selecione o destino (ex: Setor Comercial, Diretoria, etc)')
        return
      }
      if (cpfPedestre && onlyDigits(cpfPedestre).length !== 11) {
        setMensagem('Informe um CPF com 11 digitos')
        return
      }
      if (telefonePedestre) {
        const telefoneDigits = onlyDigits(telefonePedestre)
        if (telefoneDigits.length < 10 || telefoneDigits.length > 11) {
          setMensagem('Informe um telefone com DDD')
          return
        }
      }

      setCarregando(true)
      setMensagem('')

      try {
        const mensagemSucesso = await registrarLiberacaoSegura({
          tipo: 'pedestre',
          nome: nomePedestre,
          cpf_rg: cpfPedestre || null,
          telefone: telefonePedestre || null,
          empresa: empresaPedestre || null,
          destino: destinoSelecionado || buscaDestino,
          liberado_em: dataHora || null,
          observacao: observacaoPedestre || null,
        })
        setMensagem(mensagemSucesso)
      } catch (error) {
        setMensagem(error instanceof Error ? `Erro ao liberar pedestre: ${error.message}` : 'Erro ao liberar pedestre.')
        return
      } finally {
        setCarregando(false)
      }
      setNomePedestre('')
      setCpfPedestre('')
      setTelefonePedestre('')
      setEmpresaPedestre('')
      setObservacaoPedestre('')
      setDestinoSelecionado('')
      setBuscaDestino('')
      setDataHora('')
      return
    }

    if (tipoVeiculo === 'transferencia') {
      if (!veiculoSelecionado) {
        setMensagem('Selecione um veiculo')
        return
      }
      if (!baseOrigem || !baseDestino) {
        setMensagem('Selecione origem e destino')
        return
      }
      if (baseOrigem === baseDestino) {
        setMensagem('Origem e destino nao podem ser iguais')
        return
      }
      if (!kmTransferencia) {
        setMensagem('Preencha o KM atual')
        return
      }

      setCarregando(true)
      setMensagem('')

      try {
        const mensagemSucesso = await registrarLiberacaoSegura({
          tipo: 'transferencia',
          placa: veiculoSelecionado.NR_PLACA,
          base_origem: baseOrigem,
          base_destino: baseDestino,
          motorista: motoristaSelecionado || buscaMotorista || null,
          km: Number(kmTransferencia),
          transferido_em: dataHora || null,
          observacao: observacaoTransferencia || null,
        })
        setMensagem(mensagemSucesso)
      } catch (error) {
        setMensagem(error instanceof Error ? `Erro ao transferir: ${error.message}` : 'Erro ao transferir.')
        return
      } finally {
        setCarregando(false)
      }
      setVeiculoSelecionado(null)
      setBuscaPlaca('')
      setBaseOrigem('')
      setBaseDestino('')
      setBuscaMotorista('')
      setMotoristaSelecionado('')
      setKmTransferencia('')
      setDataHora('')
      setObservacaoTransferencia('')
      carregarDados()
      return
    }

    // Logica para Liberacao (Interno / Externo)
    const placaFinal =
      tipoVeiculo === 'interno'
        ? veiculoSelecionado?.NR_PLACA
        : formatPlate(placaExterna)

    if (!placaFinal) {
      setMensagem(tipoVeiculo === 'interno' ? 'Selecione um veiculo da lista' : 'Informe a placa do veiculo externo')
      return
    }
    if (tipoVeiculo === 'externo' && placaFinal.length !== 7) {
      setMensagem('A placa deve ter exatamente 7 caracteres')
      return
    }
    if (
      tipoVeiculo === 'externo' &&
      veiculos.some((veiculo) => formatPlate(veiculo.NR_PLACA || '') === placaFinal)
    ) {
      setMensagem('Essa placa pertence a um veiculo da empresa. Use a opcao Veiculo da Empresa ou Veiculo Interno.')
      return
    }
    const motoristaFinal = tipoVeiculo === 'externo'
      ? buscaMotorista.replace(/\s+/g, ' ').trim().toUpperCase()
      : motoristaSelecionado

    if (!motoristaFinal) {
      setMensagem(tipoVeiculo === 'externo' ? 'Informe o motorista externo' : 'Selecione um motorista')
      return
    }
    if (!destinoSelecionado) {
      setMensagem('Selecione um destino')
      return
    }
    if (tipoVeiculo === 'interno' && !km) {
      setMensagem('Preencha o KM')
      return
    }
    if (tipoVeiculo === 'externo' && !gestorSelecionado) {
      setMensagem('Selecione o gestor responsavel pela autorizacao de saida')
      return
    }
    if (!dataHora) {
      setMensagem('Preencha a data/hora')
      return
    }
    const kmAtual = tipoVeiculo === 'interno' ? await validarKmVeiculo(placaFinal) : null
    if (tipoVeiculo === 'interno' && kmAtual === null) return

    setCarregando(true)
    setMensagem('')

    try {
      const mensagemSucesso = await registrarLiberacaoSegura({
        tipo: 'veiculo',
        tipo_veiculo: tipoVeiculo,
        placa: placaFinal,
        km: kmAtual,
        motorista: motoristaFinal,
        origem: origemPadrao,
        destino: destinoSelecionado,
        data: dataHora,
        gestor_responsavel_id: tipoVeiculo === 'externo' ? gestorSelecionado?.id : null,
        modelo_externo: tipoVeiculo === 'externo' ? modeloExterno.trim() || null : null,
        observacao: tipoVeiculo === 'externo' ? observacaoVeiculoExterno || null : observacaoVeiculoEmpresa || null,
      })
      setMensagem(mensagemSucesso)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao liberar: ${error.message}` : 'Erro ao liberar.')
      return
    } finally {
      setCarregando(false)
    }
    setVeiculoSelecionado(null)
    setBuscaPlaca('')
    setPlacaExterna('')
    setModeloExterno('')
    setMotoristaSelecionado('')
    setBuscaMotorista('')
    setDestinoSelecionado('')
    setBuscaDestino('')
    setGestorSelecionado(null)
    setBuscaGestor('')
    setKm('')
    setDataHora('')
    setObservacaoVeiculoEmpresa('')
    setObservacaoVeiculoExterno('')
  }

  async function registrarMovimentoVeiculoInterno(e?: React.FormEvent) {
    e?.preventDefault()
    const placaFinal = veiculoSelecionado?.NR_PLACA

    if (!placaFinal) {
      setMensagem('Selecione um veiculo da lista')
      return
    }
    if (!motoristaSelecionado) {
      setMensagem('Selecione um motorista')
      return
    }
    if (!dataHora) {
      setMensagem('Preencha a data/hora')
      return
    }
    setCarregando(true)
    setMensagem('')

    try {
      const mensagemSucesso = await registrarLiberacaoSegura({
        tipo: 'veiculo_interno',
        placa: placaFinal,
        motorista: motoristaSelecionado,
        origem: origemPadrao,
        movimento: movimentoVeiculoInterno,
        data: dataHora,
      })
      setMensagem(mensagemSucesso)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao registrar ${movimentoVeiculoInterno}: ${error.message}` : `Erro ao registrar ${movimentoVeiculoInterno}.`)
      return
    } finally {
      setCarregando(false)
    }
    setVeiculoSelecionado(null)
    setBuscaPlaca('')
    setMotoristaSelecionado('')
    setBuscaMotorista('')
    setDestinoSelecionado('')
    setBuscaDestino('')
    setKm('')
    setDataHora('')
  }

  // Dropdown comum para motorista
  const MotoristaDropdown = (opcional: boolean = false) => (
    <div data-dropdown className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Motorista {opcional && '(opcional)'}
        </label>
      </div>
      <input
        type="text"
        value={buscaMotorista}
        onChange={(e) => {
          setBuscaMotorista(e.target.value)
          setMotoristaSelecionado('')
          setMostrarListaMotorista(true)
        }}
        onFocus={() => setMostrarListaMotorista(true)}
        placeholder="Buscar motorista..."
        className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
      />
      {mostrarListaMotorista && !motoristaSelecionado && (
        <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
          {motoristas
            .filter((m) => m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()))
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMotoristaSelecionado(m.nome)
                  setBuscaMotorista(m.nome)
                  setMostrarListaMotorista(false)
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
              >
                {m.nome}
              </button>
            ))}
        </div>
      )}
    </div>
  )

  const MotoristaExternoInput = () => (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        Motorista Externo
      </label>
      <input
        type="text"
        value={buscaMotorista}
        onChange={(e) => {
          setBuscaMotorista(e.target.value.toUpperCase())
          setMotoristaSelecionado('')
          setMostrarListaMotorista(false)
        }}
        placeholder="Nome do motorista externo"
        className="w-full px-4 py-2.5 bg-[#132337] border border-orange-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 transition"
      />
    </div>
  )

  const DestinoDropdown = () => (
    <div data-dropdown className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Destino</label>
      </div>
      <input
        type="text"
        value={buscaDestino}
        onChange={(e) => {
          setBuscaDestino(e.target.value)
          setDestinoSelecionado('')
          setMostrarListaDestino(true)
        }}
        onFocus={() => setMostrarListaDestino(true)}
        placeholder="Buscar destino..."
        className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
      />
      {mostrarListaDestino && !destinoSelecionado && (
        <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
          {destinos
            .filter((d) => d.nome.toLowerCase().includes(buscaDestino.toLowerCase()))
            .map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDestinoSelecionado(d.nome)
                  setBuscaDestino(d.nome)
                  setMostrarListaDestino(false)
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
              >
                {d.nome}
              </button>
            ))}
        </div>
      )}
    </div>
  )

  const GestorDropdown = () => {
    const gestoresFiltrados = gestores.filter((gestor) => {
      const texto = `${gestor.nome} ${gestor.email} ${gestor.setor}`.toLowerCase()
      return texto.includes(buscaGestor.toLowerCase())
    })

    return (
      <div data-dropdown className="relative">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gestor responsavel</label>
        </div>
        <input
          type="text"
          value={buscaGestor}
          onChange={(e) => {
            setBuscaGestor(e.target.value)
            setGestorSelecionado(null)
            setMostrarListaGestor(true)
          }}
          onFocus={() => setMostrarListaGestor(true)}
          placeholder="Buscar gestor por nome, email ou setor..."
          className="w-full px-4 py-2.5 bg-[#132337] border border-orange-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 transition"
        />
        {mostrarListaGestor && !gestorSelecionado && (
          <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-orange-500/25 rounded-xl shadow-2xl max-h-48 overflow-auto">
            {gestoresFiltrados.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400">
                {erroGestores ? `Erro ao carregar gestores: ${erroGestores}` : gestores.length === 0 ? 'Nenhum gestor ativo cadastrado.' : 'Nenhum gestor encontrado.'}
              </div>
            ) : (
              gestoresFiltrados.map((gestor) => (
                <button
                  key={gestor.id}
                  type="button"
                  onClick={() => {
                    setGestorSelecionado(gestor)
                    setBuscaGestor(`${gestor.nome} - ${gestor.setor}`)
                    setMostrarListaGestor(false)
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-orange-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
                >
                  <div className="font-semibold text-orange-300">{gestor.nome} - {gestor.setor}</div>
                  <div className="text-xs text-slate-400">{gestor.email}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <RequirePermissao permissao="liberacao">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <div className="app-scroll flex-1 overflow-y-auto bg-[#0a1625]">
            <main className={`liberacao-page px-4 md:px-8 xl:px-14 ${tipoVeiculo === 'transferencia' ? 'py-4' : 'py-6'}`}>
              <div className="w-full">
                <div className="app-scroll mb-4 flex gap-1.5 overflow-x-auto rounded-xl border border-emerald-500/20 bg-[#132337] p-1.5">
                  {(podeVeiculoEmpresa || podeTransferencia) && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo(podeVeiculoEmpresa ? 'interno' : 'transferencia'); setMensagem('') }}
                      className={`min-w-[160px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${tipoVeiculo === 'interno' || tipoVeiculo === 'transferencia' ? 'bg-emerald-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      Veiculo Empresa
                    </button>
                  )}
                  {podeVeiculoExterno && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('externo'); setMensagem('') }}
                      className={`min-w-[160px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${tipoVeiculo === 'externo' ? 'bg-orange-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      Veiculo Externo
                    </button>
                  )}
                  {podePedestre && (
                    <button
                      type="button"
                      data-liberacao-tab="pedestre"
                      onClick={() => { setTipoVeiculo('pedestre'); setMensagem('') }}
                      className={`min-w-[170px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${tipoVeiculo === 'pedestre' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      Pedestres / Visitantes
                    </button>
                  )}
                  {podeAutorizacoes && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('autorizacoes'); setMensagem('') }}
                      className={`min-w-[160px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${tipoVeiculo === 'autorizacoes' ? 'bg-amber-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      Autorizacoes
                    </button>
                  )}
                </div>

                <div key={tipoVeiculo} className="animate-tab bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 overflow-visible">
                  <div className="px-6 py-3 border-b border-white/5 bg-[#132337]/60 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-sm font-semibold text-white">
                        {tipoVeiculo === 'transferencia' ? 'Nova Transferencia' :
                          tipoVeiculo === 'pedestre' ? 'Liberar Entrada de Pedestre' :
                            tipoVeiculo === 'veiculo_interno' ? `Registrar ${movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de Veiculo Interno` :
                              tipoVeiculo === 'autorizacoes' ? 'Autorizar Saida de Veiculo Externo' : 'Nova Autorizacao de Saida'}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {tipoVeiculo === 'interno' && 'Frota propria Filtroamb'}
                        {tipoVeiculo === 'externo' && 'Veiculo de terceiro / visitante'}
                        {tipoVeiculo === 'pedestre' && 'Pessoas entrando a pe ou visitantes que deixam o carro fora'}
                        {tipoVeiculo === 'transferencia' && 'Use quando o veiculo muda de base de trabalho'}
                        {tipoVeiculo === 'veiculo_interno' && `${movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de veiculo interno da empresa`}
                        {tipoVeiculo === 'autorizacoes' && 'Solicitacoes liberadas pela portaria aguardando o gestor'}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6">

                    {(tipoVeiculo === 'interno' || tipoVeiculo === 'transferencia') && podeVeiculoEmpresa && podeTransferencia && (
                      <div className="mb-5 grid w-full grid-cols-2 gap-3 rounded-xl border border-emerald-500/15 bg-[#132337]/60 p-1.5">
                        <button
                          type="button"
                          onClick={() => { setTipoVeiculo('interno'); setMensagem('') }}
                          className={`rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${tipoVeiculo === 'interno' ? 'bg-emerald-500 text-[#0a1625] shadow-[0_0_18px_rgba(16,185,129,0.22)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          Liberacao
                        </button>
                        <button
                          type="button"
                          data-liberacao-tab="transferencia"
                          onClick={() => { setTipoVeiculo('transferencia'); setMensagem('') }}
                          className={`rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${tipoVeiculo === 'transferencia' ? 'bg-blue-500 text-white shadow-[0_0_18px_rgba(59,130,246,0.22)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          Transferencia
                        </button>
                      </div>
                    )}

                    {tipoVeiculo === 'autorizacoes' ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-amber-500/20 bg-[#132337]/60 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Aguardando gestor</p>
                            <p className="mt-1 text-3xl font-bold text-amber-300">{autorizacoesPendentes.length}</p>
                          </div>
                          <div className="rounded-2xl border border-orange-500/15 bg-[#132337]/60 p-4 md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fluxo</p>
                            <p className="mt-1 text-sm font-medium text-slate-200">
                              Autorize a saida do veiculo externo para liberar a baixa final na portaria.
                            </p>
                          </div>
                        </div>

                        <div className="hidden overflow-hidden rounded-2xl border border-amber-500/15 bg-[#0f1c2e] min-[1025px]:block">
                          <div className="app-scroll max-h-[52vh] overflow-y-auto overflow-x-auto">
                            <table className="w-full min-w-[780px] text-xs">
                              <thead>
                                <tr className="sticky top-0 z-10 border-b border-amber-500/15 bg-[#132337]">
                                  <th className="px-3 py-3 text-center text-[13px] font-semibold uppercase tracking-wider text-amber-300">Placa</th>
                                  <th className="px-3 py-3 text-center text-[13px] font-semibold uppercase tracking-wider text-amber-300">Motorista</th>
                                  <th className="px-3 py-3 text-center text-[13px] font-semibold uppercase tracking-wider text-amber-300">Liberado</th>
                                  <th className="px-3 py-3 text-center text-[13px] font-semibold uppercase tracking-wider text-amber-300">Destino</th>
                                  <th className="px-3 py-3 text-center text-[13px] font-semibold uppercase tracking-wider text-amber-300">Gestor</th>
                                  <th className="px-3 py-3 text-center text-[13px] font-semibold uppercase tracking-wider text-amber-300">Setor</th>
                                  <th className="px-3 py-3 text-center text-[13px] font-semibold uppercase tracking-wider text-amber-300">Acao</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {autorizacoesPendentes.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Nenhum veiculo externo aguardando autorizacao de saida.</td>
                                  </tr>
                                ) : (
                                  autorizacoesPendentes.map((movimentacao) => (
                                    <tr key={movimentacao.id} className="transition-colors hover:bg-amber-500/5">
                                      <td className="px-3 py-3 text-center">
                                        <span className="text-sm font-semibold tracking-wide text-amber-300">{formatPlateDisplay(movimentacao.placa)}</span>
                                      </td>
                                      <td className="px-3 py-3 text-center text-[13px] font-semibold text-white">{movimentacao.motorista || '--'}</td>
                                      <td className="px-3 py-3 text-center text-[13px] font-semibold text-white">{formatarData(movimentacao.entrada_em || movimentacao.liberado_em)}</td>
                                      <td className="px-3 py-3 text-center text-[13px] font-semibold text-white">{movimentacao.destino || '--'}</td>
                                      <td className="px-3 py-3 text-center text-[13px] font-semibold text-white">{movimentacao.gestor_responsavel_nome || '--'}</td>
                                      <td className="px-3 py-3 text-center text-[13px] font-semibold text-white">{movimentacao.gestor_responsavel_setor || '--'}</td>
                                      <td className="px-3 py-3 text-center">
                                        <button
                                          type="button"
                                          onClick={() => autorizarSaidaVeiculoSegura(movimentacao)}
                                          disabled={acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', movimentacao.id)}
                                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-[#0a1625] transition-all duration-150 hover:bg-amber-400 hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', movimentacao.id) ? 'Registrando...' : 'Autorizar Saida'}
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
                          {autorizacoesPendentes.length === 0 ? (
                            <div className="rounded-2xl border border-amber-500/15 bg-[#132337]/60 p-5 text-center text-sm text-slate-500">
                              Nenhum veiculo externo aguardando autorizacao de saida.
                            </div>
                          ) : (
                            autorizacoesPendentes.map((movimentacao) => (
                              <div key={movimentacao.id} className="rounded-2xl border border-amber-500/15 bg-[#132337]/60 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-lg font-bold tracking-wide text-amber-300">{formatPlateDisplay(movimentacao.placa)}</p>
                                  <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                                    Aguardando
                                  </span>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motorista</p>
                                    <p className="mt-1 font-semibold text-white">{movimentacao.motorista || '--'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Destino</p>
                                    <p className="mt-1 font-semibold text-white">{movimentacao.destino || '--'}</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-[#0f1c2e] p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Liberado</p>
                                      <p className="mt-1 font-semibold text-slate-200">{formatarData(movimentacao.entrada_em || movimentacao.liberado_em)}</p>
                                    </div>
                                    <div className="rounded-xl bg-[#0f1c2e] p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Gestor</p>
                                      <p className="mt-1 font-semibold text-slate-200">{movimentacao.gestor_responsavel_nome || '--'}</p>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => autorizarSaidaVeiculoSegura(movimentacao)}
                                  disabled={acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', movimentacao.id)}
                                  className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-[#0a1625] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {acaoEmAndamentoId === chaveAcao('veiculo_autorizar_saida', movimentacao.id) ? 'Registrando...' : 'Autorizar Saida'}
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {mensagem && (
                          <div className={`p-3 rounded-xl text-sm ${mensagem.includes('Erro')
                            ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            }`}>
                            {mensagem}
                          </div>
                        )}
                      </div>
                    ) : tipoVeiculo === 'pedestre' ? (
                      /* ======= FORMULÃRIO DE PEDESTRE ======= */
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                          <div className="xl:order-1">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Nome Completo *
                            </label>
                            <input
                              type="text"
                              value={nomePedestre}
                              onChange={(e) => setNomePedestre(e.target.value)}
                              placeholder="Ex: Joao da Silva"
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                          <div className="xl:order-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Empresa / Representacao
                            </label>
                            <input
                              type="text"
                              value={empresaPedestre}
                              onChange={(e) => setEmpresaPedestre(e.target.value)}
                              placeholder="Ex: Empresa Parceira LTDA"
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3 xl:order-3">
                            <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              CPF
                            </label>
                            <input
                              type="text"
                              value={cpfPedestre}
                              onChange={(e) => setCpfPedestre(formatCpf(e.target.value))}
                              placeholder="000.000.000-00"
                              inputMode="numeric"
                              maxLength={14}
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                            <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Telefone
                            </label>
                            <input
                              type="text"
                              value={telefonePedestre}
                              onChange={(e) => setTelefonePedestre(formatPhone(e.target.value))}
                              placeholder="00 0 0000-0000"
                              inputMode="tel"
                              maxLength={15}
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                          </div>

                          <div data-dropdown className="relative xl:order-5">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Destino / Setor *</label>
                            </div>
                            <input
                              type="text"
                              value={buscaDestino}
                              onChange={(e) => {
                                setBuscaDestino(e.target.value)
                                setDestinoSelecionado('')
                                setMostrarListaDestino(true)
                              }}
                              onFocus={() => setMostrarListaDestino(true)}
                              placeholder="Buscar destino..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                            {mostrarListaDestino && !destinoSelecionado && (
                              <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-purple-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
                                {destinos
                                  .filter((d) => d.nome.toLowerCase().includes(buscaDestino.toLowerCase()))
                                  .map((d) => (
                                    <button
                                      key={d.id}
                                      type="button"
                                      onClick={() => {
                                        setDestinoSelecionado(d.nome)
                                        setBuscaDestino(d.nome)
                                        setMostrarListaDestino(false)
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
                                    >
                                      {d.nome}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>

                          <div className="xl:order-4">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Data e hora
                            </label>
                            <input
                              type="datetime-local"
                              value={dataHora}
                              onChange={(e) => setDataHora(e.target.value)}
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                          <div className="xl:order-6">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Observacao
                            </label>
                            <input
                              type="text"
                              value={observacaoPedestre}
                              onChange={(e) => setObservacaoPedestre(e.target.value)}
                              placeholder="Observacao opcional..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                        </div>

                        <div>
                          <button
                            type="submit"
                            data-liberacao-action="pedestre"
                            disabled={carregando}
                            className="w-full bg-purple-500 hover:bg-purple-400 text-white font-semibold py-3 rounded-xl transition shadow-[0_0_20px_rgba(168,85,247,0.25)] disabled:opacity-40"
                          >
                            {carregando ? 'Liberando...' : 'Liberar Entrada de Pedestre'}
                          </button>
                        </div>

                        {mensagem && (
                          <div className={`p-3 rounded-xl text-sm ${mensagem.includes('sucesso')
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-300 border border-red-500/20'
                            }`}>
                            {mensagem}
                          </div>
                        )}
                      </div>

                    ) : tipoVeiculo === 'transferencia' ? (
                      /* ======= FORMULÃRIO DE TRANSFERÃŠNCIA ======= */
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          <div data-dropdown className="relative">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Veiculo
                            </label>
                            <input
                              type="text"
                              value={buscaPlaca}
                              onChange={(e) => {
                                setBuscaPlaca(formatPlateDisplay(e.target.value))
                                setVeiculoSelecionado(null)
                                setMostrarListaPlaca(true)
                                setIndicePlacaAtivo(-1)
                              }}
                              onFocus={() => setMostrarListaPlaca(true)}
                              onKeyDown={navegarListaPlaca}
                              placeholder="Buscar placa..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 uppercase transition"
                            />
                            {mostrarListaPlaca && !veiculoSelecionado && buscaPlaca.length >= 1 && (
                              <div className="app-scroll absolute z-50 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-56 overflow-auto">
                                {veiculosFiltradosPorPlaca.length > 0 ? (
                                  veiculosFiltradosPorPlaca.map((v, i) => (
                                    <button
                                      key={`${v.NR_PLACA}-${i}`}
                                      type="button"
                                      onClick={() => selecionarVeiculoPorPlaca(v)}
                                      className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 ${indicePlacaAtivo === i ? 'bg-emerald-500/15' : 'hover:bg-emerald-500/10'}`}
                                    >
                                      <div className="font-semibold text-emerald-300">{formatPlateDisplay(v.NR_PLACA)}</div>
                                      <div className="text-xs text-slate-400">{v.DS_MODELO}</div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-4 py-3 text-sm text-slate-400">{mensagemListaPlaca}</div>
                                )}
                              </div>
                            )}
                          </div>

                          <div data-dropdown className="relative">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Base origem
                            </label>
                            <input
                              type="text"
                              value={baseOrigem}
                              onChange={(e) => {
                                setBaseOrigem(e.target.value)
                                setMostrarListaBaseOrigem(true)
                              }}
                              onFocus={() => setMostrarListaBaseOrigem(true)}
                              placeholder="Buscar base origem..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                            />
                            {mostrarListaBaseOrigem && (
                              <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
                                {origens
                                  .filter((b) =>
                                    b.nome.toLowerCase().includes(baseOrigem.toLowerCase())
                                  )
                                  .map((b) => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => {
                                        setBaseOrigem(b.nome)
                                        setMostrarListaBaseOrigem(false)
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
                                    >
                                      {b.nome}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>

                          {MotoristaDropdown(true)}
                          <div data-dropdown className="relative">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Base destino
                            </label>
                            <input
                              type="text"
                              value={baseDestino}
                              onChange={(e) => {
                                setBaseDestino(e.target.value)
                                setMostrarListaBaseDestino(true)
                              }}
                              onFocus={() => setMostrarListaBaseDestino(true)}
                              placeholder="Buscar base destino..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                            />
                            {mostrarListaBaseDestino && (
                              <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
                                {origens
                                  .filter((b) =>
                                    b.nome.toLowerCase().includes(baseDestino.toLowerCase())
                                  )
                                  .map((b) => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => {
                                        setBaseDestino(b.nome)
                                        setMostrarListaBaseDestino(false)
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
                                    >
                                      {b.nome}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                KM Atual
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={kmTransferencia}
                                onChange={(e) => setKmTransferencia(e.target.value.replace(/\D/g, ''))}
                                placeholder="0"
                                className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Data e hora
                              </label>
                              <input
                                type="datetime-local"
                                value={dataHora}
                                onChange={(e) => setDataHora(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Observacao
                            </label>
                            <input
                              type="text"
                              value={observacaoTransferencia}
                              onChange={(e) => setObservacaoTransferencia(e.target.value)}
                              placeholder="Observacao opcional..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                            />
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            type="submit"
                            data-liberacao-action="transferencia"
                            disabled={carregando}
                            className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold py-3 rounded-xl transition disabled:opacity-40"
                          >
                            {carregando ? 'Salvando...' : 'Registrar Transferencia'}
                          </button>
                        </div>

                        {mensagem && (
                          <div className={`p-3 rounded-xl text-sm ${mensagem.includes('sucesso')
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-300 border border-red-500/20'
                            }`}>
                            {mensagem}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ======= FORMULÃRIO DE LIBERAÃ‡ÃƒO ======= */
                      <div className="grid grid-cols-1 gap-x-6 gap-y-4 xl:grid-cols-2">
                        {tipoVeiculo === 'veiculo_interno' && (
                          <div className="xl:col-span-2">
                            <div className="grid w-full grid-cols-2 gap-3 rounded-xl border border-sky-500/15 bg-[#132337]/60 p-1.5">
                              <button
                                type="button"
                                onClick={() => { setMovimentoVeiculoInterno('entrada'); setMensagem('') }}
                                className={`py-2.5 rounded-lg text-sm font-semibold transition ${movimentoVeiculoInterno === 'entrada' ? 'bg-sky-500 text-white shadow-[0_0_18px_rgba(14,165,233,0.25)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                              >
                                Entrada
                              </button>
                              <button
                                type="button"
                                onClick={() => { setMovimentoVeiculoInterno('saida'); setMensagem('') }}
                                className={`py-2.5 rounded-lg text-sm font-semibold transition ${movimentoVeiculoInterno === 'saida' ? 'bg-orange-500 text-[#0a1625] shadow-[0_0_18px_rgba(249,115,22,0.22)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                              >
                                Saida
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          {(tipoVeiculo === 'interno' || tipoVeiculo === 'veiculo_interno') ? (
                            <div data-dropdown className="relative">
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Veiculo</label>
                              <input
                                type="text"
                                value={buscaPlaca}
                                onChange={(e) => {
                                  setBuscaPlaca(formatPlateDisplay(e.target.value))
                                  setVeiculoSelecionado(null)
                                  setMostrarListaPlaca(true)
                                  setIndicePlacaAtivo(-1)
                                }}
                                onFocus={() => setMostrarListaPlaca(true)}
                                onKeyDown={navegarListaPlaca}
                                placeholder="Buscar por placa..."
                                className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 uppercase transition"
                              />
                              {mostrarListaPlaca && !veiculoSelecionado && buscaPlaca.length >= 1 && (
                                <div className="app-scroll absolute z-50 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-52 overflow-auto">
                                  {veiculosFiltradosPorPlaca.length > 0 ? (
                                    veiculosFiltradosPorPlaca.map((v, i) => (
                                      <button
                                        key={`${v.NR_PLACA}-${i}`}
                                        type="button"
                                        onClick={() => selecionarVeiculoPorPlaca(v)}
                                        className={`w-full text-left px-4 py-2.5 border-b border-white/5 last:border-0 ${indicePlacaAtivo === i ? 'bg-emerald-500/15' : 'hover:bg-emerald-500/10'}`}
                                      >
                                        <div className="font-semibold text-emerald-300">{formatPlateDisplay(v.NR_PLACA)}</div>
                                        <div className="text-xs text-slate-400">{v.DS_MODELO}{v.DS_MARCA ? ` • ${v.DS_MARCA}` : ''}</div>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-4 py-3 text-sm text-slate-400">{mensagemListaPlaca}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Placa externa</label>
                                <input
                                  type="text"
                                  value={placaExterna}
                                  onChange={(e) => setPlacaExterna(formatPlateDisplay(e.target.value))}
                                  placeholder="ABC1D23"
                                  maxLength={8}
                                  className={`w-full px-4 py-2.5 bg-[#132337] border rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 uppercase transition ${placaExternaPertenceEmpresa ? 'border-red-500/40 focus:ring-red-400/30' : 'border-orange-500/20 focus:ring-orange-400/40'}`}
                                />
                                {placaExternaPertenceEmpresa && (
                                  <p className="mt-2 text-xs font-medium text-red-300">
                                    Essa placa pertence a um veiculo da empresa. Use Veiculo da Empresa ou Veiculo Interno.
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Modelo</label>
                                <input
                                  type="text"
                                  value={modeloExterno}
                                  onChange={(e) => setModeloExterno(e.target.value)}
                                  placeholder="Ex: Strada"
                                  className="w-full px-4 py-2.5 bg-[#132337] border border-orange-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 transition"
                                />
                              </div>
                            </div>
                          )}

                          <div className={`grid gap-3 ${tipoVeiculo === 'interno' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {tipoVeiculo === 'interno' && (
                              <div data-dropdown>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">KM Atual</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={km}
                                  onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))}
                                  placeholder="0"
                                  className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Data e Hora</label>
                              <input
                                type="datetime-local"
                                value={dataHora}
                                onChange={(e) => setDataHora(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                              />
                            </div>
                          </div>

                          {tipoVeiculo === 'externo' ? DestinoDropdown() : null}
                        </div>

                        <div className="space-y-3">
                          {tipoVeiculo === 'externo' ? MotoristaExternoInput() : MotoristaDropdown(false)}

                          {tipoVeiculo === 'externo' && GestorDropdown()}

                          {tipoVeiculo === 'externo' && (
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Observacao
                              </label>
                              <input
                                type="text"
                                value={observacaoVeiculoExterno}
                                onChange={(e) => setObservacaoVeiculoExterno(e.target.value)}
                                placeholder="Observacao opcional..."
                                className="w-full px-4 py-2.5 bg-[#132337] border border-orange-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 transition"
                              />
                            </div>
                          )}

                          {tipoVeiculo !== 'veiculo_interno' && tipoVeiculo !== 'externo' && DestinoDropdown()}

                          {tipoVeiculo !== 'interno' && tipoVeiculo !== 'externo' && tipoVeiculo !== 'veiculo_interno' && (
                            <div className="pt-2">
                              <button
                                type="submit"
                                disabled={carregando}
                                className={`w-full font-semibold py-3 rounded-xl transition ${tipoVeiculo === 'veiculo_interno'
                                  ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.25)]'
                                  : 'bg-orange-500 hover:bg-orange-400 text-[#0a1625] shadow-[0_0_20px_rgba(249,115,22,0.25)]'
                                  } disabled:opacity-40`}
                              >
                                {carregando
                                  ? tipoVeiculo === 'veiculo_interno' ? 'Registrando...' : 'Liberando...'
                                  : tipoVeiculo === 'veiculo_interno'
                                    ? `Registrar ${movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de Veiculo Interno`
                                    : 'Liberar Veiculo Externo'}
                              </button>
                            </div>
                          )}

                          {tipoVeiculo !== 'interno' && mensagem && (
                            <div className={`p-3 rounded-xl text-sm ${mensagem.includes('sucesso')
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-300 border border-red-500/20'
                              }`}>
                              {mensagem}
                            </div>
                          )}
                        </div>

                        {tipoVeiculo === 'interno' && (
                          <div className="xl:col-span-2">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-end">
                              <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                  Observacao
                                </label>
                                <input
                                  type="text"
                                  value={observacaoVeiculoEmpresa}
                                  onChange={(e) => setObservacaoVeiculoEmpresa(e.target.value)}
                                  placeholder="Observacao opcional..."
                                  className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={carregando}
                                className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#0a1625] shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400 disabled:opacity-40"
                              >
                                {carregando ? 'Liberando...' : 'Liberar Veiculo da Empresa'}
                              </button>
                            </div>
                            {mensagem && (
                              <div className={`mt-4 p-3 rounded-xl text-sm ${mensagem.includes('sucesso')
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-300 border border-red-500/20'
                                }`}>
                                {mensagem}
                              </div>
                            )}
                          </div>
                        )}

                        {(tipoVeiculo === 'externo' || tipoVeiculo === 'veiculo_interno') && (
                          <div className="xl:col-span-2 pt-2">
                            <button
                              type="submit"
                              disabled={carregando}
                              className={`w-full font-semibold py-3 rounded-xl transition disabled:opacity-40 ${tipoVeiculo === 'veiculo_interno'
                                ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.25)]'
                                : 'bg-orange-500 hover:bg-orange-400 text-[#0a1625] shadow-[0_0_20px_rgba(249,115,22,0.25)]'
                                }`}
                            >
                              {carregando
                                ? tipoVeiculo === 'veiculo_interno' ? 'Registrando...' : 'Liberando...'
                                : tipoVeiculo === 'veiculo_interno'
                                  ? `Registrar ${movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de Veiculo Interno`
                                  : 'Liberar Veiculo Externo'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </form>
                </div>

              </div>
            </main>
          </div>
        </div>
      </div>
    </RequirePermissao>
  )
}
