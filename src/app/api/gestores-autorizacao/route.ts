import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { podeAcessar } from '@/lib/roles'

export async function GET() {
  try {
    const operador = await currentUser()

    if (!operador) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
    }

    const temPermissao =
      podeAcessar(operador, 'liberacao') ||
      podeAcessar(operador, 'liberacao.veiculo_externo') ||
      podeAcessar(operador, 'portaria') ||
      podeAcessar(operador, 'portaria.veiculos')

    if (!temPermissao) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('gestores_autorizacao')
      .select('id, nome, email, setor')
      .eq('ativo', true)
      .order('nome')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ gestores: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro inesperado ao carregar gestores.' },
      { status: 500 },
    )
  }
}
