import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { podeAcessar } from '@/lib/roles'

type Body = Record<string, unknown>

type EstoqueItem = {
  id: number
  quantidade: number | string | null
  unidade: string | null
}

type OrdemCompraItem = {
  id: number
  ordem_id: number
  item_id: number
  quantidade: number | string
  quantidade_recebida: number | string | null
}

type OrdemCompra = {
  id: number
  numero: string | null
  ordens_compra_itens?: OrdemCompraItem[]
}

function texto(valor: unknown) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

function numero(valor: unknown) {
  const parsed = typeof valor === 'number' ? valor : Number(valor || 0)
  return Number.isFinite(parsed) ? parsed : null
}

function inteiro(valor: unknown) {
  const parsed = typeof valor === 'number' ? valor : Number(valor)
  return Number.isInteger(parsed) ? parsed : null
}

function formatarNumero(valor: unknown) {
  return Number(valor ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function nomeResponsavel(operador: Awaited<ReturnType<typeof currentUser>>) {
  return operador?.fullName ||
    operador?.primaryEmailAddress?.emailAddress ||
    'Sistema'
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  if (!podeAcessar(operador, 'almoxarifado')) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const body = (await request.json()) as Body
  const acao = texto(body.acao)
  const supabase = createAdminClient()
  const usuarioAtual = nomeResponsavel(operador)

  if (acao === 'criar_item') {
    const nome = texto(body.nome)
    const quantidade = numero(body.quantidade) ?? 0
    const minimo = numero(body.estoque_minimo) ?? 0

    if (!nome) return NextResponse.json({ error: 'Informe o nome do item.' }, { status: 400 })
    if (quantidade < 0 || minimo < 0) {
      return NextResponse.json({ error: 'Quantidade e estoque minimo nao podem ser negativos.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('estoque_itens')
      .insert({
        codigo: texto(body.codigo),
        nome,
        unidade: texto(body.unidade) || 'UN',
        quantidade,
        estoque_minimo: minimo,
        localizacao: texto(body.localizacao),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (quantidade > 0 && data) {
      const { error: movimentoError } = await supabase.from('estoque_movimentos').insert({
        item_id: data.id,
        tipo: 'entrada',
        quantidade,
        origem: 'manual',
        observacao: 'Saldo inicial',
        criado_por: usuarioAtual,
      })

      if (movimentoError) {
        return NextResponse.json({ error: `Item criado, mas erro ao registrar historico: ${movimentoError.message}` }, { status: 400 })
      }
    }

    return NextResponse.json({ mensagem: 'Item cadastrado com sucesso.' })
  }

  if (acao === 'registrar_movimento') {
    const itemId = inteiro(body.item_id)
    const quantidade = numero(body.quantidade)
    const tipoMovimento = texto(body.tipo)

    if (!itemId || !quantidade || quantidade <= 0 || (tipoMovimento !== 'entrada' && tipoMovimento !== 'saida')) {
      return NextResponse.json({ error: 'Selecione um item e informe uma quantidade maior que zero.' }, { status: 400 })
    }

    const { data: item, error: buscaError } = await supabase
      .from('estoque_itens')
      .select('*')
      .eq('id', itemId)
      .single<EstoqueItem>()

    if (buscaError || !item) {
      return NextResponse.json({ error: 'Erro ao buscar saldo atual: ' + (buscaError?.message || 'item nao encontrado.') }, { status: 400 })
    }

    const saldoAtual = Number(item.quantidade ?? 0)
    const novoSaldo = tipoMovimento === 'entrada' ? saldoAtual + quantidade : saldoAtual - quantidade

    if (novoSaldo < 0) {
      return NextResponse.json({ error: `Saida maior que o saldo atual (${formatarNumero(item.quantidade)} ${item.unidade || 'UN'}).` }, { status: 400 })
    }

    const { error: itemError } = await supabase
      .from('estoque_itens')
      .update({ quantidade: novoSaldo })
      .eq('id', item.id)

    if (itemError) return NextResponse.json({ error: 'Erro ao atualizar saldo: ' + itemError.message }, { status: 400 })

    const { error: movError } = await supabase.from('estoque_movimentos').insert({
      item_id: item.id,
      tipo: tipoMovimento,
      quantidade,
      origem: 'manual',
      observacao: texto(body.observacao),
      criado_por: usuarioAtual,
    })

    if (movError) {
      return NextResponse.json({ error: 'Saldo atualizado, mas erro ao registrar historico: ' + movError.message }, { status: 400 })
    }

    return NextResponse.json({ mensagem: 'Movimento registrado com sucesso.', quantidade: novoSaldo })
  }

  if (acao === 'criar_ordem') {
    const itemId = inteiro(body.item_id)
    const quantidade = numero(body.quantidade)

    if (!itemId || !quantidade || quantidade <= 0) {
      return NextResponse.json({ error: 'Selecione um item e informe a quantidade da ordem.' }, { status: 400 })
    }

    const { data: ordem, error } = await supabase
      .from('ordens_compra')
      .insert({
        numero: texto(body.numero),
        fornecedor: texto(body.fornecedor),
        comprador: usuarioAtual,
        observacao: texto(body.observacao),
        status: 'aberta',
      })
      .select()
      .single()

    if (error || !ordem) {
      return NextResponse.json({ error: 'Erro ao criar ordem: ' + (error?.message || 'ordem nao retornada.') }, { status: 400 })
    }

    const { error: itemError } = await supabase.from('ordens_compra_itens').insert({
      ordem_id: ordem.id,
      item_id: itemId,
      quantidade,
      quantidade_recebida: 0,
    })

    if (itemError) {
      return NextResponse.json({ error: 'Ordem criada, mas erro ao incluir item: ' + itemError.message }, { status: 400 })
    }

    return NextResponse.json({ mensagem: 'Ordem de compra criada com sucesso.' })
  }

  if (acao === 'receber_ordem') {
    const ordemId = inteiro(body.ordem_id)
    if (!ordemId) return NextResponse.json({ error: 'Ordem obrigatoria.' }, { status: 400 })

    const { data: ordem, error: ordemBuscaError } = await supabase
      .from('ordens_compra')
      .select('id, numero, ordens_compra_itens(*)')
      .eq('id', ordemId)
      .single<OrdemCompra>()

    if (ordemBuscaError || !ordem) {
      return NextResponse.json({ error: 'Ordem nao encontrada.' }, { status: 400 })
    }

    const itemOrdem = ordem.ordens_compra_itens?.[0]
    if (!itemOrdem) return NextResponse.json({ error: 'Ordem sem item para recebimento.' }, { status: 400 })

    const { data: item, error: itemBuscaError } = await supabase
      .from('estoque_itens')
      .select('*')
      .eq('id', itemOrdem.item_id)
      .single<EstoqueItem>()

    if (itemBuscaError || !item) {
      return NextResponse.json({ error: 'Item da ordem nao foi encontrado no estoque.' }, { status: 400 })
    }

    const quantidadeTotal = Number(itemOrdem.quantidade ?? 0)
    const quantidadeRecebida = Number(itemOrdem.quantidade_recebida ?? 0)
    const quantidadePendente = quantidadeTotal - quantidadeRecebida

    if (quantidadePendente <= 0) {
      return NextResponse.json({ error: 'Esta ordem ja foi recebida.' }, { status: 400 })
    }

    const novoSaldo = Number(item.quantidade ?? 0) + quantidadePendente
    const recebidoEm = new Date().toISOString()

    const { error: estoqueError } = await supabase.from('estoque_itens').update({ quantidade: novoSaldo }).eq('id', item.id)
    if (estoqueError) return NextResponse.json({ error: 'Erro ao atualizar estoque: ' + estoqueError.message }, { status: 400 })

    const { error: ordemItemError } = await supabase
      .from('ordens_compra_itens')
      .update({ quantidade_recebida: quantidadeTotal })
      .eq('id', itemOrdem.id)

    if (ordemItemError) {
      return NextResponse.json({ error: 'Estoque atualizado, mas erro ao atualizar item da OC: ' + ordemItemError.message }, { status: 400 })
    }

    const { error: ordemError } = await supabase
      .from('ordens_compra')
      .update({ status: 'recebida', recebida_em: recebidoEm })
      .eq('id', ordem.id)

    if (ordemError) return NextResponse.json({ error: 'Erro ao finalizar ordem: ' + ordemError.message }, { status: 400 })

    const { error: movimentoError } = await supabase.from('estoque_movimentos').insert({
      item_id: item.id,
      tipo: 'entrada',
      quantidade: quantidadePendente,
      origem: 'ordem_compra',
      referencia_id: ordem.id,
      observacao: `Recebimento da OC ${ordem.numero || ordem.id}`,
      criado_por: usuarioAtual,
    })

    if (movimentoError) {
      return NextResponse.json({ error: 'Ordem recebida, mas erro ao registrar historico: ' + movimentoError.message }, { status: 400 })
    }

    return NextResponse.json({ mensagem: 'Ordem recebida e estoque atualizado.' })
  }

  return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
}
