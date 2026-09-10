'use client'

import { SignIn } from '@clerk/nextjs'
import { useTheme } from '@/components/ThemeProvider'

export default function Page() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6">
    
      <img
        src="/images/banner-frota.jpg"
        alt="Filtroamb"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-[#0a1625]/75" />

    

      {/* Conteúdo */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/images/logo-filtroamb-light.png"
            alt="Filtroamb"
            className="h-12 w-auto object-contain drop-shadow-lg"
          />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white drop-shadow">Gestão de Frota</h1>
          <p className="text-sm text-emerald-400 mt-1">Sistema interno Filtroamb</p>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-[#0f1c2e]/95 border border-emerald-400/20 shadow-2xl backdrop-blur',
              headerTitle: 'text-black',
              headerSubtitle: 'text-slate-400',
              formFieldLabel: 'text-slate-300',
              formFieldInput:
                'bg-[#132337] border border-emerald-400/20 text-white',
              footerActionLink: 'text-emerald-400 hover:text-emerald-400',
              formButtonPrimary:
                'bg-emerald-400 hover:bg-emerald-400 text-[#0a1625] font-semibold',
              identityPreviewText: 'text-white',
              identityPreviewEditButton: 'text-emerald-400',
              socialButtonsBlockButton:
                'bg-[#132337] border border-white/10 text-white',
            },
          }}
        />

        <p className="text-center text-xs text-slate-400 mt-6">
          Acesso restrito a colaboradores autorizados
        </p>
      </div>
    </div>
  )
}