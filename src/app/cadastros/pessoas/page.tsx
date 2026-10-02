'use client'

import RequirePermissao from '@/components/RequirePermissao'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/client'
import { formatCpf, formatPhone, onlyDigits } from '@/lib/masks'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Pessoa = {
  id: number | string
  nome: string | null
  cpf?: string | null
  cpf_rg?: string | null
  telefone?: string | null
  tipo?: string | null
  funcao?: string | null
  status?: string | null
  ativo?: boolean | null
  foto_url?: string | null
  cnh_numero?: string | null
  cnh_categoria?: string | null
  cnh_vencimento?: string | null
  app_habilitado?: boolean | null
}

type CadastroPessoa = {
  nome: string
  cpf: string
  telefone: string
  funcao: string
  status: 'ativo' | 'inativo'
  cnh_numero: string
  cnh_categoria: string
  cnh_vencimento: string
  app_habilitado: boolean
  foto_url: string
}

const cadastroInicial: CadastroPessoa = {
  nome: '',
  cpf: '',
  telefone: '',
  funcao: 'Motorista',
  status: 'ativo',
  cnh_numero: '',
  cnh_categoria: '',
  cnh_vencimento: '',
  app_habilitado: false,
  foto_url: '',
}

function textoNaoInformado(valor: string | null | undefined) {
  const texto = valor?.trim()
  return texto || 'Nao informado'
}

function normalizarNomeCompleto(valor: string) {
  return valor.replace(/\s+/g, ' ').toUpperCase()
}

function nomeTemNomeESobrenome(nome: string) {
  return nome.split(' ').filter((parte) => parte.length >= 2).length >= 2
}

function cpfPessoa(pessoa: Pessoa) {
  const cpf = pessoa.cpf || pessoa.cpf_rg
  return cpf ? formatCpf(cpf) : null
}

function telefonePessoa(pessoa: Pessoa) {
  return pessoa.telefone ? formatPhone(pessoa.telefone) : null
}

function pessoaAtiva(pessoa: Pessoa) {
  if (typeof pessoa.ativo === 'boolean') return pessoa.ativo
  return pessoa.status?.toLowerCase() !== 'inativo'
}

function formatarData(data: string | null | undefined) {
  if (!data) return 'Nao informado'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(data))
}

