import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getPermissoes, getRole } from '@/lib/roles'

export async function GET() {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const role = operador.publicMetadata?.role
  if (role !== 'dev') {
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
    role: getRole({ publicMetadata: u.publicMetadata }),
    permissoes: getPermissoes({ publicMetadata: u.publicMetadata }),
  }))

  return NextResponse.json({ usuarios })
}
