import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getPermissoes, getRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const client = await clerkClient()
  const usuario = await client.users.getUser(userId)

  return NextResponse.json(
    {
      role: getRole({ publicMetadata: usuario.publicMetadata }),
      permissoes: getPermissoes({ publicMetadata: usuario.publicMetadata }),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    },
  )
}