export default function PessoasPage() {
  const supabase = useMemo(() => createClient(), [])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [busca, setBusca] = useState('')
  const [cadastro, setCadastro] = useState<CadastroPessoa>(cadastroInicial)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const carregar = useCallback(async function carregar() {
    setCarregando(true)
    setMensagem('')

    try {
      const { data, error } = await supabase
        .from('motoristas')
        .select('*')
        .order('nome')

      if (error) throw error
      setPessoas(data || [])
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Erro ao carregar pessoas.')
    } finally {
      setCarregando(false)
    }
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function cadastrarPessoa(e: React.FormEvent) {
    e.preventDefault()

    const nome = normalizarNomeCompleto(cadastro.nome).trim()
    const cpf = onlyDigits(cadastro.cpf)
    const telefone = onlyDigits(cadastro.telefone)

    if (!nomeTemNomeESobrenome(nome)) {
      setMensagem('Informe nome e sobrenome.')
      return
    }

    if (cpf.length !== 11) {
      setMensagem('Informe um CPF com 11 numeros.')
      return
    }

    if (telefone && telefone.length < 10) {
      setMensagem('Informe um telefone com DDD ou deixe o campo vazio.')
      return
    }

    setSalvando(true)
    setMensagem('')

    try {
      const resposta = await fetch('/api/cadastros/pessoas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          cpf,
          telefone,
          funcao: cadastro.funcao,
          status: cadastro.status,
          cnh_numero: cadastro.cnh_numero,
          cnh_categoria: cadastro.cnh_categoria,
          cnh_vencimento: cadastro.cnh_vencimento,
          app_habilitado: cadastro.app_habilitado,
          foto_url: cadastro.foto_url,
        }),
      })
      const resultado = await resposta.json()
      if (!resposta.ok) throw new Error(resultado.error || 'Erro ao cadastrar pessoa.')

      setCadastro(cadastroInicial)
      setMensagem(resultado.mensagem || 'Pessoa cadastrada com sucesso.')
      await carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Erro ao cadastrar pessoa.')
    } finally {
      setSalvando(false)
    }
  }

  const pessoasFiltradas = useMemo(() => {
    const texto = busca.toLowerCase()
    return pessoas.filter((pessoa) => {
      const cpf = cpfPessoa(pessoa) || ''
      return (
        pessoa.nome?.toLowerCase().includes(texto) ||
        cpf.toLowerCase().includes(texto) ||
        pessoa.cnh_numero?.toLowerCase().includes(texto) ||
        pessoa.telefone?.toLowerCase().includes(texto)
      )
    })
  }, [pessoas, busca])

  return (
    <RequirePermissao permissao="cadastros.pessoas">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <main className="flex-1 min-h-screen overflow-y-auto bg-[#0a1625]">
          <section className="p-4 md:p-6">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-[#132337] p-1.5 lg:flex-row lg:items-center">
              <div className="px-4 py-2.5">
                <h1 className="text-base font-semibold text-white">Pessoas</h1>
                <p className="text-xs text-slate-500">{pessoasFiltradas.length} cadastro(s)</p>
              </div>

              <div className="hidden h-8 w-px bg-emerald-500/20 lg:block" />

              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome, CPF, CNH ou telefone..."
                className="min-w-[260px] flex-1 rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />

              <button
                type="button"
                onClick={carregar}
                disabled={carregando}
                className="rounded-lg border border-emerald-500/20 bg-[#0f1c2e] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Atualizar
              </button>
            </div>

            <form onSubmit={cadastrarPessoa} className="mb-4 rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-4">
              <div className="mb-4 flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-white">Nova pessoa</h2>
                <p className="text-xs text-slate-500">Cadastro usado nas liberacoes e nos relatorios.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Nome completo
                  </label>
                  <input
                    value={cadastro.nome}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, nome: normalizarNomeCompleto(e.target.value) }))}
                    placeholder="Nome completo"
                    required
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    CPF
                  </label>
                  <input
                    value={cadastro.cpf}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, cpf: formatCpf(e.target.value) }))}
                    placeholder="000.000.000-00"
                    required
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Telefone
                  </label>
                  <input
                    value={cadastro.telefone}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, telefone: formatPhone(e.target.value) }))}
                    placeholder="00 0 0000-0000"
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Funcao
                  </label>
                  <select
                    value={cadastro.funcao}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, funcao: e.target.value }))}
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  >
                    <option>Motorista</option>
                    <option>Colaborador</option>
                    <option>Visitante</option>
                    <option>Prestador</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </label>
                  <select
                    value={cadastro.status}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, status: e.target.value as CadastroPessoa['status'] }))}
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    CNH
                  </label>
                  <input
                    value={cadastro.cnh_numero}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, cnh_numero: onlyDigits(e.target.value).slice(0, 11) }))}
                    placeholder="Numero da CNH"
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Categoria
                  </label>
                  <input
                    value={cadastro.cnh_categoria}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, cnh_categoria: e.target.value.toUpperCase().slice(0, 4) }))}
                    placeholder="B, C, D..."
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Vencimento CNH
                  </label>
                  <input
                    type="date"
                    value={cadastro.cnh_vencimento}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, cnh_vencimento: e.target.value }))}
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    URL da foto
                  </label>
                  <input
                    value={cadastro.foto_url}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, foto_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>

                <label className="flex min-h-[42px] items-center gap-3 self-end rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    checked={cadastro.app_habilitado}
                    onChange={(e) => setCadastro((atual) => ({ ...atual, app_habilitado: e.target.checked }))}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Acesso APP habilitado
                </label>

                <button
                  type="submit"
                  disabled={salvando}
                  className="self-end rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Cadastrar pessoa'}
                </button>
              </div>
            </form>

            {mensagem && (
              <div className={`mb-4 rounded-xl border p-4 text-sm ${mensagem.includes('sucesso') ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                {mensagem}
              </div>
            )}

            <div className="space-y-3">
              {carregando ? (
                <div className="rounded-2xl border border-white/10 bg-[#0f1c2e] px-5 py-10 text-center text-slate-500">
                  Carregando pessoas...
                </div>
              ) : pessoasFiltradas.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#0f1c2e] px-5 py-10 text-center text-slate-500">
                  Nenhuma pessoa encontrada.
                </div>
              ) : (
                pessoasFiltradas.map((pessoa) => {
                  const ativo = pessoaAtiva(pessoa)
                  const cpf = cpfPessoa(pessoa)
                  const telefone = telefonePessoa(pessoa)
                  const funcao = textoNaoInformado(pessoa.funcao || pessoa.tipo || 'Motorista')

                  return (
                    <article
                      key={pessoa.id}
                      className="grid grid-cols-1 overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] shadow-[0_0_30px_rgba(16,185,129,0.05)] lg:grid-cols-[120px_1.2fr_1fr_1fr_96px]"
                    >
                      <div className="relative flex items-center justify-center border-b border-white/5 p-4 lg:border-b-0 lg:border-r">
                        <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-white/10 bg-[#132337]">
                          {pessoa.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pessoa.foto_url} alt={pessoa.nome || 'Pessoa'} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <div className="relative h-16 w-16 rounded-full bg-blue-500/80">
                                <div className="absolute left-1/2 top-[3.9rem] h-14 w-20 -translate-x-1/2 rounded-t-full bg-blue-500/80" />
                              </div>
                            </div>
                          )}
                        </div>
                        <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${ativo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                          {ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      <div className="border-b border-white/5 p-4 lg:border-b-0 lg:border-r">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-blue-300">
                          {pessoa.nome || 'Sem nome'}
                        </h2>
                        <span className="mt-2 inline-flex rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                          {funcao}
                        </span>
                        <p className="mt-4 text-sm font-semibold text-slate-300">
                          CPF {cpf || 'Nao informado'}
                        </p>
                      </div>

                      <div className="space-y-3 border-b border-white/5 p-4 text-sm lg:border-b-0 lg:border-r">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">CNH</p>
                        <p className="font-semibold text-slate-300">
                          No <span className="text-white">{textoNaoInformado(pessoa.cnh_numero)}</span>
                        </p>
                        <p className="font-semibold text-slate-400">
                          Categoria <span className="ml-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-300">{textoNaoInformado(pessoa.cnh_categoria)}</span>
                        </p>
                        <p className="font-semibold text-slate-400">
                          Vencimento <span className="ml-2 rounded-full bg-slate-500/10 px-3 py-1 text-xs text-slate-300">{formatarData(pessoa.cnh_vencimento)}</span>
                        </p>
                      </div>

                      <div className="space-y-3 border-b border-white/5 p-4 text-sm lg:border-b-0 lg:border-r">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Acesso APP celular</p>
                        <p className={`font-bold ${pessoa.app_habilitado ? 'text-emerald-300' : 'text-red-300'}`}>
                          {pessoa.app_habilitado ? 'Usuario habilitado' : 'Sem acesso'}
                        </p>
                        <p className="font-semibold text-slate-300">
                          {telefone || 'Telefone nao informado'}
                        </p>
                      </div>

                      <div className="flex items-start justify-end p-4">
                        <button
                          type="button"
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-500/30 hover:text-white"
                        >
                          Abrir
                        </button>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>
        </main>
      </div>
    </RequirePermissao>
  )
}
