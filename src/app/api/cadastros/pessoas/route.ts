import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { podeAcessarDetalhe } from '@/lib/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarRegistrosRhGeral, digitosDocumento, RegistroRhGeral } from '@/lib/rh-registro-geral'

type Body = Record<string, unknown>

type CadastroInterno = {
  id: number
  nome: string | null
  cpf: string | null
  telefone: string | null
  funcao: string | null
  tipo: string | null
  status: string | null
  ativo: boolean | null
  cnh_numero: string | null
  cnh_categoria: string | null
  cnh_vencimento: string | null
  app_habilitado: boolean | null
  email_gestor: string | null
  setor_gestor: string | null
}

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

function pessoaDoRh(registro: RegistroRhGeral, interno: CadastroInterno | null) {
  const ativoRh = !registro.data_demissao && registro.situacao?.toLowerCase() !== 'desligado'
  const funcaoInterna = interno?.funcao || interno?.tipo || null

  return {
    origem: 'rh',
    id: interno?.id ?? `rh:${registro.id}`,
    id_rh: registro.id,
    nome: registro.colaborador,
    cpf: digitosDocumento(registro.cpf),
    empresa: registro.empresa,
    base: registro.base,
    cargo: registro.cargo,
    situacao: registro.situacao,
    departamento: registro.departamento,
    telefone: interno?.telefone || null,
    funcao: funcaoInterna || registro.cargo || 'Colaborador',
    tipo: interno?.tipo || funcaoInterna || registro.cargo || 'Colaborador',
    status: interno?.status || (ativoRh ? 'ativo' : 'inativo'),
    ativo: interno?.ativo ?? ativoRh,
    cnh_numero: interno?.cnh_numero || null,
    cnh_categoria: interno?.cnh_categoria || null,
    cnh_vencimento: interno?.cnh_vencimento || null,
    app_habilitado: interno?.app_habilitado || false,
    email_gestor: interno?.email_gestor || null,
    setor_gestor: interno?.setor_gestor || null,
    cadastro_interno_id: interno?.id || null,
  }
}

function pessoaInterna(interno: CadastroInterno) {
  return {
    origem: 'manual',
    id: interno.id,
    id_rh: null,
    nome: interno.nome,
    cpf: digitosDocumento(interno.cpf),
    empresa: 'Cadastro interno',
    base: null,
    cargo: null,
    situacao: interno.status || null,
    departamento: null,
    telefone: interno.telefone,
    funcao: interno.funcao || interno.tipo || 'Colaborador',
    tipo: interno.tipo || interno.funcao || 'Colaborador',
    status: interno.status,
    ativo: interno.ativo,
    cnh_numero: interno.cnh_numero,
    cnh_categoria: interno.cnh_categoria,
    cnh_vencimento: interno.cnh_vencimento,
    app_habilitado: interno.app_habilitado,
    email_gestor: interno.email_gestor,
    setor_gestor: interno.setor_gestor,
    cadastro_interno_id: interno.id,
  }
}

export async function GET() {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  if (!podeAcessarDetalhe(operador, 'cadastros', 'cadastros.pessoas')) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const [rhResultado, cadastrosQuery] = await Promise.all([
    buscarRegistrosRhGeral(),
    supabase
      .from('TBL_CADASTROS')
      .select('*')
      .order('nome')
      .returns<CadastroInterno[]>(),
  ])

  if (rhResultado.error) {
    return NextResponse.json({ error: rhResultado.error }, { status: 502 })
  }

  if (cadastrosQuery.error) {
    return NextResponse.json({ error: cadastrosQuery.error.message }, { status: 400 })
  }

  const internos = (cadastrosQuery.data || [])
  const internosAtivos = internos.filter((cadastro) => cadastro.ativo !== false && cadastro.status?.toLowerCase() !== 'inativo')
  const internosPorCpf = new Map(
    internosAtivos
      .map((cadastro) => [digitosDocumento(cadastro.cpf), cadastro] as const)
      .filter(([cpf]) => cpf.length === 11),
  )

  const cpfsRh = new Set<string>()
  const pessoasRh = (rhResultado.data || [])
    .map((registro) => {
      const cpf = digitosDocumento(registro.cpf)
      if (cpf) cpfsRh.add(cpf)
      return pessoaDoRh(registro, internosPorCpf.get(cpf) || null)
    })

  const pessoasInternas = internosAtivos
    .filter((cadastro) => !cpfsRh.has(digitosDocumento(cadastro.cpf)))
    .map(pessoaInterna)

  const pessoas = [...pessoasRh, ...pessoasInternas].sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR'),
  )

  return NextResponse.json({
    pessoas,
    total: pessoas.length,
    total_rh: pessoasRh.length,
    total_manuais: pessoasInternas.length + pessoasRh.filter((pessoa) => Boolean(pessoa.cadastro_interno_id)).length,
  })
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
  const { error } = await supabase.from('TBL_CADASTROS').insert({
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const gestorError = await sincronizarGestorAutorizacao(supabase, {
    nome,
    email: emailGestor,
    setor: setorGestor,
    funcao,
    ativo: status === 'ativo',
  })

  if (gestorError) {
    return NextResponse.json({ error: `Pessoa cadastrada, mas o gestor nao foi sincronizado: ${gestorError}` }, { status: 400 })
  }

  return NextResponse.json({ mensagem: 'Pessoa cadastrada com sucesso.' })
}
