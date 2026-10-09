'use client'

import RequirePermissao from '@/components/RequirePermissao'
import Sidebar from '@/components/Sidebar'
import { useTopbarSearch } from '@/components/TopbarSearchProvider'
import { lerJsonSeguro } from '@/lib/http'
import { formatCpf, formatPhone, onlyDigits } from '@/lib/masks'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Pessoa = {
  id: number | string
  origem?: 'rh'
  id_rh?: string | null
  cadastro_interno_id?: number | null
  nome: string | null
  cpf?: string | null
  cpf_rg?: string | null
  telefone?: string | null
  empresa?: string | null
  base?: string | null
  cargo?: string | null
  departamento?: string | null
  situacao?: string | null
  tipo?: string | null
  funcao?: string | null
  status?: string | null
  ativo?: boolean | null
  foto_url?: string | null
  email_gestor?: string | null
  setor_gestor?: string | null
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
  email_gestor: string
  setor_gestor: string
}

type PessoasResponse = {
  pessoas?: Pessoa[]
  total?: number
  total_rh?: number
  total_manuais?: number
  error?: string
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
  email_gestor: '',
  setor_gestor: '',
}

const SETORES_GESTOR = ['Frota', 'RH', 'Operacional', 'Administrativo', 'Financeiro', 'Comercial', 'Manutencao', 'Geral']

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
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const { busca, setBusca } = useTopbarSearch()
  const [pessoaAberta, setPessoaAberta] = useState<Pessoa | null>(null)
  const [formPessoaAberta, setFormPessoaAberta] = useState<CadastroPessoa>(cadastroInicial)
  const [carregando, setCarregando] = useState(true)
  const [salvandoPessoaAberta, setSalvandoPessoaAberta] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [resumoPessoas, setResumoPessoas] = useState({ total: 0, totalRh: 0, totalManuais: 0 })

  const carregar = useCallback(async function carregar() {
    setCarregando(true)
    setMensagem('')

    try {
      const resposta = await fetch('/api/cadastros/pessoas', { cache: 'no-store' })
      const resultado = await lerJsonSeguro(resposta) as PessoasResponse

      if (!resposta.ok) {
        throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao carregar pessoas.')
      }

      setPessoas(Array.isArray(resultado.pessoas) ? resultado.pessoas : [])
      setResumoPessoas({
        total: resultado.total || 0,
        totalRh: resultado.total_rh || 0,
        totalManuais: resultado.total_manuais || 0,
      })
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Erro ao carregar pessoas.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrirPessoa(pessoa: Pessoa) {
    const ativo = pessoaAtiva(pessoa)
    setPessoaAberta(pessoa)
    setFormPessoaAberta({
      nome: normalizarNomeCompleto(pessoa.nome || ''),
      cpf: cpfPessoa(pessoa) || '',
      telefone: telefonePessoa(pessoa) || '',
      funcao: pessoa.funcao || pessoa.tipo || 'Motorista',
      status: ativo ? 'ativo' : 'inativo',
      cnh_numero: pessoa.cnh_numero || '',
      cnh_categoria: pessoa.cnh_categoria || '',
      cnh_vencimento: pessoa.cnh_vencimento ? pessoa.cnh_vencimento.slice(0, 10) : '',
      app_habilitado: Boolean(pessoa.app_habilitado),
      email_gestor: pessoa.email_gestor || '',
      setor_gestor: pessoa.setor_gestor || '',
    })
  }

  function fecharPessoa() {
    setPessoaAberta(null)
    setFormPessoaAberta(cadastroInicial)
  }

  async function salvarPessoaAberta() {
    if (!pessoaAberta) return

    const nome = normalizarNomeCompleto(formPessoaAberta.nome).trim()
    const cpf = onlyDigits(formPessoaAberta.cpf)
    const telefone = onlyDigits(formPessoaAberta.telefone)

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

    if (formPessoaAberta.funcao.toLowerCase() === 'gestor' && !formPessoaAberta.email_gestor.trim()) {
      setMensagem('Informe o email do gestor.')
      return
    }

    if (formPessoaAberta.funcao.toLowerCase() === 'gestor' && !formPessoaAberta.setor_gestor.trim()) {
      setMensagem('Selecione o setor do gestor.')
      return
    }

    setSalvandoPessoaAberta(true)
    setMensagem('')

    try {
      const cadastroInternoId = pessoaAberta.cadastro_interno_id
      const url = cadastroInternoId ? `/api/cadastros/pessoas/${cadastroInternoId}` : '/api/cadastros/pessoas'
      const resposta = await fetch(url, {
        method: cadastroInternoId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          cpf,
          telefone,
          funcao: formPessoaAberta.funcao,
          status: formPessoaAberta.status,
          cnh_numero: formPessoaAberta.cnh_numero,
          cnh_categoria: formPessoaAberta.cnh_categoria,
          cnh_vencimento: formPessoaAberta.cnh_vencimento,
          app_habilitado: formPessoaAberta.app_habilitado,
          email_gestor: formPessoaAberta.email_gestor,
          setor_gestor: formPessoaAberta.setor_gestor,
        }),
      })
      const resultado = await lerJsonSeguro(resposta)
      if (!resposta.ok) throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao salvar pessoa.')

      fecharPessoa()
      setMensagem(typeof resultado.mensagem === 'string' ? resultado.mensagem : 'Pessoa salva com sucesso.')
      await carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Erro ao salvar pessoa.')
    } finally {
      setSalvandoPessoaAberta(false)
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
        pessoa.telefone?.toLowerCase().includes(texto) ||
        pessoa.cargo?.toLowerCase().includes(texto) ||
        pessoa.empresa?.toLowerCase().includes(texto) ||
        pessoa.base?.toLowerCase().includes(texto) ||
        pessoa.departamento?.toLowerCase().includes(texto)
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
                <p className="text-xs text-slate-500">
                  {pessoasFiltradas.length} exibido(s) · {resumoPessoas.totalRh} RH · {resumoPessoas.totalManuais} configurado(s)
                </p>
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

            <div className="mb-4 rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-4">
              <h2 className="text-sm font-semibold text-white">Dados do RH</h2>
              <p className="mt-1 text-xs text-slate-500">
                A lista vem direto do Banco de dados do RH. Use o botao ''Abrir''' para adicionar apenas as configuracoes internas do sistema.
              </p>
            </div>

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
                  const origemRh = pessoa.origem === 'rh'

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
                        <span className={`absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${origemRh ? 'bg-sky-500/15 text-sky-300' : 'bg-orange-500/15 text-orange-300'}`}>
                          {origemRh ? 'RH' : 'Manual'}
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
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {textoNaoInformado(pessoa.base || pessoa.empresa)}
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
                        <p className="text-xs font-semibold text-slate-500">
                          {textoNaoInformado(pessoa.departamento || pessoa.situacao)}
                        </p>
                      </div>

                      <div className="flex items-start justify-end p-4">
                        <button
                          type="button"
                          onClick={() => abrirPessoa(pessoa)}
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

          {pessoaAberta && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
              <div className="app-scroll max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-emerald-500/20 bg-[#0f1c2e] shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/5 bg-[#132337]/70 px-5 py-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">Cadastro da pessoa</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {pessoaAberta.nome || 'Pessoa sem nome'} · Registro RH · ID {pessoaAberta.cadastro_interno_id || pessoaAberta.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fecharPessoa}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"
                  >
                    Fechar
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[160px_1fr]">
                  <div className="space-y-3">
                    <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-2xl border border-white/10 bg-[#132337]">
                      {pessoaAberta.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pessoaAberta.foto_url} alt={formPessoaAberta.nome || 'Pessoa'} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="relative h-20 w-20 rounded-full bg-blue-500/80">
                            <div className="absolute left-1/2 top-[4.8rem] h-16 w-24 -translate-x-1/2 rounded-t-full bg-blue-500/80" />
                          </div>
                        </div>
                      )}
                    </div>

                    <span className={`mx-auto flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${formPessoaAberta.status === 'ativo' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                      {formPessoaAberta.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="md:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Nome completo</span>
                      <input
                        value={formPessoaAberta.nome}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, nome: normalizarNomeCompleto(e.target.value) }))}
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">CPF</span>
                      <input
                        value={formPessoaAberta.cpf}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, cpf: formatCpf(e.target.value) }))}
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Telefone</span>
                      <input
                        value={formPessoaAberta.telefone}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, telefone: formatPhone(e.target.value) }))}
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Funcao</span>
                      <select
                        value={formPessoaAberta.funcao}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, funcao: e.target.value }))}
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      >
                        <option>Motorista</option>
                        <option>Colaborador</option>
                        <option>Porteiro</option>
                        <option>Visitante</option>
                        <option>Prestador</option>
                        <option>Gestor</option>
                      </select>
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Status</span>
                      <select
                        value={formPessoaAberta.status}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, status: e.target.value as CadastroPessoa['status'] }))}
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      >
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">CNH</span>
                      <input
                        value={formPessoaAberta.cnh_numero}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, cnh_numero: onlyDigits(e.target.value).slice(0, 11) }))}
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Categoria</span>
                      <input
                        value={formPessoaAberta.cnh_categoria}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, cnh_categoria: e.target.value.toUpperCase().slice(0, 4) }))}
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Vencimento CNH</span>
                      <input
                        type="date"
                        value={formPessoaAberta.cnh_vencimento}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, cnh_vencimento: e.target.value }))}
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Acesso APP</span>
                      <span className="flex min-h-[42px] items-center gap-3 rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm font-semibold text-slate-300">
                        <input
                          type="checkbox"
                          checked={formPessoaAberta.app_habilitado}
                          onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, app_habilitado: e.target.checked }))}
                          className="h-4 w-4 accent-emerald-500"
                        />
                        Usuario habilitado
                      </span>
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email do Colaborador</span>
                      <input
                        type="email"
                        value={formPessoaAberta.email_gestor}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, email_gestor: e.target.value.toLowerCase().trim() }))}
                        placeholder="gestor@filtroamb.com.br"
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Setor do gestor</span>
                      <select
                        value={formPessoaAberta.setor_gestor}
                        onChange={(e) => setFormPessoaAberta((atual) => ({ ...atual, setor_gestor: e.target.value }))}
                        className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      >
                        <option value="">Selecione o setor</option>
                        {SETORES_GESTOR.map((setor) => (
                          <option key={setor} value={setor}>{setor}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-white/5 px-5 py-4">
                  <button
                    type="button"
                    onClick={fecharPessoa}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvarPessoaAberta}
                    disabled={salvandoPessoaAberta}
                    className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-[#0a1625] transition hover:bg-emerald-400"
                  >
                    {salvandoPessoaAberta ? 'Salvando...' : 'Salvar alteracoes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </RequirePermissao>
  )
}
