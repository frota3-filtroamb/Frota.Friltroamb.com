'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: () => void
}>({
  theme: 'dark',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const pathname = usePathname()

  const isAuthRoute = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up')

  useEffect(() => {
    // Se estiver em rota de autenticação (login / cadastro), força tema escuro absoluto
    if (isAuthRoute) {
      document.documentElement.classList.remove('light')
      return
    }

    const saved = localStorage.getItem('theme') as Theme | null
    if (saved === 'light') {
      setTheme('light')
      document.documentElement.classList.add('light')
    } else {
      setTheme('dark')
      document.documentElement.classList.remove('light')
    }
  }, [pathname, isAuthRoute])

  function toggleTheme() {
    if (isAuthRoute) return
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}