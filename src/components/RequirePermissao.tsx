'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { type Permissao } from '@/lib/roles'
import { usePermissions } from '@/components/PermissionsProvider'

export default function RequirePermissao({
  permissao,
  children,
}: {
  permissao: Permissao
  children: React.ReactNode
}) {
  const { user, isLoaded } = useUser()
  const { carregandoPermissoes, podeAcessar } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded || carregandoPermissoes) return

    if (!podeAcessar(permissao)) {
      const nome = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || 'Usuario'

      try {
        window.sessionStorage.setItem(
          'frota_access_denied_message',
          `${nome} nao tem permissao para a pagina desejada.`,
        )
      } catch {
        // Sem sessionStorage, apenas redireciona.
      }

      router.replace('/inicio')
    }
  }, [carregandoPermissoes, isLoaded, permissao, podeAcessar, router, user])

  if (!isLoaded || carregandoPermissoes) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1625] text-slate-400">
        Carregando...
      </div>
    )
  }

  if (!podeAcessar(permissao)) {
    return null
  }

  return <>{children}</>
}
