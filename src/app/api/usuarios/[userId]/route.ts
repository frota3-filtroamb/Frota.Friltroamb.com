import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { PERMISSOES, getPermissoes, getRole, type Permissao, type Role } from '@/lib/roles'

const ROLES: Role[] = ['dev', 'gestor', 'editor', 'porteiro', 'basico']

type Body = {
  role?: unknown
  permissoes?: unknown
}

function isDev(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.publicMetadata?.role === 'dev'
}

function limparPermissoes(valor: unknown): Permissao[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is Permissao => PERMISSOES.includes(item))
}

function limparRole(valor: unknown): Role {
  return ROLES.includes(valor as Role) ? (valor as Role) : 'basico'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const operador = await currentUser()
  if (!isDev(operador)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const { userId } = await params
  const body = (await request.json()) as Body
  const role = limparRole(body.role)
  const permissoes = limparPermissoes(body.permissoes)

  const client = await clerkClient()
  const atualizado = await client.users.updateUserMetadata(userId, {
    publicMetadata: { role, permissoes },
  })

  return NextResponse.json({
    usuario: {
      id: atualizado.id,
      nome: atualizado.fullName || [atualizado.firstName, atualizado.lastName].filter(Boolean).join(' ') || 'Sem nome',
      email: atualizado.primaryEmailAddress?.emailAddress || atualizado.emailAddresses[0]?.emailAddress || '',
      role: getRole({ publicMetadata: atualizado.publicMetadata }),
      permissoes: getPermissoes({ publicMetadata: atualizado.publicMetadata }),
    },
  })
}
