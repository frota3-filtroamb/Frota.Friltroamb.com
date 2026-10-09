import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TIPOS_PERMITIDOS = ['veiculo', 'pedestre', 'transferencia'] as const

type TipoPermitido = typeof TIPOS_PERMITIDOS[number]

function tipoValido(valor: string | null): valor is TipoPermitido {
  return TIPOS_PERMITIDOS.includes(valor as TipoPermitido)
}

export async function GET(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const tipo = request.nextUrl.searchParams.get('tipo')

  if (!tipoValido(tipo)) {
    return NextResponse.json({ error: 'Tipo de historico invalido.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const tiposConsulta = tipo === 'pedestre' ? ['pedestre', 'pedestres'] : [tipo]
  const { data, error } = await supabase
    .from('TBL_HISTORICOS_ACOES')
    .select('*')
    .in('tipo_entidade', tiposConsulta)
    .order('data_acao', { ascending: false })
    .limit(3000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data: data || [] })
}
