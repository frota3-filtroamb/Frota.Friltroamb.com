'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import Sidebar from '@/components/Sidebar'
import { type Permissao } from '@/lib/roles'
import { usePermissions } from '@/components/PermissionsProvider'
import { useEffect, useState } from 'react'

type Atalho = {
  href: string
  titulo: string
  descricao: string
  permissao: Permissao | 'usuarios'
  cor: 'emerald' | 'blue' | 'purple' | 'orange'
}

const ATALHOS: Atalho[] = [
  {
    href: '/',
    titulo: 'Veiculos',
    descricao: 'Consultar frota, placas e dados dos veiculos.',
    permissao: 'veiculos',
    cor: 'emerald',
  },
  {
    href: '/liberacao',
    titulo: 'Liberacao',
    descricao: 'Registrar saidas, entradas, pedestres e transferencias.',
    permissao: 'liberacao',
    cor: 'blue',
  },
  {
    href: '/portaria',
    titulo: 'Controle',
    descricao: 'Acompanhar veiculos, pedestres e autorizacoes pendentes.',
    permissao: 'portaria',
    cor: 'orange',
  },
  {
    href: '/encomendas',
    titulo: 'Encomendas',
    descricao: 'Registrar chegada, retirada e historico de encomendas.',
    permissao: 'encomendas',
    cor: 'purple',
  },
  {
    href: '/relatorios/entrada-saida-veiculos',
    titulo: 'Relatorios',
    descricao: 'Conferir historico de veiculos, pedestres e transferencias.',
    permissao: 'portaria',
    cor: 'emerald',
  },
  {
    href: '/usuarios',
    titulo: 'Usuarios',
    descricao: 'Gerenciar perfis e permissoes do sistema.',
    permissao: 'usuarios',
    cor: 'blue',
  },
]

const ROTINAS = [
  'Conferir liberacoes pendentes na Portaria/Controle.',
  'Registrar novas liberacoes apenas com dados completos.',
  'Usar Relatorios para corrigir registros com motivo obrigatorio.',
  'Manter cadastros de pessoas e destinos atualizados.',
]

const corClasses: Record<Atalho['cor'], string> = {
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50',
  blue: 'border-blue-500/20 bg-blue-500/10 text-blue-300 hover:border-blue-400/50',
  purple: 'border-purple-500/20 bg-purple-500/10 text-purple-300 hover:border-purple-400/50',
  orange: 'border-orange-500/20 bg-orange-500/10 text-orange-300 hover:border-orange-400/50',
}

function saudacao() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function InicioPage() {
  const { user } = useUser()
  const permissoesAtualizadas = usePermissions()
  const [mensagemPermissao, setMensagemPermissao] = useState('')
  const nome = user?.firstName || user?.fullName || 'Usuario'
  const role = permissoesAtualizadas.role === 'dev' ? 'dev' : null

  const atalhosPermitidos = ATALHOS.filter((atalho) => {
    if (atalho.permissao === 'usuarios') return role === 'dev'
    return permissoesAtualizadas.podeAcessar(atalho.permissao)
  })

  useEffect(() => {
    try {
      const mensagem = window.sessionStorage.getItem('frota_access_denied_message')
      if (!mensagem) return

      setMensagemPermissao(mensagem)
      window.sessionStorage.removeItem('frota_access_denied_message')

      const timeout = window.setTimeout(() => {
        setMensagemPermissao('')
      }, 7000)

      return () => window.clearTimeout(timeout)
    } catch {
      return undefined
    }
  }, [])

  return (
    <div className="min-h-screen flex bg-[#0a1625]">
      <Sidebar />

      <main className="app-scroll flex-1 overflow-y-auto bg-[#0a1625]">
        {mensagemPermissao && (
          <div className="access-denied-toast fixed right-5 top-20 z-50 max-w-sm rounded-2xl border border-orange-500/25 bg-[#111827] p-4 text-sm text-slate-200 shadow-2xl shadow-black/30">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-sm font-bold text-orange-300">
                !
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-white">Acesso bloqueado</p>
                <p className="mt-1 leading-relaxed text-slate-300">{mensagemPermissao}</p>
              </div>
              <button
                type="button"
                onClick={() => setMensagemPermissao('')}
                aria-label="Fechar aviso"
                className="ml-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white/5 hover:text-white"
              >
                x
              </button>
            </div>
          </div>
        )}

        <div className="inicio-hero relative h-[170px] w-full overflow-hidden">
          <Image
            src="/images/banner-frota3.jpg"
            alt="Gestao de Frota"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="inicio-hero-overlay absolute inset-0 bg-gradient-to-r from-[#061322]/85 via-[#061322]/55 to-[#061322]/10" />
          <div className="inicio-hero-fade absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a1625] to-transparent" />

          <div className="absolute inset-0 flex items-end px-4 pb-6 md:px-8 xl:px-14">
            <div>
              <p className="inicio-hero-kicker text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Filtroamb - Frota Ativa</p>
              <h1 className="inicio-hero-title mt-2 text-2xl font-bold text-white md:text-3xl">{saudacao()}, {nome}</h1>
              <p className="inicio-hero-subtitle mt-1 text-sm text-slate-300">Acesse rapidamente as principais rotinas do sistema.</p>
            </div>
          </div>
        </div>

        <section className="px-4 pb-8 pt-4 md:px-8 xl:px-14">
          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Operacao</p>
              <p className="mt-2 text-xl font-bold text-white">Portaria e liberacoes</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">Fluxos de entrada, saida, pedestres, transferencias e encomendas.</p>
            </div>

            <div className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Base</p>
              <p className="mt-2 text-xl font-bold text-white">Cadastros organizados</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">Pessoas, destinos e frota alimentam os formularios do dia a dia.</p>
            </div>

            <div className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Auditoria</p>
              <p className="mt-2 text-xl font-bold text-white">Historico rastreavel</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">Correcoes e exclusoes ficam registradas para conferencia posterior.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
            <section className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5">
              <div className="mb-4 flex flex-col gap-1">
                <h2 className="text-base font-semibold text-white">Acesso rapido</h2>
                <p className="text-sm text-slate-500">Atalhos liberados conforme o seu perfil.</p>
              </div>

              {atalhosPermitidos.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#132337] p-5 text-sm text-slate-400">
                  Nenhum atalho liberado para este usuario.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {atalhosPermitidos.map((atalho) => (
                    <Link
                      key={atalho.href}
                      href={atalho.href}
                      className={`group rounded-xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_35px_rgba(0,0,0,0.18)] ${corClasses[atalho.cor]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-white">{atalho.titulo}</h3>
                          <p className="mt-1 text-sm leading-relaxed text-slate-400">{atalho.descricao}</p>
                        </div>
                        <span className="mt-1 text-lg transition group-hover:translate-x-1">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <aside className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-5">
              <h2 className="text-base font-semibold text-white">Rotina recomendada</h2>
              <div className="mt-4 space-y-3">
                {ROTINAS.map((rotina, index) => (
                  <div key={rotina} className="flex gap-3 rounded-xl border border-white/10 bg-[#132337]/60 p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-[#0a1625]">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-300">{rotina}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </main>
    </div>
  )
}
