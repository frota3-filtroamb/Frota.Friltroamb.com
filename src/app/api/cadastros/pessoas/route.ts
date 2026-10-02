import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { podeAcessarDetalhe } from '@/lib/roles'
import { createAdminClient } from '@/lib/supabase/admin'

type Body = Record<string, unknown>

function texto(valor: unknown) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

function digitos(valor: unknown) {
  return typeof valor === 'string' ? valor.replace(/\D/g, '') : ''
}

function nomeCompleto(valor: unknown) {
  return texto(valor)?.replace(/\s+/g, ' ').toUpperCase() || null
}

function nomeTemSobrenome(nome: string) {
  return nome.split(' ').filter((parte) => parte.length >= 2).length >= 2
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  if (!podeAcessarDetalhe(operador, 'cadastros', 'cadastros.pessoas')) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = (await request.json()) as Body
  const nome = nomeCompleto(body.nome)
  const cpf = digitos(body.cpf)
  const telefone = digitos(body.telefone)
  const funcao = texto(body.funcao) || 'Motorista'
  const status = texto(body.status) === 'inativo' ? 'inativo' : 'ativo'

  if (!nome || !nomeTemSobrenome(nome)) {
    return NextResponse.json({ error: 'Informe nome e sobrenome.' }, { status: 400 })
  }

  if (cpf.length !== 11) {
    return NextResponse.json({ error: 'Informe um CPF com 11 numeros.' }, { status: 400 })
  }

  if (telefone && telefone.length < 10) {
    return NextResponse.json({ error: 'Informe um telefone com DDD ou deixe o campo vazio.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('motoristas').insert({
    nome,
    cpf,
    telefone: telefone || null,
    funcao,
    tipo: funcao,
    status,
    ativo: status === 'ativo',
    cnh_numero: texto(body.cnh_numero),
    cnh_categoria: texto(body.cnh_categoria),
    cnh_vencimento: texto(body.cnh_vencimento),
    app_habilitado: Boolean(body.app_habilitado),
    foto_url: texto(body.foto_url),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ mensagem: 'Pessoa cadastrada com sucesso.' })
}
