import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Body = {
  placa?: unknown
  motorista?: unknown
  km?: unknown
  origem?: unknown
  destino?: unknown
  data_acao?: unknown
  tipo_veiculo?: unknown
  status_movimentacao?: unknown
  motivo_correcao?: unknown
  motivo_exclusao?: unknown
}

type AcaoMovimentacao = {
  id: number
  movimentacao_id: number | null
  acao: 'liberacao' | 'saida' | 'entrada' | 'correcao'
  data_acao: string
  placa: string | null
  motorista: string | null
  km: number | null
  origem: string | null
  destino: string | null
  tipo_veiculo: string | null
  status_movimentacao: string | null
  responsavel_nome: string | null
  responsavel_email: string | null
  responsavel_id: string | null
  corrige_acao_id: number | null
  corrigido_por_id: string | null
  corrigido_por_nome: string | null
  corrigido_por_email: string | null
  corrigido_em: string | null
  motivo_correcao: string | null
}

function podeEditar(role: unknown) {
  return role === 'dev' || role === 'editor'
}

function textoOuNull(valor: unknown) {
  if (typeof valor !== 'string') return null
  const texto = valor.trim()
  return texto || null
}

function numeroOuNull(valor: unknown) {
  if (valor === null || valor === '') return null
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(numero) ? numero : null
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
  const dataAcao = dataObrigatoria(body.data_acao)
  const motivoCorrecao = textoOuNull(body.motivo_correcao)

  if (!placa) {
    return NextResponse.json({ error: 'Placa obrigatoria.' }, { status: 400 })
  }

  if (!dataAcao) {
    return NextResponse.json({ error: 'Data da acao obrigatoria.' }, { status: 400 })
  }

  if (!motivoCorrecao || motivoCorrecao.length < 12) {
    return NextResponse.json({ error: 'Motivo da correcao obrigatorio com pelo menos 12 caracteres.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: acaoAtual, error: buscaError } = await supabase
    .from('movimentacoes_acoes')
    .select('*')
    .eq('id', acaoId)
    .single<AcaoMovimentacao>()

  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 400 })
  }

  const acaoOriginalId = acaoAtual.acao === 'correcao'
    ? acaoAtual.corrige_acao_id
    : acaoAtual.id

  if (!acaoOriginalId) {
    return NextResponse.json({ error: 'Acao original nao encontrada.' }, { status: 400 })
  }

  const { data: ultimaCorrecao, error: correcaoError } = await supabase
    .from('movimentacoes_acoes')
    .select('*')
    .eq('acao', 'correcao')
    .eq('corrige_acao_id', acaoOriginalId)
    .order('corrigido_em', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<AcaoMovimentacao>()

  if (correcaoError) {
    return NextResponse.json({ error: correcaoError.message }, { status: 400 })
  }

  const dadosProtegidos = ultimaCorrecao || acaoAtual

  const { data, error } = await supabase
    .from('movimentacoes_acoes')
    .insert({
      movimentacao_id: acaoAtual.movimentacao_id,
      acao: 'correcao',
      data_acao: dataAcao,
      placa,
      motorista: textoOuNull(body.motorista),
      km: numeroOuNull(body.km),
      origem: dadosProtegidos.origem,
      destino: textoOuNull(body.destino),
      tipo_veiculo: dadosProtegidos.tipo_veiculo,
      status_movimentacao: dadosProtegidos.status_movimentacao,
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

export async function DELETE(
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
  const motivoExclusao = textoOuNull(body.motivo_exclusao)

  if (!motivoExclusao || motivoExclusao.length < 12) {
    return NextResponse.json({ error: 'Motivo da exclusao obrigatorio com pelo menos 12 caracteres.' }, { status: 400 })
  }

  let supabase

  try {
    supabase = createAdminClient()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao configurar acesso administrativo.' },
      { status: 500 },
    )
  }

  const { data: acaoAtual, error: buscaError } = await supabase
    .from('movimentacoes_acoes')
    .select('*')
    .eq('id', acaoId)
    .single<AcaoMovimentacao>()

  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 400 })
  }

  const acaoOriginalId = acaoAtual.acao === 'correcao'
    ? acaoAtual.corrige_acao_id
    : acaoAtual.id

  if (!acaoOriginalId) {
    return NextResponse.json({ error: 'Acao original nao encontrada.' }, { status: 400 })
  }

  const { data: historico, error: historicoError } = await supabase
    .from('movimentacoes_acoes')
    .select('*')
    .or(`id.eq.${acaoOriginalId},corrige_acao_id.eq.${acaoOriginalId}`)
    .order('id', { ascending: true })
    .returns<AcaoMovimentacao[]>()

  if (historicoError) {
    return NextResponse.json({ error: historicoError.message }, { status: 400 })
  }

  const registros = historico || []
  const registroOriginal = registros.find((registro) => registro.id === acaoOriginalId)

  if (!registroOriginal) {
    return NextResponse.json({ error: 'Registro original nao encontrado.' }, { status: 400 })
  }

  const registroVigente = registros
    .filter((registro) => registro.acao === 'correcao')
    .sort((a, b) => {
      const dataA = new Date(a.corrigido_em || a.data_acao).getTime()
      const dataB = new Date(b.corrigido_em || b.data_acao).getTime()
      if (dataA !== dataB) return dataB - dataA
      return b.id - a.id
    })[0] || registroOriginal

  const { error: arquivoError } = await supabase
    .from('movimentacoes_acoes_excluidas')
    .insert({
      acao_original_id: acaoOriginalId,
      movimentacao_id: registroVigente.movimentacao_id,
      acao: registroOriginal.acao,
      data_acao: registroVigente.data_acao,
      placa: registroVigente.placa,
      motorista: registroVigente.motorista,
      km: registroVigente.km,
      origem: registroVigente.origem,
      destino: registroVigente.destino,
      tipo_veiculo: registroVigente.tipo_veiculo,
      status_movimentacao: registroVigente.status_movimentacao,
      responsavel_nome: registroVigente.responsavel_nome,
      responsavel_email: registroVigente.responsavel_email,
      responsavel_id: registroVigente.responsavel_id,
      registro_original: registroOriginal,
      registro_vigente: registroVigente,
      historico: registros,
      motivo_exclusao: motivoExclusao,
      excluido_por_id: operador.id,
      excluido_por_nome: operador.fullName || operador.primaryEmailAddress?.emailAddress || 'Usuario',
      excluido_por_email: operador.primaryEmailAddress?.emailAddress || null,
    })

  if (arquivoError) {
    return NextResponse.json({ error: arquivoError.message }, { status: 400 })
  }

  const correcoesIds = registros
    .filter((registro) => registro.acao === 'correcao')
    .map((registro) => registro.id)

  if (correcoesIds.length > 0) {
    const { error: deleteCorrecoesError } = await supabase
      .from('movimentacoes_acoes')
      .delete()
      .in('id', correcoesIds)

    if (deleteCorrecoesError) {
      return NextResponse.json({ error: deleteCorrecoesError.message }, { status: 400 })
    }
  }

  const { error: deleteOriginalError } = await supabase
    .from('movimentacoes_acoes')
    .delete()
    .eq('id', acaoOriginalId)

  if (deleteOriginalError) {
    return NextResponse.json({ error: deleteOriginalError.message }, { status: 400 })
  }

  return NextResponse.json({ excluido: true })
}
