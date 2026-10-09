import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { podeAcessarDetalhe } from '@/lib/roles'
import { createAdminClient } from '@/lib/supabase/admin'

type Body = Record<string, unknown>

function texto(valor: unknown) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  if (!podeAcessarDetalhe(operador, 'cadastros', 'cadastros.destinos')) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = (await request.json()) as Body
  const nome = texto(body.nome)
  const tipoDestino = texto(body.tipo_destino)
  const endereco = texto(body.endereco)

  if (!nome || nome.length < 2) {
    return NextResponse.json({ error: 'Informe o nome do destino.' }, { status: 400 })
  }

  if (!tipoDestino || tipoDestino.length < 2) {
    return NextResponse.json({ error: 'Informe o tipo de destino.' }, { status: 400 })
  }

  if (!endereco || endereco.length < 5) {
    return NextResponse.json({ error: 'Informe o endereco do destino.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: existente, error: buscaError } = await supabase
    .from('TBL_DESTINOS')
    .select('id')
    .ilike('nome', nome)
    .limit(1)
    .maybeSingle()

  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 400 })
  }

  if (existente) {
    return NextResponse.json({ error: 'Esse destino ja esta cadastrado.' }, { status: 400 })
  }

  const { error } = await supabase.from('TBL_DESTINOS').insert({
    nome,
    tipo_destino: tipoDestino,
    endereco,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ mensagem: 'Destino cadastrado com sucesso.' })
}
