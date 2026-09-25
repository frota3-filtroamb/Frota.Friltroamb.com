'use client'

import { useEffect } from 'react'
import { SignUp } from '@clerk/nextjs'
import { dark } from '@clerk/themes'

export default function Page() {
  useEffect(() => {
    // Garante que o tema claro nunca seja aplicado na tela de cadastro
    document.documentElement.classList.remove('light')
  }, [])

  return (
    <div
      data-auth-page="true"
      className="relative flex h-dvh items-center justify-center overflow-hidden bg-[#0a1625] p-3"
    >
      <img
        src="/images/banner-frota.jpg"
        alt="Filtroamb"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-[#0a1625]/80 backdrop-blur-[2px]" />

      {/* Conteúdo */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-2 flex justify-center">
          <img
            src="/images/logo-filtroamb-dark1.png"
            alt="Filtroamb"
            className="h-15 w-auto object-contain drop-shadow-lg"
          />
        </div>

        <SignUp
          path="/sign-up"
          routing="path"
          fallbackRedirectUrl="/"
          forceRedirectUrl="/"
          appearance={{
            theme: dark,
            variables: {
              colorPrimary: '#10b981',
              colorBackground: '#0f1c2e',
              colorForeground: '#ffffff',
              colorMutedForeground: '#94a3b8',
              colorInput: '#132337',
              colorInputForeground: '#ffffff',
              colorDanger: '#ef4444',
            },
            elements: {
              rootBox: 'mx-auto w-full',
              card: 'bg-[#0f1c2e]/95 border border-emerald-400/20 shadow-2xl backdrop-blur-sm rounded-2xl',
              headerTitle: 'text-white font-bold text-lg',
              headerSubtitle: 'hidden',
              formFieldLabel: 'text-slate-300 font-medium text-xs',
              formFieldInput:
                'h-9 bg-[#132337] border border-emerald-400/20 text-white rounded-xl focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-colors',
              otpCodeFieldInputs: 'flex flex-row items-center justify-center gap-1.5',
              otpCodeFieldInput:
                'h-9 w-8 min-w-8 px-0 text-center text-sm font-semibold bg-[#132337] border border-emerald-400/20 text-white rounded-lg focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400',
              footerActionText: 'text-slate-400 text-sm',
              footerActionLink: 'text-emerald-400 hover:text-emerald-300 font-semibold transition-colors',
              formButtonPrimary:
                'h-9 bg-emerald-500 hover:bg-emerald-400 text-[#0a1625] font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200',
              identityPreviewText: 'text-white font-medium',
              identityPreviewEditButton: 'text-emerald-400 hover:text-emerald-300',
              socialButtonsBlockButton:
                'bg-[#132337] border border-white/10 text-white hover:bg-[#1a2e47] transition-colors',
              socialButtonsBlockButtonText: 'text-white font-medium',
              dividerLine: 'bg-emerald-400/20',
              dividerText: 'text-slate-400 text-xs',
              formFieldSuccessText: 'text-emerald-400',
              formFieldErrorText: 'text-red-400 text-xs',
              alertText: 'text-slate-200',
            },
          }}
        />

        <p className="auth-footnote mt-2 text-center text-xs leading-snug text-slate-400">
          Acesso restrito a colaboradores autorizados.
        </p>
      </div>
    </div>
  )
}
