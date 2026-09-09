import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { PERMISSOES, type Permissao } from '@/lib/roles'

function isDev(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.publicMetadata?.role === 'dev'
}

function limparPermissoes(valor: unknown) {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is Permissao => PERMISSOES.includes(item))
}

export async function GET() {
  const user = await currentUser()
  if (!isDev(user)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const client = await clerkClient()
  const lista = await client.users.getUserList({ limit: 100, orderBy: '-created_at' })

  return NextResponse.json({
    usuarios: lista.data.map((item) => ({
      id: item.id,
      nome: item.fullName || [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Sem nome',
      email: item.primaryEmailAddress?.emailAddress || item.emailAddresses[0]?.emailAddress || '',
      role: typeof item.publicMetadata.role === 'string' ? item.publicMetadata.role : 'gestor',
      permissoes: limparPermissoes(item.publicMetadata.permissoes),
    })),
  })
}
