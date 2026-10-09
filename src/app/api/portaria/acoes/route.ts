import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarHistoricoAcao } from '@/lib/historico-acoes'
import { getRole, podeAcessar } from '@/lib/roles'

type Body = {
  tipo?: unknown
  id?: unknown
  porteiro_id?: unknown
}

type Movimentacao = {
  id: number
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
  gestor_responsavel_email: string | null
}

type Pedestre = {
  id: number
  nome: string
  cpf_rg: string | null
  telefone: string | null
  empresa: string | null
  destino: string | null
  status: string
}

type Transferencia = {
  id: number
  placa: string
  km: number | null
  base_origem: string
  base_destino: string
  motorista: string | null
  observacao: string | null
}

type Porteiro = {
  id: number
  nome: string
}

function numeroObrigatorio(valor: unknown) {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isInteger(numero) ? numero : null
}

async function buscarPorteiro(
  supabase: ReturnType<typeof createAdminClient>,
  valor: unknown,
) {
  const porteiroId = numeroObrigatorio(valor)

  if (!porteiroId) {
    return { data: null, error: 'Selecione o porteiro responsavel pela acao.' }
  }

  const { data, error } = await supabase
    .from('TBL_CADASTROS')
    .select('id, nome')
    .eq('id', porteiroId)
    .ilike('funcao', 'porteiro')
    .eq('ativo', true)
    .maybeSingle<Porteiro>()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'Porteiro nao encontrado ou inativo.' }

  return { data, error: null }
}

function nomeResponsavel(operador: Awaited<ReturnType<typeof currentUser>>) {
  return operador?.fullName ||
    operador?.username ||
    operador?.primaryEmailAddress?.emailAddress ||
    'Usuario nao identificado'
}

function isVeiculoInterno(tipo: string | null | undefined) {
  const tipoNormalizado = (tipo || '').toLowerCase().trim()
  return tipoNormalizado === 'interno' || tipoNormalizado === 'interno_entrada' || tipoNormalizado === 'interno_saida'
}

function isVeiculoExterno(tipo: string | null | undefined) {
  const tipoNormalizado = (tipo || '').toLowerCase().trim()
  return tipoNormalizado === 'externo' || tipoNormalizado === 'veiculo_externo'
}

function podeOperarVeiculos(operador: Awaited<ReturnType<typeof currentUser>>) {
  return Boolean(
    operador &&
    (podeAcessar(operador, 'portaria') || podeAcessar(operador, 'portaria.veiculos'))
  )
}

function podeAutorizarSaida(operador: Awaited<ReturnType<typeof currentUser>>) {
  const role = getRole(operador)
  return role === 'dev' || role === 'editor' || role === 'gestor'
}

function podeOperarPedestres(operador: Awaited<ReturnType<typeof currentUser>>) {
  return Boolean(
    operador &&
    (podeAcessar(operador, 'portaria') || podeAcessar(operador, 'portaria.pedestres'))
  )
}

