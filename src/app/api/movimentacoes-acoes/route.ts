import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { podeAcessar } from '@/lib/roles'

type AcaoMovimentacao = 'liberacao' | 'saida' | 'entrada'

type Body = {
  movimentacao_id?: unknown
  acao?: unknown
  data_acao?: unknown
  placa?: unknown
  motorista?: unknown
  km?: unknown
  origem?: unknown
  destino?: unknown
  tipo_veiculo?: unknown
  status_movimentacao?: unknown
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

function numeroObrigatorio(valor: unknown) {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isInteger(numero) ? numero : null
}

function dataObrigatoria(valor: unknown) {
  if (typeof valor !== 'string') return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

function acaoObrigatoria(valor: unknown): AcaoMovimentacao | null {
  return valor === 'liberacao' || valor === 'saida' || valor === 'entrada' ? valor : null
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const temPermissao =
    podeAcessar(operador, 'liberacao') ||
    podeAcessar(operador, 'liberacao.veiculo_empresa') ||
    podeAcessar(operador, 'liberacao.veiculo_externo') ||
    podeAcessar(operador, 'liberacao.veiculo_interno') ||
    podeAcessar(operador, 'portaria') ||
    podeAcessar(operador, 'portaria.veiculos')

  if (!temPermissao) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = (await request.json()) as Body
  const movimentacaoId = numeroObrigatorio(body.movimentacao_id)
  const acao = acaoObrigatoria(body.acao)
  const dataAcao = dataObrigatoria(body.data_acao)
  const placa = textoOuNull(body.placa)
  const statusMovimentacao = textoOuNull(body.status_movimentacao)

  if (!movimentacaoId) {
    return NextResponse.json({ error: 'Movimentacao obrigatoria.' }, { status: 400 })
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

  if (!statusMovimentacao) {
    return NextResponse.json({ error: 'Status da movimentacao obrigatorio.' }, { status: 400 })
  }

  const responsavelNome =
    operador.fullName ||
    operador.username ||
    operador.primaryEmailAddress?.emailAddress ||
    'Usuario nao identificado'

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('movimentacoes_acoes')
    .insert({
      movimentacao_id: movimentacaoId,
      acao,
      data_acao: dataAcao,
      placa,
      motorista: textoOuNull(body.motorista),
      km: numeroOuNull(body.km),
      origem: textoOuNull(body.origem),
      destino: textoOuNull(body.destino),
      tipo_veiculo: textoOuNull(body.tipo_veiculo),
      status_movimentacao: statusMovimentacao,
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
