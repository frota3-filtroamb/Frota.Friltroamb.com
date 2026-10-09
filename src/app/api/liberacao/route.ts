import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarHistoricoAcao } from '@/lib/historico-acoes'
import { podeAcessarDetalhe } from '@/lib/roles'

type Body = Record<string, unknown>

type Veiculo = {
  NR_PLACA: string
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

type RegistroEmRota = {
  placa: string | null
  motorista: string | null
}

function texto(valor: unknown) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

function placaNormalizada(valor: unknown) {
  const limpa = texto(valor)?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return limpa || null
}

function placaComHifen(placa: string) {
  const limpa = placaNormalizada(placa) || placa.toUpperCase()
  return limpa.length > 3 ? `${limpa.slice(0, 3)}-${limpa.slice(3)}` : limpa
}

function variantesPlaca(placa: string) {
  const limpa = placaNormalizada(placa)
  return Array.from(new Set([placa.toUpperCase(), limpa, limpa ? placaComHifen(limpa) : null].filter(Boolean) as string[]))
}

function placasIguais(a: string | null | undefined, b: string) {
  const placaA = placaNormalizada(a)
  const placaB = placaNormalizada(b)
  return Boolean(placaA && placaB && placaA === placaB)
}

function kmNumero(valor: unknown) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string') {
    const parsed = Number(valor.replace(/\D/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function maiorKmDosRegistros(registros: RegistroKm[], placa: string) {
  return registros.reduce<number | null>((maior, registro) => {
    if (!placasIguais(registro.placa, placa)) return maior
    const km = kmNumero(registro.km)
    if (km === null) return maior
    return maior === null || km > maior ? km : maior
  }, null)
}

function padraoBuscaPlaca(placa: string) {
  const limpa = placaNormalizada(placa)
  return limpa ? `%${limpa.split('').join('%')}%` : '%'
}

async function buscarMaiorKmRegistrado(
  supabase: ReturnType<typeof createAdminClient>,
  placa: string,
) {
  const padraoPlaca = padraoBuscaPlaca(placa)
  const [movimentacoesQuery, acoesQuery] = await Promise.all([
    supabase
      .from('movimentacoes')
      .select('placa, km')
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

  if (movimentacoesQuery.error) return { km: null, error: movimentacoesQuery.error.message }
  if (acoesQuery.error) return { km: null, error: acoesQuery.error.message }

  const maiorMovimentacoes = maiorKmDosRegistros(movimentacoesQuery.data || [], placa)
  const registrosHistorico = (acoesQuery.data || []).map((registro) => ({
    placa: registro.placa || registro.dados?.placa || null,
    km: registro.dados?.km ?? null,
  }))
  const maiorAcoes = maiorKmDosRegistros(registrosHistorico, placa)
  const kms = [maiorMovimentacoes, maiorAcoes].filter((km): km is number => km !== null)

  return { km: kms.length ? Math.max(...kms) : null, error: null }
}

async function buscarBloqueioEmRota(
  supabase: ReturnType<typeof createAdminClient>,
  placa: string,
  motorista: string | null,
) {
  const motoristaNormalizado = motorista?.trim().toLowerCase() || null
  const [placaQuery, motoristaQuery] = await Promise.all([
    supabase
      .from('movimentacoes')
      .select('placa, motorista')
      .eq('status', 'em_rota')
      .ilike('placa', padraoBuscaPlaca(placa))
      .limit(1000)
      .returns<RegistroEmRota[]>(),
    motoristaNormalizado
      ? supabase
        .from('movimentacoes')
        .select('placa, motorista')
        .eq('status', 'em_rota')
        .ilike('motorista', motoristaNormalizado)
        .limit(1000)
        .returns<RegistroEmRota[]>()
      : Promise.resolve({ data: [], error: null }),
  ])

  if (placaQuery.error) return { error: placaQuery.error.message, mensagem: null }
  if (motoristaQuery.error) return { error: motoristaQuery.error.message, mensagem: null }

  const placaEmRota = (placaQuery.data || []).some((registro) => placasIguais(registro.placa, placa))
  const motoristaEmRota = Boolean(
    motoristaNormalizado &&
    (motoristaQuery.data || []).some((registro) => registro.motorista?.trim().toLowerCase() === motoristaNormalizado),
  )

  if (placaEmRota && motoristaEmRota) {
    return { error: null, mensagem: 'Este motorista e veiculo estao em rota e nao podem receber nova liberacao.' }
  }

  if (placaEmRota) {
    return { error: null, mensagem: 'Este veiculo esta em rota e nao pode receber nova liberacao.' }
  }

  if (motoristaEmRota) {
    return { error: null, mensagem: 'Este motorista esta em rota e nao pode receber nova liberacao.' }
  }

  return { error: null, mensagem: null }
}

async function buscarVeiculoPorPlaca(
  supabase: ReturnType<typeof createAdminClient>,
  placa: string,
) {
  return supabase
    .from('TBL_VEICULOS')
    .select('NR_PLACA')
    .in('NR_PLACA', variantesPlaca(placa))
    .limit(1)
    .maybeSingle<Veiculo>()
}

function dataIso(valor: unknown) {
  const textoData = texto(valor)
  const data = textoData ? new Date(textoData) : new Date()
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

function numero(valor: unknown) {
  return kmNumero(valor)
}

function nomeResponsavel(operador: Awaited<ReturnType<typeof currentUser>>) {
  return operador?.fullName ||
    operador?.username ||
    operador?.primaryEmailAddress?.emailAddress ||
    'Usuario nao identificado'
}

function podeOperar(operador: Awaited<ReturnType<typeof currentUser>>, detalhe: Parameters<typeof podeAcessarDetalhe>[2]) {
  return Boolean(operador && podeAcessarDetalhe(operador, 'liberacao', detalhe))
}

function podeOperarVeiculoInterno(operador: Awaited<ReturnType<typeof currentUser>>) {
  return Boolean(
    operador &&
    (
      podeAcessarDetalhe(operador, 'liberacao', 'liberacao.veiculo_interno') ||
      podeAcessarDetalhe(operador, 'portaria', 'portaria.veiculos')
    ),
  )
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const body = (await request.json()) as Body
  const tipo = texto(body.tipo)
  const supabase = createAdminClient()
  const responsavelNome = nomeResponsavel(operador)
  const responsavelEmail = operador.primaryEmailAddress?.emailAddress || null

  if (tipo === 'pedestre') {
    if (!podeOperar(operador, 'liberacao.pedestre')) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const nome = texto(body.nome)
    const destino = texto(body.destino)
    const liberadoEm = dataIso(body.liberado_em)

    if (!nome) return NextResponse.json({ error: 'Nome obrigatorio.' }, { status: 400 })
    if (!destino) return NextResponse.json({ error: 'Destino obrigatorio.' }, { status: 400 })
    if (!liberadoEm) return NextResponse.json({ error: 'Data invalida.' }, { status: 400 })

    const { data: pedestre, error } = await supabase.from('movimentacoes_pedestres').insert({
      nome,
      cpf_rg: texto(body.cpf_rg),
      telefone: texto(body.telefone),
      empresa: texto(body.empresa),
      destino,
      observacao: texto(body.observacao),
      status: 'aguardando_entrada',
      liberado_por: responsavelNome,
      liberado_em: liberadoEm,
    }).select('*').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const historicoError = await registrarHistoricoAcao({
      supabase,
      tipo_entidade: 'pedestre',
      entidade_id: pedestre.id,
      acao: 'liberacao',
      data_acao: pedestre.liberado_em,
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,

      dados: {
        nome: pedestre.nome,
        cpf_rg: pedestre.cpf_rg,
        telefone: pedestre.telefone,
        empresa: pedestre.empresa,
        destino: pedestre.destino,
        observacao: pedestre.observacao,
        status_movimentacao: pedestre.status,
      },
    })

    return NextResponse.json({
      mensagem: historicoError
        ? `Pedestre liberado, mas o historico de acoes nao foi gravado: ${historicoError}`
        : 'Pedestre liberado com sucesso! A Portaria ja pode ver.',
    })
  }

  if (tipo === 'transferencia') {
    if (!podeOperar(operador, 'liberacao.transferencia')) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const placa = placaNormalizada(body.placa)
    const baseOrigem = texto(body.base_origem)
    const baseDestino = texto(body.base_destino)
    const transferidoEm = dataIso(body.transferido_em)
    const kmTransferencia = numero(body.km)

    if (!placa) return NextResponse.json({ error: 'Placa obrigatoria.' }, { status: 400 })
    if (!baseOrigem || !baseDestino) return NextResponse.json({ error: 'Origem e destino obrigatorios.' }, { status: 400 })
    if (baseOrigem === baseDestino) return NextResponse.json({ error: 'Origem e destino nao podem ser iguais.' }, { status: 400 })
    if (!kmTransferencia || kmTransferencia <= 0) return NextResponse.json({ error: 'Informe um KM maior que zero.' }, { status: 400 })
    if (!transferidoEm) return NextResponse.json({ error: 'Data invalida.' }, { status: 400 })

    const { data: veiculo, error: veiculoError } = await buscarVeiculoPorPlaca(supabase, placa)

    if (veiculoError) return NextResponse.json({ error: veiculoError.message }, { status: 400 })
    if (!veiculo) return NextResponse.json({ error: 'Veiculo nao encontrado na frota.' }, { status: 400 })

    const placaCadastro = veiculo.NR_PLACA || placa
    const motorista = texto(body.motorista)
    const bloqueioEmRota = await buscarBloqueioEmRota(supabase, placaCadastro, motorista)

    if (bloqueioEmRota.error) return NextResponse.json({ error: bloqueioEmRota.error }, { status: 400 })
    if (bloqueioEmRota.mensagem) return NextResponse.json({ error: bloqueioEmRota.mensagem }, { status: 400 })

    const { data: transferencia, error } = await supabase.from('transferencias').insert({
      placa: placaCadastro,
      base_origem: baseOrigem,
      base_destino: baseDestino,
      motorista,
      km: kmTransferencia,
      observacao: texto(body.observacao),
      status: 'aguardando_confirmacao',
      transferido_por: responsavelNome,
      transferido_em: transferidoEm,
    }).select('*').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const historicoError = await registrarHistoricoAcao({
      supabase,
      tipo_entidade: 'transferencia',
      entidade_id: transferencia.id,
      acao: 'liberacao',
      placa: transferencia.placa,
      data_acao: transferencia.transferido_em,
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,

      dados: {
        placa: transferencia.placa,
        base_origem: transferencia.base_origem,
        base_destino: transferencia.base_destino,
        motorista: transferencia.motorista,
        km: transferencia.km,
        observacao: transferencia.observacao,
        status_transferencia: transferencia.status,
      },
    })

    return NextResponse.json({
      mensagem: historicoError
        ? `Transferencia registrada, mas o historico de acoes nao foi gravado: ${historicoError}`
        : 'Transferencia registrada com sucesso!',
    })
  }

  if (tipo === 'veiculo' || tipo === 'veiculo_interno') {
    const tipoVeiculo = texto(body.tipo_veiculo)
    const placa = placaNormalizada(body.placa)
    const motorista = texto(body.motorista)
    const dataRegistro = dataIso(body.data)

    if (!placa) return NextResponse.json({ error: 'Placa obrigatoria.' }, { status: 400 })
    if (!motorista) return NextResponse.json({ error: 'Motorista obrigatorio.' }, { status: 400 })
    if (!dataRegistro) return NextResponse.json({ error: 'Data invalida.' }, { status: 400 })

    if (tipo === 'veiculo_interno') {
      if (!podeOperarVeiculoInterno(operador)) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
      }

      const movimento = texto(body.movimento)
      if (movimento !== 'entrada' && movimento !== 'saida') {
        return NextResponse.json({ error: 'Movimento invalido.' }, { status: 400 })
      }

      const { data: veiculoEmpresa, error: veiculoError } = await buscarVeiculoPorPlaca(supabase, placa)

      if (veiculoError) return NextResponse.json({ error: veiculoError.message }, { status: 400 })
      if (!veiculoEmpresa) return NextResponse.json({ error: 'Veiculo nao encontrado na frota.' }, { status: 400 })

      const placaCadastro = veiculoEmpresa.NR_PLACA || placa
      const bloqueioEmRota = await buscarBloqueioEmRota(supabase, placaCadastro, motorista)

      if (bloqueioEmRota.error) return NextResponse.json({ error: bloqueioEmRota.error }, { status: 400 })
      if (bloqueioEmRota.mensagem) return NextResponse.json({ error: bloqueioEmRota.mensagem }, { status: 400 })

      const tipoVeiculoMovimentacao = movimento === 'saida' ? 'interno_saida' : 'interno_entrada'
      const { data: movimentacao, error } = await supabase.from('movimentacoes').insert({
        placa: placaCadastro,
        km: null,
        motorista,
        localizacao: texto(body.origem),
        destino: null,
        status: 'finalizado',
        liberado_por: responsavelNome,
        liberado_em: dataRegistro,
        saida_em: movimento === 'saida' ? dataRegistro : null,
        entrada_em: movimento === 'entrada' ? dataRegistro : null,
        tipo_veiculo: tipoVeiculoMovimentacao,
      }).select('id').single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      const historicoError = await registrarHistoricoAcao({
        supabase,
        tipo_entidade: 'veiculo',
        entidade_id: movimentacao.id,
        acao: movimento,
        placa: placaCadastro,
        data_acao: dataRegistro,
        responsavel_nome: responsavelNome,
        responsavel_email: responsavelEmail,

        dados: {
          placa: placaCadastro,
          motorista,
          km: null,
          origem: texto(body.origem),
          destino: null,
          tipo_veiculo: tipoVeiculoMovimentacao,
          status_movimentacao: 'finalizado',
        },
      })

      return NextResponse.json({
        mensagem: historicoError
          ? `Veiculo interno registrado, mas o historico de acoes nao foi gravado: ${historicoError}`
          : `Veiculo interno registrado com sucesso como ${movimento} no historico do controle.`,
      })
    }

    if (tipoVeiculo !== 'interno' && tipoVeiculo !== 'externo') {
      return NextResponse.json({ error: 'Tipo de veiculo invalido.' }, { status: 400 })
    }

    if (!podeOperar(operador, tipoVeiculo === 'interno' ? 'liberacao.veiculo_empresa' : 'liberacao.veiculo_externo')) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    if (tipoVeiculo === 'externo' && placa.length !== 7) {
      return NextResponse.json({ error: 'A placa deve ter exatamente 7 caracteres.' }, { status: 400 })
    }

    const { data: veiculoEmpresa, error: veiculoError } = await buscarVeiculoPorPlaca(supabase, placa)

    if (veiculoError) return NextResponse.json({ error: veiculoError.message }, { status: 400 })
    if (tipoVeiculo === 'interno' && !veiculoEmpresa) {
      return NextResponse.json({ error: 'Veiculo nao encontrado na frota.' }, { status: 400 })
    }
    if (tipoVeiculo === 'externo' && veiculoEmpresa) {
      return NextResponse.json({ error: 'Essa placa pertence a um veiculo da empresa. Use Veiculo da Empresa ou Veiculo Interno.' }, { status: 400 })
    }

    const placaMovimentacao = tipoVeiculo === 'interno' ? veiculoEmpresa?.NR_PLACA || placa : placa

    const destino = texto(body.destino)
    if (!destino) return NextResponse.json({ error: 'Destino obrigatorio.' }, { status: 400 })

    if (tipoVeiculo === 'interno') {
      const bloqueioEmRota = await buscarBloqueioEmRota(supabase, placaMovimentacao, motorista)

      if (bloqueioEmRota.error) return NextResponse.json({ error: bloqueioEmRota.error }, { status: 400 })
      if (bloqueioEmRota.mensagem) return NextResponse.json({ error: bloqueioEmRota.mensagem }, { status: 400 })
    }

    let gestorResponsavel: GestorAutorizacao | null = null
    if (tipoVeiculo === 'externo') {
      const gestorResponsavelId = texto(body.gestor_responsavel_id)
      if (!gestorResponsavelId) {
        return NextResponse.json({ error: 'Gestor responsavel obrigatorio para veiculo externo.' }, { status: 400 })
      }

      const { data: gestor, error: gestorError } = await supabase
        .from('gestores_autorizacao')
        .select('id, nome, email, setor')
        .eq('id', gestorResponsavelId)
        .eq('ativo', true)
        .maybeSingle<GestorAutorizacao>()

      if (gestorError) return NextResponse.json({ error: gestorError.message }, { status: 400 })
      if (!gestor) {
        return NextResponse.json({ error: 'Gestor responsavel nao encontrado ou inativo.' }, { status: 400 })
      }

      gestorResponsavel = gestor
    }

    const kmAtual = tipoVeiculo === 'interno' ? numero(body.km) : null
    if (tipoVeiculo === 'interno') {
      if (!kmAtual || kmAtual <= 0) {
        return NextResponse.json({ error: 'Informe um KM maior que zero.' }, { status: 400 })
      }

      const ultimoKm = await buscarMaiorKmRegistrado(supabase, placaMovimentacao)

      if (ultimoKm.error) return NextResponse.json({ error: ultimoKm.error }, { status: 400 })
      if (ultimoKm.km !== null && kmAtual < ultimoKm.km) {
        return NextResponse.json({ error: `KM informado (${kmAtual}) menor que o ultimo registrado (${ultimoKm.km}).` }, { status: 400 })
      }
    }

    const { data: movimentacao, error } = await supabase.from('movimentacoes').insert({
      placa: placaMovimentacao,
      km: kmAtual,
      motorista,
      localizacao: texto(body.origem),
      destino,
      status: tipoVeiculo === 'externo' ? 'aguardando_entrada' : 'aguardando_saida',
      liberado_por: responsavelNome,
      liberado_em: dataRegistro,
      entrada_em: null,
      tipo_veiculo: tipoVeiculo,
      gestor_responsavel_id: gestorResponsavel?.id || null,
      gestor_responsavel_nome: gestorResponsavel?.nome || null,
      gestor_responsavel_email: gestorResponsavel?.email || null,
      gestor_responsavel_setor: gestorResponsavel?.setor || null,
      modelo_externo: tipoVeiculo === 'externo' ? texto(body.modelo_externo) : null,
      observacao: texto(body.observacao),
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const historicoError = await registrarHistoricoAcao({
      supabase,
      tipo_entidade: 'veiculo',
      entidade_id: movimentacao.id,
      acao: 'liberacao',
      placa: placaMovimentacao,
      data_acao: dataRegistro,
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,

      dados: {
        placa: placaMovimentacao,
        motorista,
        km: kmAtual,
        origem: texto(body.origem),
        destino,
        tipo_veiculo: tipoVeiculo,
        modelo_externo: tipoVeiculo === 'externo' ? texto(body.modelo_externo) : null,
        status_movimentacao: tipoVeiculo === 'externo' ? 'aguardando_entrada' : 'aguardando_saida',
        observacao: texto(body.observacao),
        gestor_responsavel_id: gestorResponsavel?.id || null,
        gestor_responsavel_nome: gestorResponsavel?.nome || null,
        gestor_responsavel_email: gestorResponsavel?.email || null,
        gestor_responsavel_setor: gestorResponsavel?.setor || null,
      },
    })

    return NextResponse.json({
      mensagem: historicoError
        ? `Veiculo liberado, mas o historico de acoes nao foi registrado: ${historicoError}`
        : 'Veiculo liberado com sucesso! A Portaria ja pode ver.',
    })
  }

  return NextResponse.json({ error: 'Tipo de liberacao invalido.' }, { status: 400 })
}
