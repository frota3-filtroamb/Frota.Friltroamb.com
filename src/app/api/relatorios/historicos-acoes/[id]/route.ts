import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Body = {
  nome?: unknown
  cpf_rg?: unknown
  telefone?: unknown
  empresa?: unknown
  placa?: unknown
  base_origem?: unknown
  base_destino?: unknown
  motorista?: unknown
  km?: unknown
  destino?: unknown
  observacao?: unknown
  status_transferencia?: unknown
  data_acao?: unknown
  motivo_correcao?: unknown
  motivo_exclusao?: unknown
}

type HistoricoAcao = {
  id: number
  tipo_entidade: string
  entidade_id: number | null
  acao: string
  placa: string | null
  data_acao: string
  responsavel_nome: string | null
  responsavel_email: string | null
  porteiro_id: number | null
  porteiro_nome: string | null
  motivo: string | null
  dados: Record<string, unknown> | null
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

function numeroDoJson(valor: unknown) {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isInteger(numero) ? numero : null
}

function dados(registro: HistoricoAcao) {
  return registro.dados || {}
}

function acaoOriginalId(registro: HistoricoAcao) {
  if (registro.acao !== 'correcao') return registro.id
  return numeroDoJson(dados(registro).corrige_acao_id)
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
  const historicoId = Number(id)

  if (!Number.isInteger(historicoId)) {
    return NextResponse.json({ error: 'ID invalido.' }, { status: 400 })
  }

  const body = (await request.json()) as Body
  const placa = textoOuNull(body.placa)
  const nome = textoOuNull(body.nome)
  const dataAcao = dataObrigatoria(body.data_acao)
  const motivoCorrecao = textoOuNull(body.motivo_correcao)

  if (!dataAcao) {
    return NextResponse.json({ error: 'Data da acao obrigatoria.' }, { status: 400 })
  }

  if (!motivoCorrecao || motivoCorrecao.length < 12) {
    return NextResponse.json({ error: 'Motivo da correcao obrigatorio com pelo menos 12 caracteres.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: registroAtual, error: buscaError } = await supabase
    .from('TBL_HISTORICOS_ACOES')
    .select('*')
    .eq('id', historicoId)
    .single<HistoricoAcao>()

  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 400 })
  }

  if (registroAtual.tipo_entidade !== 'veiculo' && registroAtual.tipo_entidade !== 'pedestre' && registroAtual.tipo_entidade !== 'transferencia') {
    return NextResponse.json({ error: 'Tipo de historico nao suportado por esta rota.' }, { status: 400 })
  }

  if ((registroAtual.tipo_entidade === 'veiculo' || registroAtual.tipo_entidade === 'transferencia') && !placa) {
    return NextResponse.json({ error: 'Placa obrigatoria.' }, { status: 400 })
  }

  if (registroAtual.tipo_entidade === 'pedestre' && !nome) {
    return NextResponse.json({ error: 'Nome obrigatorio.' }, { status: 400 })
  }

  if (
    registroAtual.tipo_entidade === 'transferencia' &&
    (!textoOuNull(body.base_origem) || !textoOuNull(body.base_destino))
  ) {
    return NextResponse.json({ error: 'Origem e destino sao obrigatorios.' }, { status: 400 })
  }

  const originalId = acaoOriginalId(registroAtual)

  if (!originalId) {
    return NextResponse.json({ error: 'Acao original nao encontrada.' }, { status: 400 })
  }

  const { data: registrosEntidade, error: registrosError } = await supabase
    .from('TBL_HISTORICOS_ACOES')
    .select('*')
    .eq('tipo_entidade', registroAtual.tipo_entidade)
    .eq('entidade_id', registroAtual.entidade_id)
    .returns<HistoricoAcao[]>()

  if (registrosError) {
    return NextResponse.json({ error: registrosError.message }, { status: 400 })
  }

  const ultimaCorrecao = (registrosEntidade || [])
    .filter((registro) => registro.acao === 'correcao' && numeroDoJson(dados(registro).corrige_acao_id) === originalId)
    .sort((a, b) => {
      const dataA = new Date(String(dados(a).corrigido_em || a.data_acao)).getTime()
      const dataB = new Date(String(dados(b).corrigido_em || b.data_acao)).getTime()
      if (dataA !== dataB) return dataB - dataA
      return b.id - a.id
    })[0] || null

  const protegidos = dados(ultimaCorrecao || registroAtual)
  const corrigidoEm = new Date().toISOString()
  const corrigidoPorNome = operador.fullName || operador.primaryEmailAddress?.emailAddress || 'Usuario'
  const corrigidoPorEmail = operador.primaryEmailAddress?.emailAddress || null
  const dadosCorrigidos = registroAtual.tipo_entidade === 'veiculo'
    ? {
      ...protegidos,
      placa,
      motorista: textoOuNull(body.motorista),
      km: numeroOuNull(body.km),
      destino: textoOuNull(body.destino),
    }
    : registroAtual.tipo_entidade === 'transferencia'
      ? {
        ...protegidos,
        placa,
        base_origem: textoOuNull(body.base_origem),
        base_destino: textoOuNull(body.base_destino),
        motorista: textoOuNull(body.motorista),
        observacao: textoOuNull(body.observacao),
        status_transferencia: textoOuNull(body.status_transferencia),
      }
    : {
      ...protegidos,
      nome,
      cpf_rg: textoOuNull(body.cpf_rg) ?? textoOuNull(protegidos.cpf_rg),
      telefone: textoOuNull(body.telefone) ?? textoOuNull(protegidos.telefone),
      empresa: textoOuNull(body.empresa),
      destino: textoOuNull(body.destino),
    }

  const { data, error } = await supabase
    .from('TBL_HISTORICOS_ACOES')
    .insert({
      tipo_entidade: registroAtual.tipo_entidade,
      entidade_id: registroAtual.entidade_id,
      acao: 'correcao',
      placa: registroAtual.tipo_entidade === 'veiculo' || registroAtual.tipo_entidade === 'transferencia' ? placa : null,
      data_acao: dataAcao,
      responsavel_nome: corrigidoPorNome,
      responsavel_email: corrigidoPorEmail,
      motivo: motivoCorrecao,
      dados: {
        ...dadosCorrigidos,
        corrige_acao_id: originalId,
        corrigido_por_id: operador.id,
        corrigido_por_nome: corrigidoPorNome,
        corrigido_por_email: corrigidoPorEmail,
        corrigido_em: corrigidoEm,
        motivo_correcao: motivoCorrecao,
      },
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
  const historicoId = Number(id)

  if (!Number.isInteger(historicoId)) {
    return NextResponse.json({ error: 'ID invalido.' }, { status: 400 })
  }

  const body = (await request.json()) as Body
  const motivoExclusao = textoOuNull(body.motivo_exclusao)

  if (!motivoExclusao || motivoExclusao.length < 12) {
    return NextResponse.json({ error: 'Motivo da exclusao obrigatorio com pelo menos 12 caracteres.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: registroAtual, error: buscaError } = await supabase
    .from('TBL_HISTORICOS_ACOES')
    .select('*')
    .eq('id', historicoId)
    .single<HistoricoAcao>()

  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 400 })
  }

  if (registroAtual.tipo_entidade !== 'veiculo' && registroAtual.tipo_entidade !== 'pedestre' && registroAtual.tipo_entidade !== 'transferencia') {
    return NextResponse.json({ error: 'Tipo de historico nao suportado por esta rota.' }, { status: 400 })
  }

  const originalId = acaoOriginalId(registroAtual)

  if (!originalId) {
    return NextResponse.json({ error: 'Acao original nao encontrada.' }, { status: 400 })
  }

  const { data: registrosEntidade, error: registrosError } = await supabase
    .from('TBL_HISTORICOS_ACOES')
    .select('*')
    .eq('tipo_entidade', registroAtual.tipo_entidade)
    .eq('entidade_id', registroAtual.entidade_id)
    .returns<HistoricoAcao[]>()

  if (registrosError) {
    return NextResponse.json({ error: registrosError.message }, { status: 400 })
  }

  const registros = (registrosEntidade || []).filter(
    (registro) => registro.id === originalId || numeroDoJson(dados(registro).corrige_acao_id) === originalId,
  )
  const registroOriginal = registros.find((registro) => registro.id === originalId)

  if (!registroOriginal) {
    return NextResponse.json({ error: 'Registro original nao encontrado.' }, { status: 400 })
  }

  const registroVigente = registros
    .filter((registro) => registro.acao === 'correcao')
    .sort((a, b) => {
      const dataA = new Date(String(dados(a).corrigido_em || a.data_acao)).getTime()
      const dataB = new Date(String(dados(b).corrigido_em || b.data_acao)).getTime()
      if (dataA !== dataB) return dataB - dataA
      return b.id - a.id
    })[0] || registroOriginal

  const excluidoPorNome = operador.fullName || operador.primaryEmailAddress?.emailAddress || 'Usuario'
  const excluidoPorEmail = operador.primaryEmailAddress?.emailAddress || null
  const idsParaExcluir = registros.map((registro) => registro.id)

  const { error: arquivoError } = await supabase
    .from('TBL_HISTORICOS_ACOES')
    .insert({
      tipo_entidade: registroOriginal.tipo_entidade,
      entidade_id: registroOriginal.entidade_id,
      acao: 'exclusao',
      placa: registroVigente.placa || textoOuNull(dados(registroVigente).placa),
      data_acao: new Date().toISOString(),
      responsavel_nome: excluidoPorNome,
      responsavel_email: excluidoPorEmail,
      motivo: motivoExclusao,
      dados: {
        acao_original_id: originalId,
        registro_original: registroOriginal,
        registro_vigente: registroVigente,
        historico: registros,
        motivo_exclusao: motivoExclusao,
        excluido_por_id: operador.id,
        excluido_por_nome: excluidoPorNome,
        excluido_por_email: excluidoPorEmail,
      },
    })

  if (arquivoError) {
    return NextResponse.json({ error: arquivoError.message }, { status: 400 })
  }

  if (idsParaExcluir.length > 0) {
    const { error: deleteError } = await supabase
      .from('TBL_HISTORICOS_ACOES')
      .delete()
      .in('id', idsParaExcluir)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }
  }

  return NextResponse.json({ excluido: true })
}
