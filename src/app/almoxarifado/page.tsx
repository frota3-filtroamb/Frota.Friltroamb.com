'use client'

import RequirePermissao from '@/components/RequirePermissao'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@clerk/nextjs'
import { useEffect, useMemo, useState } from 'react'

type Aba = 'estoque' | 'movimentos' | 'compras'
type TipoMovimento = 'entrada' | 'saida'

type EstoqueItem = {
  id: number
  codigo: string | null
  nome: string
  unidade: string | null
  quantidade: number | string | null
  estoque_minimo: number | string | null
  localizacao: string | null
  created_at: string | null
}

type EstoqueMovimento = {
  id: number
  item_id: number | null
  tipo: TipoMovimento
  quantidade: number | string
  origem: string | null
  referencia_id: number | null
  observacao: string | null
  criado_por: string | null
  created_at: string | null
  estoque_itens?: {
    codigo: string | null
    nome: string
    unidade: string | null
  } | null
}

type OrdemCompraItem = {
  id: number
  ordem_id: number
  item_id: number
  quantidade: number | string
  quantidade_recebida: number | string | null
  estoque_itens?: {
    codigo: string | null
    nome: string
    unidade: string | null
  } | null
}

type OrdemCompra = {
  id: number
  numero: string | null
  fornecedor: string | null
  status: 'aberta' | 'recebida' | 'cancelada' | string
  comprador: string | null
  observacao: string | null
  created_at: string | null
  recebida_em: string | null
  ordens_compra_itens?: OrdemCompraItem[]
}

function numero(valor: number | string | null | undefined) {
  return Number(valor ?? 0)
}

