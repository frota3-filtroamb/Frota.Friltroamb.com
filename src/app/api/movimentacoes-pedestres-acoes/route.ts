import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { podeAcessar } from '@/lib/roles'

type AcaoPedestre = 'liberacao' | 'saida' | 'entrada'

type Body = {
  movimentacao_pedestre_id?: unknown
  acao?: unknown
  data_acao?: unknown
  nome?: unknown
  cpf_rg?: unknown
  telefone?: unknown
  empresa?: unknown
  destino?: unknown
  status_movimentacao?: unknown
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

function acaoObrigatoria(valor: unknown): AcaoPedestre | null {
  return valor === 'liberacao' || valor === 'saida' || valor === 'entrada' ? valor : null
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const temPermissao =
    podeAcessar(operador, 'liberacao') ||
    podeAcessar(operador, 'liberacao.pedestre') ||
    podeAcessar(operador, 'portaria') ||
    podeAcessar(operador, 'portaria.pedestres')

  if (!temPermissao) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = (await request.json()) as Body
  const movimentacaoPedestreId = numeroObrigatorio(body.movimentacao_pedestre_id)
  const acao = acaoObrigatoria(body.acao)
  const dataAcao = dataObrigatoria(body.data_acao)
  const nome = textoOuNull(body.nome)
  const statusMovimentacao = textoOuNull(body.status_movimentacao)

  if (!movimentacaoPedestreId) {
    return NextResponse.json({ error: 'Movimentacao de pedestre obrigatoria.' }, { status: 400 })
  }

  if (!acao) {
    return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
  }

  if (!dataAcao) {
    return NextResponse.json({ error: 'Data da acao obrigatoria.' }, { status: 400 })
  }

  if (!nome) {
    return NextResponse.json({ error: 'Nome obrigatorio.' }, { status: 400 })
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
    .from('movimentacoes_pedestres_acoes')
    .insert({
      movimentacao_pedestre_id: movimentacaoPedestreId,
      acao,
      data_acao: dataAcao,
      nome,
      cpf_rg: textoOuNull(body.cpf_rg),
      telefone: textoOuNull(body.telefone),
      empresa: textoOuNull(body.empresa),
      destino: textoOuNull(body.destino),
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
