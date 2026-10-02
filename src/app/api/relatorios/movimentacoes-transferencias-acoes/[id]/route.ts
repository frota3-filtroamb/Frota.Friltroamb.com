import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Body = {
  placa?: unknown
  base_origem?: unknown
  base_destino?: unknown
  motorista?: unknown
  observacao?: unknown
  data_acao?: unknown
  status_transferencia?: unknown
  motivo_correcao?: unknown
}

type AcaoTransferencia = {
  id: number
  transferencia_id: number | null
  acao: 'liberacao' | 'confirmacao' | 'correcao'
  data_acao: string
  placa: string | null
  base_origem: string | null
  base_destino: string | null
  motorista: string | null
  observacao: string | null
  status_transferencia: string | null
  corrige_acao_id: number | null
}

function podeEditar(role: unknown) {
  return role === 'dev' || role === 'editor'
}

function textoOuNull(valor: unknown) {
  if (typeof valor !== 'string') return null
  const texto = valor.trim()
  return texto || null
}

function dataObrigatoria(valor: unknown) {
  if (typeof valor !== 'string') return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const operador = await currentUser()

  if (!operador || !podeEditar(operador.publicMetadata?.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const { id } = await params
  const acaoId = Number(id)

  if (!Number.isInteger(acaoId)) {
    return NextResponse.json({ error: 'ID invalido.' }, { status: 400 })
  }

  const body = (await request.json()) as Body
  const placa = textoOuNull(body.placa)
  const baseOrigem = textoOuNull(body.base_origem)
  const baseDestino = textoOuNull(body.base_destino)
  const dataAcao = dataObrigatoria(body.data_acao)
  const motivoCorrecao = textoOuNull(body.motivo_correcao)

  if (!placa) {
    return NextResponse.json({ error: 'Placa obrigatoria.' }, { status: 400 })
  }

  if (!baseOrigem || !baseDestino) {
    return NextResponse.json({ error: 'Origem e destino sao obrigatorios.' }, { status: 400 })
  }

  if (!dataAcao) {
    return NextResponse.json({ error: 'Data da acao obrigatoria.' }, { status: 400 })
  }

  if (!motivoCorrecao || motivoCorrecao.length < 12) {
    return NextResponse.json({ error: 'Motivo da correcao obrigatorio com pelo menos 12 caracteres.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: acaoAtual, error: buscaError } = await supabase
    .from('movimentacoes_transferencias_acoes')
    .select('*')
    .eq('id', acaoId)
    .single<AcaoTransferencia>()

  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 400 })
  }

  const acaoOriginalId = acaoAtual.acao === 'correcao'
    ? acaoAtual.corrige_acao_id
    : acaoAtual.id

  if (!acaoOriginalId) {
    return NextResponse.json({ error: 'Acao original nao encontrada.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('movimentacoes_transferencias_acoes')
    .insert({
      transferencia_id: acaoAtual.transferencia_id,
      acao: 'correcao',
      data_acao: dataAcao,
      placa,
      base_origem: baseOrigem,
      base_destino: baseDestino,
      motorista: textoOuNull(body.motorista),
      observacao: textoOuNull(body.observacao),
      status_transferencia: textoOuNull(body.status_transferencia),
      corrige_acao_id: acaoOriginalId,
      corrigido_por_id: operador.id,
      corrigido_por_nome: operador.fullName || operador.primaryEmailAddress?.emailAddress || 'Usuario',
      corrigido_por_email: operador.primaryEmailAddress?.emailAddress || null,
      responsavel_nome: operador.fullName || operador.primaryEmailAddress?.emailAddress || 'Usuario',
      responsavel_email: operador.primaryEmailAddress?.emailAddress || null,
      responsavel_id: operador.id,
      corrigido_em: new Date().toISOString(),
      motivo_correcao: motivoCorrecao,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ acao: data })
}
