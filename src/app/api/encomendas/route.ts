import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { podeAcessar } from '@/lib/roles'

type Body = Record<string, unknown>

function texto(valor: unknown) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

function numero(valor: unknown) {
  const parsed = typeof valor === 'number' ? valor : Number(valor)
  return Number.isInteger(parsed) ? parsed : null
}

function dataIso(valor: unknown) {
  const raw = texto(valor)
  const data = raw ? new Date(raw) : new Date()
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

type EncomendaRegistro = {
  id: number
  item: string | null
  loja_remetente: string | null
  destinatario: string | null
  status: string | null
  recebido_em: string | null
  entregue_em: string | null
  retirado_por: string | null
}

async function registrarAcao(
  supabase: ReturnType<typeof createAdminClient>,
  operador: Awaited<ReturnType<typeof currentUser>>,
  encomenda: EncomendaRegistro,
  acao: 'aviso' | 'chegada_sem_aviso' | 'confirmacao_chegada' | 'retirada',
  observacao?: string | null,
) {
  const { error } = await supabase.from('encomendas_acoes').insert({
    encomenda_id: encomenda.id,
    acao,
    item: encomenda.item,
    loja_remetente: encomenda.loja_remetente,
    destinatario: encomenda.destinatario,
    status_encomenda: encomenda.status,
    recebido_em: encomenda.recebido_em,
    entregue_em: encomenda.entregue_em,
    retirado_por: encomenda.retirado_por,
    observacao,
    responsavel_id: operador?.id || null,
    responsavel_nome: operador?.fullName || operador?.primaryEmailAddress?.emailAddress || 'Usuario',
    responsavel_email: operador?.primaryEmailAddress?.emailAddress || null,
  })

  if (error) throw error
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  if (!podeAcessar(operador, 'encomendas')) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const body = (await request.json()) as Body
  const acao = texto(body.acao)
  const supabase = createAdminClient()

  if (acao === 'registrar') {
    const item = texto(body.item)
    const destinatario = texto(body.destinatario)
    const lojaRemetente = texto(body.loja_remetente)
    const dataRegistro = dataIso(body.data)
    const tipoRegistro = texto(body.tipo_registro)
    const avisoEntrega = tipoRegistro === 'aviso_entrega'

    if (!item || !destinatario) {
      return NextResponse.json({ error: 'Preencha o item e o destinatario.' }, { status: 400 })
    }

    if (!dataRegistro) return NextResponse.json({ error: 'Data invalida.' }, { status: 400 })

    const { data: encomenda, error } = await supabase.from('encomendas').insert({
      item,
      loja_remetente: lojaRemetente,
      destinatario,
      status: avisoEntrega ? 'prevista' : 'aguardando_retirada',
      recebido_por: avisoEntrega ? 'Aviso de Entrega' : 'Portaria',
      recebido_em: dataRegistro,
      entregue_em: null,
    }).select('*').single<EncomendaRegistro>()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    try {
      await registrarAcao(
        supabase,
        operador,
        encomenda,
        avisoEntrega ? 'aviso' : 'chegada_sem_aviso',
        avisoEntrega ? 'Aviso previo de encomenda.' : 'Chegada registrada diretamente pela portaria.',
      )
    } catch (acaoError) {
      return NextResponse.json(
        { error: acaoError instanceof Error ? acaoError.message : 'Erro ao registrar auditoria da encomenda.' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      mensagem: avisoEntrega
        ? 'Aviso registrado. A portaria confirma a chegada quando o produto chegar.'
        : 'Chegada registrada. Encomenda aguardando retirada.',
    })
  }

  if (acao === 'confirmar_chegada') {
    const id = numero(body.id)
    if (!id) return NextResponse.json({ error: 'ID obrigatorio.' }, { status: 400 })

    const { data: encomenda, error } = await supabase.from('encomendas').update({
      status: 'aguardando_retirada',
      recebido_em: new Date().toISOString(),
      recebido_por: 'Portaria',
    }).eq('id', id).select('*').single<EncomendaRegistro>()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    try {
      await registrarAcao(supabase, operador, encomenda, 'confirmacao_chegada', 'Chegada confirmada pela portaria.')
    } catch (acaoError) {
      return NextResponse.json(
        { error: acaoError instanceof Error ? acaoError.message : 'Erro ao registrar auditoria da encomenda.' },
        { status: 400 },
      )
    }

    return NextResponse.json({ mensagem: 'Chegada confirmada. Encomenda aguardando retirada.' })
  }

  if (acao === 'entregar') {
    const id = numero(body.id)
    const retiradoPor = texto(body.retirado_por)
    if (!id) return NextResponse.json({ error: 'ID obrigatorio.' }, { status: 400 })
    if (!retiradoPor) return NextResponse.json({ error: 'Informe quem retirou a encomenda.' }, { status: 400 })

    const { data: encomenda, error } = await supabase.from('encomendas').update({
      status: 'entregue',
      entregue_em: new Date().toISOString(),
      retirado_por: retiradoPor,
    }).eq('id', id).select('*').single<EncomendaRegistro>()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    try {
      await registrarAcao(supabase, operador, encomenda, 'retirada', `Retirado por: ${retiradoPor}`)
    } catch (acaoError) {
      return NextResponse.json(
        { error: acaoError instanceof Error ? acaoError.message : 'Erro ao registrar auditoria da encomenda.' },
        { status: 400 },
      )
    }

    return NextResponse.json({ mensagem: 'Encomenda marcada como retirada.' })
  }

  return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
}
