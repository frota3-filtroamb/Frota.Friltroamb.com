'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type TopbarSearchContextValue = {
  busca: string
  setBusca: (valor: string) => void
  limparBusca: () => void
}

const TopbarSearchContext = createContext<TopbarSearchContextValue | null>(null)

export function TopbarSearchProvider({ children }: { children: React.ReactNode }) {
  const [busca, setBusca] = useState('')

  const limparBusca = useCallback(() => {
    setBusca('')
  }, [])

  const value = useMemo(
    () => ({
      busca,
      setBusca,
      limparBusca,
    }),
    [busca, limparBusca],
  )

  return (
    <TopbarSearchContext.Provider value={value}>
      {children}
    </TopbarSearchContext.Provider>
  )
}

export function useTopbarSearch() {
  const context = useContext(TopbarSearchContext)
  if (!context) {
    throw new Error('useTopbarSearch deve ser usado dentro de TopbarSearchProvider.')
  }
  return context
}