function formatarNumero(valor: number | string | null | undefined) {
  return numero(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function formatarData(data: string | null) {
  if (!data) return '-'
  return new Date(data).toLocaleString('pt-BR')
}

export default function AlmoxarifadoPage() {
  const supabase = createClient()
  const { user } = useUser()

  const [aba, setAba] = useState<Aba>('estoque')
  const [itens, setItens] = useState<EstoqueItem[]>([])
  const [movimentos, setMovimentos] = useState<EstoqueMovimento[]>([])
  const [ordens, setOrdens] = useState<OrdemCompra[]>([])
  const [busca, setBusca] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState('UN')
  const [quantidadeInicial, setQuantidadeInicial] = useState('')
  const [estoqueMinimo, setEstoqueMinimo] = useState('')
  const [localizacao, setLocalizacao] = useState('')

  const [itemMovimentoId, setItemMovimentoId] = useState('')
  const [tipoMovimento, setTipoMovimento] = useState<TipoMovimento>('entrada')
  const [quantidadeMovimento, setQuantidadeMovimento] = useState('')
  const [observacaoMovimento, setObservacaoMovimento] = useState('')

  const [numeroOrdem, setNumeroOrdem] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [itemOrdemId, setItemOrdemId] = useState('')
  const [quantidadeOrdem, setQuantidadeOrdem] = useState('')
  const [observacaoOrdem, setObservacaoOrdem] = useState('')

  const usuarioAtual = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Sistema'

  async function carregar() {
    setCarregando(true)
    try {
      const [itensQuery, movimentosQuery, ordensQuery] = await Promise.all([
        supabase.from('estoque_itens').select('*').order('nome'),
        supabase
          .from('estoque_movimentos')
          .select('*, estoque_itens(codigo, nome, unidade)')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('ordens_compra')
          .select('*, ordens_compra_itens(*, estoque_itens(codigo, nome, unidade))')
          .order('created_at', { ascending: false })
          .limit(80),
      ])

      if (itensQuery.error) throw itensQuery.error
      if (movimentosQuery.error) throw movimentosQuery.error
      if (ordensQuery.error) throw ordensQuery.error

      setItens((itensQuery.data || []) as EstoqueItem[])
      setMovimentos((movimentosQuery.data || []) as EstoqueMovimento[])
      setOrdens((ordensQuery.data || []) as OrdemCompra[])
    } catch (error) {
      setMensagem(error instanceof Error ? 'Erro ao carregar almoxarifado: ' + error.message : 'Erro ao carregar almoxarifado.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const itensFiltrados = useMemo(() => {
    const texto = busca.toLowerCase()
    return itens.filter((item) =>
      item.nome.toLowerCase().includes(texto) ||
      item.codigo?.toLowerCase().includes(texto) ||
      item.localizacao?.toLowerCase().includes(texto),
    )
  }, [itens, busca])

  const movimentosFiltrados = useMemo(() => {
    const texto = busca.toLowerCase()
    return movimentos.filter((movimento) =>
      movimento.estoque_itens?.nome.toLowerCase().includes(texto) ||
      movimento.estoque_itens?.codigo?.toLowerCase().includes(texto) ||
      movimento.observacao?.toLowerCase().includes(texto),
    )
  }, [movimentos, busca])

  const ordensFiltradas = useMemo(() => {
    const texto = busca.toLowerCase()
    return ordens.filter((ordem) =>
      ordem.numero?.toLowerCase().includes(texto) ||
      ordem.fornecedor?.toLowerCase().includes(texto) ||
      ordem.ordens_compra_itens?.some((item) => item.estoque_itens?.nome.toLowerCase().includes(texto)),
    )
  }, [ordens, busca])

  const estoqueBaixo = itens.filter((item) => numero(item.quantidade) <= numero(item.estoque_minimo)).length
  const totalItens = itens.length
  const ordensAbertas = ordens.filter((ordem) => ordem.status === 'aberta').length

  async function criarItem(e: React.FormEvent) {
    e.preventDefault()
    const quantidade = Number(quantidadeInicial || 0)
    const minimo = Number(estoqueMinimo || 0)

    if (!nome.trim()) {
      setMensagem('Informe o nome do item.')
      return
    }
    if (quantidade < 0 || minimo < 0) {
      setMensagem('Quantidade e estoque minimo nao podem ser negativos.')
      return
    }

    setSalvando(true)
    setMensagem('')

    const { data, error } = await supabase
      .from('estoque_itens')
      .insert({
        codigo: codigo.trim() || null,
        nome: nome.trim(),
        unidade: unidade.trim() || 'UN',
        quantidade,
        estoque_minimo: minimo,
        localizacao: localizacao.trim() || null,
      })
      .select()
      .single()

    if (!error && quantidade > 0 && data) {
      await supabase.from('estoque_movimentos').insert({
        item_id: data.id,
        tipo: 'entrada',
        quantidade,
        origem: 'manual',
        observacao: 'Saldo inicial',
        criado_por: usuarioAtual,
      })
    }

    setSalvando(false)

    if (error) {
      setMensagem('Erro ao cadastrar item: ' + error.message)
      return
    }

    setMensagem('Item cadastrado com sucesso.')
    setCodigo('')
    setNome('')
    setUnidade('UN')
    setQuantidadeInicial('')
    setEstoqueMinimo('')
    setLocalizacao('')
    carregar()
  }

  async function registrarMovimento(e: React.FormEvent) {
    e.preventDefault()
    const itemSelecionado = itens.find((registro) => String(registro.id) === itemMovimentoId)
    const quantidade = Number(quantidadeMovimento)

    if (!itemSelecionado || !Number.isFinite(quantidade) || quantidade <= 0) {
      setMensagem('Selecione um item e informe uma quantidade maior que zero.')
      return
    }

    const { data: itemAtual, error: buscaError } = await supabase
      .from('estoque_itens')
      .select('*')
      .eq('id', itemSelecionado.id)
      .single()

    if (buscaError || !itemAtual) {
      setMensagem('Erro ao buscar saldo atual: ' + (buscaError?.message || 'item nao encontrado.'))
      return
    }

    const item = itemAtual as EstoqueItem
    const saldoAtual = numero(item.quantidade)
    const novoSaldo = tipoMovimento === 'entrada' ? saldoAtual + quantidade : saldoAtual - quantidade

    if (novoSaldo < 0) {
      setMensagem(`Saida maior que o saldo atual (${formatarNumero(item.quantidade)} ${item.unidade || 'UN'}).`)
      return
    }

    setSalvando(true)
    setMensagem('')

    const { data: itemAtualizado, error: itemError } = await supabase
      .from('estoque_itens')
      .update({ quantidade: novoSaldo })
      .eq('id', item.id)
      .select('id, quantidade')
      .single()

    if (itemError || !itemAtualizado) {
      setSalvando(false)
      setMensagem('Erro ao atualizar saldo: ' + (itemError?.message || 'item nao atualizado.'))
      return
    }

    const { error: movError } = await supabase.from('estoque_movimentos').insert({
      item_id: item.id,
      tipo: tipoMovimento,
      quantidade,
      origem: 'manual',
      observacao: observacaoMovimento.trim() || null,
      criado_por: usuarioAtual,
    })

    setSalvando(false)

    if (movError) {
      setMensagem('Saldo atualizado, mas erro ao registrar historico: ' + movError.message)
      return
    }

    setItens((atuais) => atuais.map((registro) => (registro.id === item.id ? { ...registro, quantidade: novoSaldo } : registro)))
    setMensagem('Movimento registrado com sucesso.')
    setItemMovimentoId('')
    setQuantidadeMovimento('')
    setObservacaoMovimento('')
    await carregar()
  }

  async function criarOrdem(e: React.FormEvent) {
    e.preventDefault()
    const item = itens.find((registro) => String(registro.id) === itemOrdemId)
    const quantidade = Number(quantidadeOrdem)

    if (!item || !Number.isFinite(quantidade) || quantidade <= 0) {
      setMensagem('Selecione um item e informe a quantidade da ordem.')
      return
    }

    setSalvando(true)
    setMensagem('')

    const { data: ordem, error } = await supabase
      .from('ordens_compra')
      .insert({
        numero: numeroOrdem.trim() || null,
        fornecedor: fornecedor.trim() || null,
        comprador: usuarioAtual,
        observacao: observacaoOrdem.trim() || null,
        status: 'aberta',
      })
      .select()
      .single()

    if (error || !ordem) {
      setSalvando(false)
      setMensagem('Erro ao criar ordem: ' + (error?.message || 'ordem nao retornada.'))
      return
    }

    const { error: itemError } = await supabase.from('ordens_compra_itens').insert({
      ordem_id: ordem.id,
      item_id: item.id,
      quantidade,
      quantidade_recebida: 0,
    })

    setSalvando(false)

    if (itemError) {
      setMensagem('Ordem criada, mas erro ao incluir item: ' + itemError.message)
      return
    }

    setMensagem('Ordem de compra criada com sucesso.')
    setNumeroOrdem('')
    setFornecedor('')
    setItemOrdemId('')
    setQuantidadeOrdem('')
    setObservacaoOrdem('')
    carregar()
  }

  async function receberOrdem(ordem: OrdemCompra) {
    const itemOrdem = ordem.ordens_compra_itens?.[0]
    if (!itemOrdem) {
      setMensagem('Ordem sem item para recebimento.')
      return
    }

    const item = itens.find((registro) => registro.id === itemOrdem.item_id)
    if (!item) {
      setMensagem('Item da ordem nao foi encontrado no estoque.')
      return
    }

    const quantidadeTotal = numero(itemOrdem.quantidade)
    const quantidadeRecebida = numero(itemOrdem.quantidade_recebida)
    const quantidadePendente = quantidadeTotal - quantidadeRecebida

    if (quantidadePendente <= 0) {
      setMensagem('Esta ordem ja foi recebida.')
      return
    }

    setSalvando(true)
    setMensagem('')

    const novoSaldo = numero(item.quantidade) + quantidadePendente
    const recebidoEm = new Date().toISOString()

    const { error: estoqueError } = await supabase.from('estoque_itens').update({ quantidade: novoSaldo }).eq('id', item.id)
    if (estoqueError) {
      setSalvando(false)
      setMensagem('Erro ao atualizar estoque: ' + estoqueError.message)
      return
    }

    const { error: ordemItemError } = await supabase
      .from('ordens_compra_itens')
      .update({ quantidade_recebida: quantidadeTotal })
      .eq('id', itemOrdem.id)

    if (ordemItemError) {
      setSalvando(false)
      setMensagem('Estoque atualizado, mas erro ao atualizar item da OC: ' + ordemItemError.message)
      return
    }

    const { error: ordemError } = await supabase
      .from('ordens_compra')
      .update({ status: 'recebida', recebida_em: recebidoEm })
      .eq('id', ordem.id)

    if (!ordemError) {
      await supabase.from('estoque_movimentos').insert({
        item_id: item.id,
        tipo: 'entrada',
        quantidade: quantidadePendente,
        origem: 'ordem_compra',
        referencia_id: ordem.id,
        observacao: `Recebimento da OC ${ordem.numero || ordem.id}`,
        criado_por: usuarioAtual,
      })
    }

    setSalvando(false)

    if (ordemError) {
      setMensagem('Erro ao finalizar ordem: ' + ordemError.message)
      return
    }

    setMensagem('Ordem recebida e estoque atualizado.')
    carregar()
  }

  return (
    <RequirePermissao permissao="almoxarifado">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <div className="flex-1 ml-14 flex flex-col h-screen overflow-hidden">
          <div className="relative h-28 md:h-36 shrink-0 overflow-hidden">
            <img src="/images/banner-frota.jpg" alt="Filtroamb" className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1625]/90 via-[#0a1625]/55 to-[#0a1625]/15" />
            <div data-banner className="absolute inset-0 flex items-end pb-4 px-8">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Almoxarifado</h1>
                <p className="text-sm text-cyan-300 mt-0.5">Controle de estoque, entradas, saidas e compras</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#0a1625]" style={{ zoom: 0.95 }}>
            <main className="p-6">
              <div className="max-w-7xl mx-auto space-y-5">
                <div className="flex flex-wrap gap-3 bg-[#132337] border border-cyan-500/20 rounded-xl p-1.5 w-fit">
                  {[
                    { id: 'estoque' as Aba, label: 'Estoque' },
                    { id: 'movimentos' as Aba, label: 'Movimentacoes' },
                    { id: 'compras' as Aba, label: 'Compras' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setAba(item.id)
                        setMensagem('')
                      }}
                      className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md cursor-pointer ${
                        aba === item.id ? 'bg-cyan-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {mensagem && (
                  <div className={`p-4 rounded-xl text-sm border ${mensagem.includes('Erro') || mensagem.includes('maior') || mensagem.includes('nao') ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}>
                    {mensagem}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#0f1c2e] border border-cyan-500/20 rounded-2xl p-5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Itens cadastrados</p>
                    <p className="text-3xl font-bold text-cyan-300 mt-1">{totalItens}</p>
                  </div>
                  <div className="bg-[#0f1c2e] border border-orange-500/20 rounded-2xl p-5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Estoque baixo</p>
                    <p className="text-3xl font-bold text-orange-300 mt-1">{estoqueBaixo}</p>
                  </div>
                  <div className="bg-[#0f1c2e] border border-blue-500/20 rounded-2xl p-5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">OC abertas</p>
                    <p className="text-3xl font-bold text-blue-300 mt-1">{ordensAbertas}</p>
                  </div>
                </div>

                {aba === 'estoque' && (
                  <div className="animate-tab grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
                    <section className="bg-[#0f1c2e] border border-cyan-500/15 rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/5 bg-[#132337]/60">
                        <h2 className="text-base font-semibold text-white">Novo Item</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Cadastre materiais, pecas e insumos</p>
                      </div>
                      <form onSubmit={criarItem} className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Codigo</label>
                            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Unidade</label>
                            <input value={unidade} onChange={(e) => setUnidade(e.target.value.toUpperCase())} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Nome *</label>
                          <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Qtd inicial</label>
                            <input type="number" min="0" step="0.01" value={quantidadeInicial} onChange={(e) => setQuantidadeInicial(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Estoque min.</label>
                            <input type="number" min="0" step="0.01" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Localizacao</label>
                          <input value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                        </div>
                        <button disabled={salvando} className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#0a1625] font-semibold py-3 rounded-xl transition disabled:opacity-50">
                          {salvando ? 'Salvando...' : 'Cadastrar Item'}
                        </button>
                      </form>
                    </section>

                    <section className="bg-[#0f1c2e] border border-cyan-500/15 rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/5 bg-[#132337]/60 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-semibold text-white">Estoque Atual</h2>
                          <p className="text-xs text-slate-500 mt-0.5">Saldos por item</p>
                        </div>
                        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item..." className="w-72 px-4 py-2 bg-[#0a1625] border border-cyan-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                      </div>
                      <div className="max-h-[58vh] overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-[#132337] border-b border-cyan-500/15 sticky top-0 z-10">
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Item</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Saldo</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Minimo</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Local</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {carregando ? (
                              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Carregando estoque...</td></tr>
                            ) : itensFiltrados.length === 0 ? (
                              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Nenhum item encontrado.</td></tr>
                            ) : (
                              itensFiltrados.map((item) => {
                                const baixo = numero(item.quantidade) <= numero(item.estoque_minimo)
                                return (
                                  <tr key={item.id} className="hover:bg-cyan-500/5 transition-colors">
                                    <td className="px-5 py-3.5">
                                      <div className="font-medium text-white">{item.nome}</div>
                                      <div className="text-xs text-slate-500">{item.codigo || 'Sem codigo'}</div>
                                    </td>
                                    <td className="px-5 py-3.5 text-cyan-300 font-semibold">{formatarNumero(item.quantidade)} {item.unidade || 'UN'}</td>
                                    <td className="px-5 py-3.5 text-slate-400">{formatarNumero(item.estoque_minimo)}</td>
                                    <td className="px-5 py-3.5 text-slate-400">{item.localizacao || '-'}</td>
                                    <td className="px-5 py-3.5">
                                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${baixo ? 'bg-orange-500/15 text-orange-300 border-orange-500/25' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'}`}>
                                        {baixo ? 'Baixo' : 'OK'}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                )}

                {aba === 'movimentos' && (
                  <div className="animate-tab grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
                    <section className="bg-[#0f1c2e] border border-cyan-500/15 rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/5 bg-[#132337]/60">
                        <h2 className="text-base font-semibold text-white">Movimentar Estoque</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Entradas, saidas e ajustes manuais</p>
                      </div>
                      <form onSubmit={registrarMovimento} className="p-5 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Item *</label>
                          <select value={itemMovimentoId} onChange={(e) => setItemMovimentoId(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40">
                            <option value="">Selecione...</option>
                            {itens.map((item) => <option key={item.id} value={item.id}>{item.nome} - saldo {formatarNumero(item.quantidade)}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <button type="button" onClick={() => setTipoMovimento('entrada')} className={`py-2.5 rounded-xl text-sm font-semibold border transition ${tipoMovimento === 'entrada' ? 'bg-emerald-500 text-[#0a1625] border-emerald-400' : 'bg-[#132337] text-slate-400 border-white/10 hover:text-white'}`}>Entrada</button>
                          <button type="button" onClick={() => setTipoMovimento('saida')} className={`py-2.5 rounded-xl text-sm font-semibold border transition ${tipoMovimento === 'saida' ? 'bg-orange-500 text-[#0a1625] border-orange-400' : 'bg-[#132337] text-slate-400 border-white/10 hover:text-white'}`}>Saida</button>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Quantidade *</label>
                          <input type="number" min="0.01" step="0.01" value={quantidadeMovimento} onChange={(e) => setQuantidadeMovimento(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Observacao</label>
                          <textarea rows={3} value={observacaoMovimento} onChange={(e) => setObservacaoMovimento(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40 resize-none" />
                        </div>
                        <button disabled={salvando} className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#0a1625] font-semibold py-3 rounded-xl transition disabled:opacity-50">
                          {salvando ? 'Salvando...' : 'Registrar Movimento'}
                        </button>
                      </form>
                    </section>

                    <section className="bg-[#0f1c2e] border border-cyan-500/15 rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/5 bg-[#132337]/60 flex items-center justify-between gap-3">
                        <h2 className="text-base font-semibold text-white">Historico de Movimentos</h2>
                        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar movimento..." className="w-72 px-4 py-2 bg-[#0a1625] border border-cyan-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                      </div>
                      <div className="max-h-[58vh] overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-[#132337] border-b border-cyan-500/15 sticky top-0 z-10">
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Item</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Tipo</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Qtd</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Origem</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Data</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {movimentosFiltrados.length === 0 ? (
                              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Nenhum movimento encontrado.</td></tr>
                            ) : movimentosFiltrados.map((movimento) => (
                              <tr key={movimento.id} className="hover:bg-cyan-500/5 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="font-medium text-white">{movimento.estoque_itens?.nome || 'Item removido'}</div>
                                  <div className="text-xs text-slate-500">{movimento.observacao || movimento.estoque_itens?.codigo || '-'}</div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${movimento.tipo === 'entrada' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'bg-orange-500/15 text-orange-300 border-orange-500/25'}`}>
                                    {movimento.tipo === 'entrada' ? 'Entrada' : 'Saida'}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-cyan-300 font-semibold">{formatarNumero(movimento.quantidade)} {movimento.estoque_itens?.unidade || 'UN'}</td>
                                <td className="px-5 py-3.5 text-slate-400">{movimento.origem || '-'}</td>
                                <td className="px-5 py-3.5 text-slate-500 text-xs">{formatarData(movimento.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                )}

                {aba === 'compras' && (
                  <div className="animate-tab grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
                    <section className="bg-[#0f1c2e] border border-cyan-500/15 rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/5 bg-[#132337]/60">
                        <h2 className="text-base font-semibold text-white">Nova Ordem de Compra</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Crie uma ordem simples para recebimento futuro</p>
                      </div>
                      <form onSubmit={criarOrdem} className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Numero</label>
                            <input value={numeroOrdem} onChange={(e) => setNumeroOrdem(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Fornecedor</label>
                            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Item *</label>
                          <select value={itemOrdemId} onChange={(e) => setItemOrdemId(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40">
                            <option value="">Selecione...</option>
                            {itens.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Quantidade *</label>
                          <input type="number" min="0.01" step="0.01" value={quantidadeOrdem} onChange={(e) => setQuantidadeOrdem(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Observacao</label>
                          <textarea rows={3} value={observacaoOrdem} onChange={(e) => setObservacaoOrdem(e.target.value)} className="w-full px-4 py-2.5 bg-[#132337] border border-cyan-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40 resize-none" />
                        </div>
                        <button disabled={salvando} className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#0a1625] font-semibold py-3 rounded-xl transition disabled:opacity-50">
                          {salvando ? 'Salvando...' : 'Criar Ordem'}
                        </button>
                      </form>
                    </section>

                    <section className="bg-[#0f1c2e] border border-cyan-500/15 rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/5 bg-[#132337]/60 flex items-center justify-between gap-3">
                        <h2 className="text-base font-semibold text-white">Ordens de Compra</h2>
                        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar OC..." className="w-72 px-4 py-2 bg-[#0a1625] border border-cyan-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
                      </div>
                      <div className="max-h-[58vh] overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-[#132337] border-b border-cyan-500/15 sticky top-0 z-10">
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">OC</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Item</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Qtd</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Status</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-cyan-300 uppercase">Acao</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {ordensFiltradas.length === 0 ? (
                              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Nenhuma ordem encontrada.</td></tr>
                            ) : ordensFiltradas.map((ordem) => {
                              const itemOrdem = ordem.ordens_compra_itens?.[0]
                              return (
                                <tr key={ordem.id} className="hover:bg-cyan-500/5 transition-colors">
                                  <td className="px-5 py-3.5">
                                    <div className="font-medium text-white">{ordem.numero || `OC-${ordem.id}`}</div>
                                    <div className="text-xs text-slate-500">{ordem.fornecedor || 'Fornecedor nao informado'}</div>
                                  </td>
                                  <td className="px-5 py-3.5 text-slate-300">{itemOrdem?.estoque_itens?.nome || '-'}</td>
                                  <td className="px-5 py-3.5 text-cyan-300 font-semibold">{formatarNumero(itemOrdem?.quantidade)} {itemOrdem?.estoque_itens?.unidade || 'UN'}</td>
                                  <td className="px-5 py-3.5">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${ordem.status === 'aberta' ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' : ordem.status === 'recebida' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'bg-red-500/15 text-red-300 border-red-500/25'}`}>
                                      {ordem.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5">
                                    {ordem.status === 'aberta' ? (
                                      <button type="button" onClick={() => receberOrdem(ordem)} disabled={salvando} className="bg-emerald-500 hover:bg-emerald-400 text-[#0a1625] text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                                        Receber
                                      </button>
                                    ) : (
                                      <span className="text-xs text-slate-500">{formatarData(ordem.recebida_em || ordem.created_at)}</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </RequirePermissao>
  )
}
