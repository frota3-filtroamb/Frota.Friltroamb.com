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

function emailValido(email: string | null) {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

async function sincronizarGestorAutorizacao(
  supabase: ReturnType<typeof createAdminClient>,
  dados: { nome: string; email: string | null; setor: string | null; funcao: string; ativo: boolean },
) {
  const ehGestor = dados.funcao.toLowerCase() === 'gestor'
  if (!ehGestor) return null

  if (!emailValido(dados.email)) {
    return 'Informe um email valido para cadastrar a pessoa como gestor.'
  }

  const email = dados.email!.toLowerCase()
  const { data: gestorExistente, error: buscaError } = await supabase
    .from('gestores_autorizacao')
    .select('id')
    .eq('email', email)
    .maybeSingle<{ id: string }>()

  if (buscaError) return buscaError.message

  if (gestorExistente) {
    const { error } = await supabase
      .from('gestores_autorizacao')
      .update({
        nome: dados.nome,
        setor: dados.setor || 'Geral',
        ativo: dados.ativo,
      })
      .eq('id', gestorExistente.id)

    return error?.message || null
  }

  const { error } = await supabase.from('gestores_autorizacao').insert({
    nome: dados.nome,
    email,
    setor: dados.setor || 'Geral',
    ativo: dados.ativo,
  })

  return error?.message || null
}

async function desativarGestorAutorizacao(
  supabase: ReturnType<typeof createAdminClient>,
  email: string | null,
) {
  if (!email) return null

  const { error } = await supabase
    .from('gestores_autorizacao')
    .update({ ativo: false })
    .eq('email', email.toLowerCase())

  return error?.message || null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  if (!podeAcessarDetalhe(operador, 'cadastros', 'cadastros.pessoas')) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const { id } = await params
  const pessoaId = Number(id)

  if (!Number.isInteger(pessoaId)) {
    return NextResponse.json({ error: 'ID invalido.' }, { status: 400 })
  }

  const body = (await request.json()) as Body
  const nome = nomeCompleto(body.nome)
  const cpf = digitos(body.cpf)
  const telefone = digitos(body.telefone)
  const funcao = texto(body.funcao) || 'Motorista'
  const status = texto(body.status) === 'inativo' ? 'inativo' : 'ativo'
  const emailGestor = texto(body.email_gestor)?.toLowerCase() || null
  const setorGestor = texto(body.setor_gestor)

  if (!nome || !nomeTemSobrenome(nome)) {
    return NextResponse.json({ error: 'Informe nome e sobrenome.' }, { status: 400 })
  }

  if (cpf.length !== 11) {
    return NextResponse.json({ error: 'Informe um CPF com 11 numeros.' }, { status: 400 })
  }

  if (telefone && telefone.length < 10) {
    return NextResponse.json({ error: 'Informe um telefone com DDD ou deixe o campo vazio.' }, { status: 400 })
  }

  if (funcao.toLowerCase() === 'gestor' && !emailValido(emailGestor)) {
    return NextResponse.json({ error: 'Informe um email valido para cadastrar a pessoa como gestor.' }, { status: 400 })
  }

  if (funcao.toLowerCase() === 'gestor' && !setorGestor) {
    return NextResponse.json({ error: 'Selecione o setor do gestor.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: cadastroAtual, error: buscaAtualError } = await supabase
    .from('TBL_CADASTROS')
    .select('id, email_gestor, funcao, tipo')
    .eq('id', pessoaId)
    .maybeSingle<{ id: number; email_gestor: string | null; funcao: string | null; tipo: string | null }>()

  if (buscaAtualError) {
    return NextResponse.json({ error: buscaAtualError.message }, { status: 400 })
  }

  if (!cadastroAtual) {
    return NextResponse.json({ error: 'Cadastro interno nao encontrado.' }, { status: 404 })
  }

  const { error } = await supabase
    .from('TBL_CADASTROS')
    .update({
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
      email_gestor: emailGestor,
      setor_gestor: setorGestor,
    })
    .eq('id', pessoaId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const emailGestorAnterior = cadastroAtual.email_gestor?.toLowerCase() || null
  const funcaoAnterior = (cadastroAtual.funcao || cadastroAtual.tipo || '').toLowerCase()
  const funcaoAnteriorEhGestor = funcaoAnterior === 'gestor'
  const funcaoAtualEhGestor = funcao.toLowerCase() === 'gestor'
  const mudouEmailGestor = Boolean(funcaoAnteriorEhGestor && emailGestorAnterior && emailGestorAnterior !== emailGestor)
  const deixouDeSerGestor = Boolean(funcaoAnteriorEhGestor && emailGestorAnterior && !funcaoAtualEhGestor)

  if (mudouEmailGestor || deixouDeSerGestor) {
    const desativarError = await desativarGestorAutorizacao(supabase, emailGestorAnterior)

    if (desativarError) {
      return NextResponse.json({ error: `Pessoa atualizada, mas o gestor antigo nao foi desativado: ${desativarError}` }, { status: 400 })
    }
  }

  const gestorError = await sincronizarGestorAutorizacao(supabase, {
    nome,
    email: emailGestor,
    setor: setorGestor,
    funcao,
    ativo: status === 'ativo',
  })

  if (gestorError) {
    return NextResponse.json({ error: `Pessoa atualizada, mas o gestor nao foi sincronizado: ${gestorError}` }, { status: 400 })
  }

  return NextResponse.json({ mensagem: 'Pessoa atualizada com sucesso.' })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  if (!podeAcessarDetalhe(operador, 'cadastros', 'cadastros.pessoas')) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const { id } = await params
  const pessoaId = Number(id)

  if (!Number.isInteger(pessoaId)) {
    return NextResponse.json({ error: 'ID invalido.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: pessoa, error: buscaError } = await supabase
    .from('TBL_CADASTROS')
    .select('id, email_gestor')
    .eq('id', pessoaId)
    .maybeSingle<{ id: number; email_gestor: string | null }>()

  if (buscaError) {
    return NextResponse.json({ error: buscaError.message }, { status: 400 })
  }

  if (!pessoa) {
    return NextResponse.json({ error: 'Cadastro interno nao encontrado.' }, { status: 404 })
  }

  const { error } = await supabase
    .from('TBL_CADASTROS')
    .update({
      ativo: false,
      status: 'inativo',
    })
    .eq('id', pessoaId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (pessoa.email_gestor) {
    const { error: gestorError } = await supabase
      .from('gestores_autorizacao')
      .update({ ativo: false })
      .eq('email', pessoa.email_gestor.toLowerCase())

    if (gestorError) {
      return NextResponse.json({ error: `Cadastro inativado, mas o gestor nao foi desativado: ${gestorError.message}` }, { status: 400 })
    }
  }

  return NextResponse.json({ mensagem: 'Cadastro interno inativado com sucesso.' })
}
