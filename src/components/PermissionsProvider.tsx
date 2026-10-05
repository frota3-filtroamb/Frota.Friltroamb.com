'use client'

import { useUser } from '@clerk/nextjs'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { lerJsonSeguro } from '@/lib/http'
import { getPermissoes, getRole, podeAcessar as podeAcessarRole, podeAcessarDetalhe as podeAcessarDetalheRole, type Permissao, type Role } from '@/lib/roles'

type PermissionsContextValue = {
  role: Role
  permissoes: Permissao[]
  carregandoPermissoes: boolean
  atualizarPermissoes: () => Promise<void>
  podeAcessar: (permissao: Permissao) => boolean
  podeAcessarDetalhe: (permissaoPai: Permissao, permissaoDetalhe: Permissao) => boolean
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  const [role, setRole] = useState<Role>('basico')
  const [permissoes, setPermissoes] = useState<Permissao[]>([])
  const [carregandoPermissoes, setCarregandoPermissoes] = useState(true)

  const atualizarPermissoes = useCallback(async () => {
    if (!isLoaded || !user) {
      setRole('basico')
      setPermissoes([])
      setCarregandoPermissoes(false)
      return
    }

    try {
      const resposta = await fetch(`/api/me/permissoes?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const dados = await lerJsonSeguro(resposta)

      if (!resposta.ok) throw new Error(typeof dados.error === 'string' ? dados.error : 'Erro ao atualizar permissoes.')

      setRole(typeof dados.role === 'string' ? dados.role as Role : getRole(user))
      setPermissoes(Array.isArray(dados.permissoes) ? dados.permissoes : [])
    } catch {
      setRole(getRole(user))
      setPermissoes(getPermissoes(user))
    } finally {
      setCarregandoPermissoes(false)
    }
  }, [isLoaded, user])

  useEffect(() => {
    if (!isLoaded) return

    setRole(getRole(user))
    setPermissoes(getPermissoes(user))
    atualizarPermissoes()
  }, [atualizarPermissoes, isLoaded, user])

  useEffect(() => {
    if (!isLoaded || !user) return

    const interval = setInterval(atualizarPermissoes, 20000)

    function atualizarAoVoltar() {
      if (document.visibilityState === 'visible') {
        atualizarPermissoes()
      }
    }

    window.addEventListener('focus', atualizarPermissoes)
    document.addEventListener('visibilitychange', atualizarAoVoltar)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', atualizarPermissoes)
      document.removeEventListener('visibilitychange', atualizarAoVoltar)
    }
  }, [atualizarPermissoes, isLoaded, user])

  const usuarioPermissoes = useMemo(() => ({ publicMetadata: { role, permissoes } }), [role, permissoes])

  const value = useMemo(
    () => ({
      role,
      permissoes,
      carregandoPermissoes,
      atualizarPermissoes,
      podeAcessar: (permissao: Permissao) => podeAcessarRole(usuarioPermissoes, permissao),
      podeAcessarDetalhe: (permissaoPai: Permissao, permissaoDetalhe: Permissao) =>
        podeAcessarDetalheRole(usuarioPermissoes, permissaoPai, permissaoDetalhe),
    }),
    [atualizarPermissoes, carregandoPermissoes, permissoes, role, usuarioPermissoes],
  )

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (!context) {
    throw new Error('usePermissions deve ser usado dentro de PermissionsProvider.')
  }
  return context
}
