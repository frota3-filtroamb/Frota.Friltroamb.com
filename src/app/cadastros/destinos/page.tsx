'use client'

import RequirePermissao from '@/components/RequirePermissao'
import Sidebar from '@/components/Sidebar'
import { useTopbarSearch } from '@/components/TopbarSearchProvider'
import { lerJsonSeguro } from '@/lib/http'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Destino = {
  id: number | string
  nome: string | null
  tipo_destino: string | null
  endereco: string | null
}

function normalizarDestino(valor: string) {
  return valor.replace(/\s+/g, ' ').trim()
}

export default function DestinosPage() {
  const supabase = useMemo(() => createClient(), [])
  const [destinos, setDestinos] = useState<Destino[]>([])
  const { busca, setBusca } = useTopbarSearch()
  const [nome, setNome] = useState('')
  const [tipoDestino, setTipoDestino] = useState('')
  const [endereco, setEndereco] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const carregar = useCallback(async function carregar() {
    setCarregando(true)
    setMensagem('')

    try {
      const { data, error } = await supabase
        .from('destinos')
        .select('id, nome, tipo_destino, endereco')
        .order('nome')

      if (error) throw error
      setDestinos(data || [])
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Erro ao carregar destinos.')
    } finally {
      setCarregando(false)
    }
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function cadastrarDestino(e: React.FormEvent) {
    e.preventDefault()

    const destino = normalizarDestino(nome)
    const tipo = normalizarDestino(tipoDestino)
    const enderecoDestino = normalizarDestino(endereco)
    if (destino.length < 2) {
      setMensagem('Informe um destino com pelo menos 2 caracteres.')
      return
    }

    if (tipo.length < 2) {
      setMensagem('Informe o tipo de destino.')
      return
    }

    if (enderecoDestino.length < 5) {
      setMensagem('Informe o endereco do destino.')
      return
    }

    const jaExiste = destinos.some((item) => item.nome?.trim().toLowerCase() === destino.toLowerCase())
    if (jaExiste) {
      setMensagem('Esse destino ja esta cadastrado.')
      return
    }

    setSalvando(true)
    setMensagem('')

    try {
      const resposta = await fetch('/api/cadastros/destinos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: destino,
          tipo_destino: tipo,
          endereco: enderecoDestino,
        }),
      })
      const resultado = await lerJsonSeguro(resposta)
      if (!resposta.ok) throw new Error(typeof resultado.error === 'string' ? resultado.error : 'Erro ao cadastrar destino.')

      setNome('')
      setTipoDestino('')
      setEndereco('')
      setMensagem(typeof resultado.mensagem === 'string' ? resultado.mensagem : 'Destino cadastrado com sucesso.')
      await carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Erro ao cadastrar destino.')
    } finally {
      setSalvando(false)
    }
  }

  const destinosFiltrados = useMemo(() => {
    const texto = busca.toLowerCase()
    return destinos.filter((destino) =>
      destino.nome?.toLowerCase().includes(texto) ||
      destino.tipo_destino?.toLowerCase().includes(texto) ||
      destino.endereco?.toLowerCase().includes(texto)
    )
  }, [destinos, busca])

  return (
    <RequirePermissao permissao="cadastros.destinos">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <main className="app-scroll flex-1 min-h-screen overflow-y-auto bg-[#0a1625]">
          <section className="p-4 md:p-6">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-[#132337] p-1.5 lg:flex-row lg:items-center">
              <div className="px-4 py-2.5">
                <h1 className="text-base font-semibold text-white">Destinos</h1>
                <p className="text-xs text-slate-500">{destinosFiltrados.length} destino(s)</p>
              </div>

              <div className="hidden h-8 w-px bg-emerald-500/20 lg:block" />

              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar destino, tipo ou endereco..."
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

            <form onSubmit={cadastrarDestino} className="mb-4 rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] p-4">
              <div className="mb-4 flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-white">Novo destino</h2>
                <p className="text-xs text-slate-500">Cadastro usado nas liberacoes de veiculos, pedestres e transferencias.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_1.4fr_auto]">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Destino
                  </label>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Comercial, Diretoria, Matriz..."
                    required
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Tipo de destino
                  </label>
                  <input
                    value={tipoDestino}
                    onChange={(e) => setTipoDestino(e.target.value)}
                    placeholder="Ex: Setor, Cliente, Base"
                    required
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Endereco
                  </label>
                  <input
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, numero, bairro, cidade..."
                    required
                    className="w-full rounded-xl border border-emerald-500/20 bg-[#132337] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={salvando}
                  className="self-end rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-[#0a1625] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Cadastrar destino'}
                </button>
              </div>
            </form>

            {mensagem && (
              <div className={`mb-4 rounded-xl border p-4 text-sm ${mensagem.includes('sucesso') ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                {mensagem}
              </div>
            )}

            <div className="rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] overflow-hidden">
              <div className="app-scroll max-h-[68vh] overflow-y-auto overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="bg-[#132337] border-b border-emerald-500/15 sticky top-0 z-10">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Destino</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Endereco</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-emerald-400/90">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {carregando ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">Carregando destinos...</td>
                      </tr>
                    ) : destinosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">Nenhum destino encontrado.</td>
                      </tr>
                    ) : (
                      destinosFiltrados.map((destino) => (
                        <tr key={destino.id} className="hover:bg-emerald-500/5 transition-colors">
                          <td className="px-4 py-3 font-semibold text-white">{destino.nome || 'Sem nome'}</td>
                          <td className="px-4 py-3 text-slate-300">{destino.tipo_destino || '-'}</td>
                          <td className="px-4 py-3 text-slate-300">{destino.endereco || '-'}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{destino.id}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </RequirePermissao>
  )
}
