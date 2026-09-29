import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { podeAcessar } from '@/lib/roles'

type AcaoTransferencia = 'liberacao' | 'confirmacao'

type Body = {
  transferencia_id?: unknown
  acao?: unknown
  data_acao?: unknown
  placa?: unknown
  base_origem?: unknown
  base_destino?: unknown
  motorista?: unknown
  observacao?: unknown
  status_transferencia?: unknown
}

function textoOuNull(valor: unknown) {
  if (typeof valor !== 'string') return null
  const texto = valor.trim()
  return texto || null
}

function numeroObrigatorio(valor: unknown) {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isInteger(numero) ? numero : null
}

function dataObrigatoria(valor: unknown) {
  if (typeof valor !== 'string') return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

function acaoObrigatoria(valor: unknown): AcaoTransferencia | null {
  return valor === 'liberacao' || valor === 'confirmacao' ? valor : null
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const temPermissao =
    podeAcessar(operador, 'liberacao') ||
    podeAcessar(operador, 'liberacao.transferencia') ||
    podeAcessar(operador, 'portaria') ||
    podeAcessar(operador, 'portaria.transferencia') ||
    podeAcessar(operador, 'transferencia')

  if (!temPermissao) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = (await request.json()) as Body
  const transferenciaId = numeroObrigatorio(body.transferencia_id)
  const acao = acaoObrigatoria(body.acao)
  const dataAcao = dataObrigatoria(body.data_acao)
  const placa = textoOuNull(body.placa)
  const baseOrigem = textoOuNull(body.base_origem)
  const baseDestino = textoOuNull(body.base_destino)
  const statusTransferencia = textoOuNull(body.status_transferencia)

  if (!transferenciaId) {
    return NextResponse.json({ error: 'Transferencia obrigatoria.' }, { status: 400 })
  }

  if (!acao) {
    return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
  }

  if (!dataAcao) {
    return NextResponse.json({ error: 'Data da acao obrigatoria.' }, { status: 400 })
  }

  if (!placa) {
    return NextResponse.json({ error: 'Placa obrigatoria.' }, { status: 400 })
  }

  if (!baseOrigem || !baseDestino) {
    return NextResponse.json({ error: 'Base origem e base destino obrigatorias.' }, { status: 400 })
  }

  if (!statusTransferencia) {
    return NextResponse.json({ error: 'Status da transferencia obrigatorio.' }, { status: 400 })
  }

  const responsavelNome =
    operador.fullName ||
    operador.username ||
    operador.primaryEmailAddress?.emailAddress ||
    'Usuario nao identificado'

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('movimentacoes_transferencias_acoes')
    .insert({
      transferencia_id: transferenciaId,
      acao,
      data_acao: dataAcao,
      placa,
      base_origem: baseOrigem,
      base_destino: baseDestino,
      motorista: textoOuNull(body.motorista),
      observacao: textoOuNull(body.observacao),
      status_transferencia: statusTransferencia,
      responsavel_nome: responsavelNome,
      responsavel_email: operador.primaryEmailAddress?.emailAddress || null,
      responsavel_id: operador.id,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ acao: data })
}
