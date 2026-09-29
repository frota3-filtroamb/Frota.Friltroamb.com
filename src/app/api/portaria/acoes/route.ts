import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { podeAcessar } from '@/lib/roles'

type Body = {
  tipo?: unknown
  id?: unknown
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
  base_origem: string
  base_destino: string
  motorista: string | null
  observacao: string | null
}

function numeroObrigatorio(valor: unknown) {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isInteger(numero) ? numero : null
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
  const responsavelId = operador.id
  const agora = new Date().toISOString()

  if (tipo === 'veiculo_saida') {
    if (!podeOperarVeiculos(operador)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

    const { data: movimentacao, error: buscaError } = await supabase
      .from('movimentacoes')
      .select('*')
      .eq('id', id)
      .single<Movimentacao>()

    if (buscaError) return NextResponse.json({ error: buscaError.message }, { status: 400 })

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

    const { error: acaoError } = await supabase.from('movimentacoes_acoes').insert({
      movimentacao_id: movimentacao.id,
      acao: 'saida',
      data_acao: dadosSaida.saida_em,
      placa: movimentacao.placa,
      motorista: movimentacao.motorista,
      km: movimentacao.km,
      origem: movimentacao.localizacao,
      destino: movimentacao.destino,
      tipo_veiculo: movimentacao.tipo_veiculo || null,
      status_movimentacao: dadosSaida.status,
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,
      responsavel_id: responsavelId,
    })

    return NextResponse.json({
      mensagem: acaoError
        ? `Saida registrada, mas o historico de acoes nao foi gravado: ${acaoError.message}`
        : deveFinalizarNaSaida ? 'Saida do veiculo externo registrada e finalizada!' : 'Saida do veiculo registrada!',
    })
  }

  if (tipo === 'veiculo_entrada') {
    if (!podeOperarVeiculos(operador)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

    const { data: movimentacao, error: buscaError } = await supabase
      .from('movimentacoes')
      .select('*')
      .eq('id', id)
      .single<Movimentacao>()

    if (buscaError) return NextResponse.json({ error: buscaError.message }, { status: 400 })

    if (isVeiculoExterno(movimentacao.tipo_veiculo) || (Boolean(movimentacao.entrada_em) && !isVeiculoInterno(movimentacao.tipo_veiculo))) {
      return NextResponse.json({ error: 'Este veiculo ja possui entrada registrada. Registre a saida.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('movimentacoes')
      .update({ status: 'finalizado', entrada_em: agora })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    const { error: acaoError } = await supabase.from('movimentacoes_acoes').insert({
      movimentacao_id: movimentacao.id,
      acao: 'entrada',
      data_acao: agora,
      placa: movimentacao.placa,
      motorista: movimentacao.motorista,
      km: movimentacao.km,
      origem: movimentacao.localizacao,
      destino: movimentacao.destino,
      tipo_veiculo: movimentacao.tipo_veiculo || null,
      status_movimentacao: 'finalizado',
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,
      responsavel_id: responsavelId,
    })

    return NextResponse.json({
      mensagem: acaoError
        ? `Entrada registrada, mas o historico de acoes nao foi gravado: ${acaoError.message}`
        : 'Entrada do veiculo registrada!',
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

    const { error: acaoError } = await supabase.from('movimentacoes_pedestres_acoes').insert({
      movimentacao_pedestre_id: pedestre.id,
      acao: entrada ? 'entrada' : 'saida',
      data_acao: agora,
      nome: pedestre.nome,
      cpf_rg: pedestre.cpf_rg,
      telefone: pedestre.telefone,
      empresa: pedestre.empresa,
      destino: pedestre.destino,
      status_movimentacao: entrada ? 'em_visita' : 'finalizado',
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,
      responsavel_id: responsavelId,
    })

    return NextResponse.json({
      mensagem: acaoError
        ? `${entrada ? 'Entrada' : 'Saida'} registrada, mas o historico de acoes nao foi gravado: ${acaoError.message}`
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

    const { error: acaoError } = await supabase.from('movimentacoes_transferencias_acoes').insert({
      transferencia_id: transferencia.id,
      acao: 'confirmacao',
      data_acao: agora,
      placa: transferencia.placa,
      base_origem: transferencia.base_origem,
      base_destino: transferencia.base_destino,
      motorista: transferencia.motorista,
      observacao: transferencia.observacao,
      status_transferencia: 'concluida',
      responsavel_nome: responsavelNome,
      responsavel_email: responsavelEmail,
      responsavel_id: responsavelId,
    })

    return NextResponse.json({
      mensagem: acaoError
        ? `Transferencia confirmada, mas o historico de acoes nao foi gravado: ${acaoError.message}`
        : 'Transferencia confirmada e finalizada!',
    })
  }

  return NextResponse.json({ error: 'Tipo de acao invalido.' }, { status: 400 })
}
