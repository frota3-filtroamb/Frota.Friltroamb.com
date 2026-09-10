import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { PERMISSOES, type Permissao } from '@/lib/roles'

function limparPermissoes(valor: unknown): Permissao[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is Permissao =>
    (PERMISSOES as readonly string[]).includes(String(item))
  )
}

export async function GET() {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const role = operador.publicMetadata?.role
  if (role !== 'dev' && role !== 'gestor') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const client = await clerkClient()
  const lista = await client.users.getUserList({ limit: 100 })

  const usuarios = lista.data.map((u) => ({
    id: u.id,
    nome:
      u.fullName ||
      [u.firstName, u.lastName].filter(Boolean).join(' ') ||
      'Sem nome',
    email:
      u.primaryEmailAddress?.emailAddress ||
      u.emailAddresses[0]?.emailAddress ||
      '',
    role:
      typeof u.publicMetadata?.role === 'string'
        ? u.publicMetadata.role
        : 'gestor',
    permissoes: limparPermissoes(u.publicMetadata?.permissoes),
  }))

  return NextResponse.json({ usuarios })
}