import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { podeAcessar } from '@/lib/roles'
import { buscarRegistrosRhGeral, digitosDocumento, RegistroRhGeral } from '@/lib/rh-registro-geral'

type CadastroInterno = {
  id: number
  nome: string | null
  cpf: string | null
  funcao: string | null
  tipo: string | null
  status: string | null
  ativo: boolean | null
}

type TipoSelecao = 'todos' | 'motorista' | 'porteiro'

function tipoSelecao(valor: string | null): TipoSelecao {
  if (valor === 'motorista' || valor === 'porteiro') return valor
  return 'todos'
}

function normalizado(valor: string | null | undefined) {
  return (valor || '').trim().toLowerCase()
}

function ehAtivoRh(registro: RegistroRhGeral) {
  const situacao = normalizado(registro.situacao)
  return !registro.data_demissao && situacao !== 'desligado' && situacao !== 'demitido'
}

function ehMotorista(registro: RegistroRhGeral | null, interno: CadastroInterno | null) {
  const funcao = normalizado(interno?.funcao || interno?.tipo)
  const cargo = normalizado(registro?.cargo)
  return funcao.includes('motorista') || cargo.includes('motorista')
}

function ehPorteiro(interno: CadastroInterno | null) {
  const funcao = normalizado(interno?.funcao || interno?.tipo)
  return funcao.includes('porteiro')
}

function itemSelecao(registro: RegistroRhGeral | null, interno: CadastroInterno | null) {
  const id = interno?.id ? String(interno.id) : `rh:${registro?.id}`
  const nome = registro?.colaborador || interno?.nome || 'Pessoa sem nome'

  return {
    id,
    nome,
  }
}

export async function GET(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  if (!podeAcessar(operador, 'liberacao') && !podeAcessar(operador, 'portaria') && !podeAcessar(operador, 'cadastros')) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const tipo = tipoSelecao(request.nextUrl.searchParams.get('tipo'))
  const supabase = createAdminClient()
  const [rhResultado, internosQuery] = await Promise.all([
    buscarRegistrosRhGeral(),
    supabase
      .from('TBL_CADASTROS')
      .select('id, nome, cpf, funcao, tipo, status, ativo')
      .order('nome')
      .returns<CadastroInterno[]>(),
  ])

  if (rhResultado.error) {
    return NextResponse.json({ error: rhResultado.error }, { status: 502 })
  }

  if (internosQuery.error) {
    return NextResponse.json({ error: internosQuery.error.message }, { status: 400 })
  }

  const internos = internosQuery.data || []
  const internosPorCpf = new Map(
    internos
      .map((cadastro) => [digitosDocumento(cadastro.cpf), cadastro] as const)
      .filter(([cpf]) => cpf.length === 11),
  )

  const itensRh = (rhResultado.data || [])
    .filter(ehAtivoRh)
    .map((registro) => {
      const cpf = digitosDocumento(registro.cpf)
      return { registro, interno: internosPorCpf.get(cpf) || null }
    })

  const pessoas = itensRh
    .filter(({ registro, interno }) => {
      if (tipo === 'motorista') return ehMotorista(registro, interno)
      if (tipo === 'porteiro') return ehPorteiro(interno)
      return true
    })
    .map(({ registro, interno }) => itemSelecao(registro, interno))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return NextResponse.json({ pessoas })
}