function podeOperarTransferencias(operador: Awaited<ReturnType<typeof currentUser>>) {
  return Boolean(
    operador &&
    (podeAcessar(operador, 'portaria') || podeAcessar(operador, 'portaria.transferencia'))
  )
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const body = (await request.json()) as Body
  const tipo = typeof body.tipo === 'string' ? body.tipo : ''
  const id = numeroObrigatorio(body.id)

  if (!id) {
    return NextResponse.json({ error: 'ID obrigatorio.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const responsavelNome = nomeResponsavel(operador)
  const responsavelEmail = operador.primaryEmailAddress?.emailAddress || null
  const agora = new Date().toISOString()
  const exigePorteiro = [
    'veiculo_saida',
    'veiculo_entrada',
    'pedestre_entrada',
    'pedestre_saida',
    'transferencia_confirmar',
  ].includes(tipo)
  const porteiro = exigePorteiro ? await buscarPorteiro(supabase, body.porteiro_id) : { data: null, error: null }

  if (porteiro.error) {
    return NextResponse.json({ error: porteiro.error }, { status: 400 })
  }

  if (tipo === 'veiculo_saida') {
    if (!podeOperarVeiculos(operador)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

    const { data: movimentacao, error: buscaError } = await supabase
      .from('movimentacoes')
      .select('*')
      .eq('id', id)
      .single<Movimentacao>()

    if (buscaError) return NextResponse.json({ error: buscaError.message }, { status: 400 })

    if (isVeiculoExterno(movimentacao.tipo_veiculo)) {
      if (!movimentacao.entrada_em) {
        return NextResponse.json({ error: 'Registre a entrada do veiculo externo antes da saida.' }, { status: 400 })
      }

      const { data: autorizacaoExistente, error: autorizacaoError } = await supabase
        .from('TBL_HISTORICOS_ACOES')
        .select('id')
        .eq('tipo_entidade', 'veiculo')
        .eq('entidade_id', movimentacao.id)
        .eq('acao', 'saida_autorizada')
        .maybeSingle()

      if (autorizacaoError) return NextResponse.json({ error: autorizacaoError.message }, { status: 400 })
      if (!autorizacaoExistente) {
        return NextResponse.json({ error: 'A saida do veiculo externo ainda nao foi autorizada pelo gestor.' }, { status: 403 })
      }
    }

    const deveFinalizarNaSaida = isVeiculoExterno(movimentacao.tipo_veiculo) || (
      Boolean(movimentacao.entrada_em) && !isVeiculoInterno(movimentacao.tipo_veiculo)
    )
    const dadosSaida = deveFinalizarNaSaida
      ? {
        status: 'finalizado',
        saida_em: movimentacao.saida_em || agora,
        entrada_em: movimentacao.entrada_em || movimentacao.liberado_em || agora,
      }
      : { status: 'em_rota', saida_em: agora }

    const { error: updateError } = await supabase
      .from('movimentacoes')
      .update(dadosSaida)
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    const historicoError = await registrarHistoricoAcao({
      supabase,
      tipo_entidade: 'veiculo',
      entidade_id: movimentacao.id,
      acao: 'saida',
      placa: movimentacao.placa,
      data_acao: dadosSaida.saida_em,
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,

      porteiro_id: porteiro.data?.id || null,
      porteiro_nome: porteiro.data?.nome || null,
      dados: {
        placa: movimentacao.placa,
        motorista: movimentacao.motorista,
        km: movimentacao.km,
        origem: movimentacao.localizacao,
        destino: movimentacao.destino,
        tipo_veiculo: movimentacao.tipo_veiculo || null,
        status_movimentacao: dadosSaida.status,
      },
    })

    return NextResponse.json({
      mensagem: historicoError
        ? `Saida registrada, mas o historico de acoes nao foi gravado: ${historicoError}`
        : deveFinalizarNaSaida ? 'Saida do veiculo externo registrada e finalizada!' : 'Saida do veiculo registrada!',
    })
  }

  if (tipo === 'veiculo_autorizar_saida') {
    if (!podeOperarVeiculos(operador) || !podeAutorizarSaida(operador)) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const { data: movimentacao, error: buscaError } = await supabase
      .from('movimentacoes')
      .select('*')
      .eq('id', id)
      .single<Movimentacao>()

    if (buscaError) return NextResponse.json({ error: buscaError.message }, { status: 400 })

    if (!isVeiculoExterno(movimentacao.tipo_veiculo)) {
      return NextResponse.json({ error: 'A autorizacao de saida e exclusiva para veiculo externo.' }, { status: 400 })
    }

    if (movimentacao.saida_em) {
      return NextResponse.json({ error: 'Este veiculo externo ja possui saida registrada.' }, { status: 400 })
    }

    if (!movimentacao.entrada_em) {
      return NextResponse.json({ error: 'Registre a entrada do veiculo externo antes de autorizar a saida.' }, { status: 400 })
    }

    const role = getRole(operador)
    const emailOperador = responsavelEmail?.toLowerCase() || ''
    if (
      role === 'gestor' &&
      (!emailOperador || movimentacao.gestor_responsavel_email?.toLowerCase() !== emailOperador)
    ) {
      return NextResponse.json({ error: 'Esta liberacao esta atribuida a outro gestor.' }, { status: 403 })
    }

    const { data: autorizacaoExistente, error: autorizacaoError } = await supabase
      .from('TBL_HISTORICOS_ACOES')
      .select('id')
      .eq('tipo_entidade', 'veiculo')
      .eq('entidade_id', movimentacao.id)
      .eq('acao', 'saida_autorizada')
      .maybeSingle()

    if (autorizacaoError) return NextResponse.json({ error: autorizacaoError.message }, { status: 400 })

    if (!autorizacaoExistente) {
      const historicoError = await registrarHistoricoAcao({
        supabase,
        tipo_entidade: 'veiculo',
        entidade_id: movimentacao.id,
        acao: 'saida_autorizada',
        placa: movimentacao.placa,
        data_acao: agora,
        responsavel_nome: responsavelNome,
        responsavel_email: responsavelEmail,

        dados: {
          placa: movimentacao.placa,
          motorista: movimentacao.motorista,
          km: movimentacao.km,
          origem: movimentacao.localizacao,
          destino: movimentacao.destino,
          tipo_veiculo: movimentacao.tipo_veiculo || null,
          status_movimentacao: movimentacao.status,
        },
      })

      if (historicoError) return NextResponse.json({ error: historicoError }, { status: 400 })
    }

    const { error: statusError } = await supabase
      .from('movimentacoes')
      .update({ status: 'saida_autorizada' })
      .eq('id', movimentacao.id)

    if (statusError) return NextResponse.json({ error: statusError.message }, { status: 400 })

    return NextResponse.json({ mensagem: 'Saida do veiculo externo autorizada para a portaria.' })
  }

  if (tipo === 'veiculo_entrada') {
    if (!podeOperarVeiculos(operador)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

    const { data: movimentacao, error: buscaError } = await supabase
      .from('movimentacoes')
      .select('*')
      .eq('id', id)
      .single<Movimentacao>()

    if (buscaError) return NextResponse.json({ error: buscaError.message }, { status: 400 })

    if (Boolean(movimentacao.entrada_em) && (isVeiculoExterno(movimentacao.tipo_veiculo) || !isVeiculoInterno(movimentacao.tipo_veiculo))) {
      return NextResponse.json({ error: 'Este veiculo ja possui entrada registrada. Registre a saida.' }, { status: 400 })
    }

    const statusEntrada = isVeiculoExterno(movimentacao.tipo_veiculo) ? 'aguardando_saida' : 'finalizado'

    const { error: updateError } = await supabase
      .from('movimentacoes')
      .update({ status: statusEntrada, entrada_em: agora })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    const historicoError = await registrarHistoricoAcao({
      supabase,
      tipo_entidade: 'veiculo',
      entidade_id: movimentacao.id,
      acao: 'entrada',
      placa: movimentacao.placa,
      data_acao: agora,
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,

      porteiro_id: porteiro.data?.id || null,
      porteiro_nome: porteiro.data?.nome || null,
      dados: {
        placa: movimentacao.placa,
        motorista: movimentacao.motorista,
        km: movimentacao.km,
        origem: movimentacao.localizacao,
        destino: movimentacao.destino,
        tipo_veiculo: movimentacao.tipo_veiculo || null,
        status_movimentacao: statusEntrada,
      },
    })

    return NextResponse.json({
      mensagem: historicoError
        ? `Entrada registrada, mas o historico de acoes nao foi gravado: ${historicoError}`
        : isVeiculoExterno(movimentacao.tipo_veiculo) ? 'Entrada do veiculo externo registrada! Aguardando autorizacao do gestor.' : 'Entrada do veiculo registrada!',
    })
  }

  if (tipo === 'pedestre_entrada' || tipo === 'pedestre_saida') {
    if (!podeOperarPedestres(operador)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

    const { data: pedestre, error: buscaError } = await supabase
      .from('movimentacoes_pedestres')
      .select('*')
      .eq('id', id)
      .single<Pedestre>()

    if (buscaError) return NextResponse.json({ error: buscaError.message }, { status: 400 })

    const entrada = tipo === 'pedestre_entrada'
    const update = entrada
      ? { status: 'em_visita', entrada_em: agora }
      : { status: 'finalizado', saida_em: agora }

    const { error: updateError } = await supabase
      .from('movimentacoes_pedestres')
      .update(update)
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    const historicoError = await registrarHistoricoAcao({
      supabase,
      tipo_entidade: 'pedestre',
      entidade_id: pedestre.id,
      acao: entrada ? 'entrada' : 'saida',
      data_acao: agora,
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,

      porteiro_id: porteiro.data?.id || null,
      porteiro_nome: porteiro.data?.nome || null,
      dados: {
        nome: pedestre.nome,
        cpf_rg: pedestre.cpf_rg,
        telefone: pedestre.telefone,
        empresa: pedestre.empresa,
        destino: pedestre.destino,
        status_movimentacao: entrada ? 'em_visita' : 'finalizado',
      },
    })

    return NextResponse.json({
      mensagem: historicoError
        ? `${entrada ? 'Entrada' : 'Saida'} registrada, mas o historico de acoes nao foi gravado: ${historicoError}`
        : entrada ? 'Entrada de pedestre registrada!' : 'Saida de pedestre registrada!',
    })
  }

  if (tipo === 'transferencia_confirmar') {
    if (!podeOperarTransferencias(operador)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

    const { data: transferencia, error: buscaError } = await supabase
      .from('transferencias')
      .select('*')
      .eq('id', id)
      .single<Transferencia>()

    if (buscaError) return NextResponse.json({ error: buscaError.message }, { status: 400 })

    const { error: updateError } = await supabase
      .from('transferencias')
      .update({ status: 'concluida' })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    const historicoError = await registrarHistoricoAcao({
      supabase,
      tipo_entidade: 'transferencia',
      entidade_id: transferencia.id,
      acao: 'confirmacao',
      placa: transferencia.placa,
      data_acao: agora,
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,

      porteiro_id: porteiro.data?.id || null,
      porteiro_nome: porteiro.data?.nome || null,
      dados: {
        placa: transferencia.placa,
        base_origem: transferencia.base_origem,
        base_destino: transferencia.base_destino,
        motorista: transferencia.motorista,
        km: transferencia.km,
        observacao: transferencia.observacao,
        status_transferencia: 'concluida',
      },
    })

    return NextResponse.json({
      mensagem: historicoError
        ? `Transferencia confirmada, mas o historico de acoes nao foi gravado: ${historicoError}`
        : 'Transferencia confirmada e finalizada!',
    })
  }

  return NextResponse.json({ error: 'Tipo de acao invalido.' }, { status: 400 })
}
