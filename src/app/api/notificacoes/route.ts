import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRole, podeAcessar } from '@/lib/roles'

type Movimentacao = {
  id: number
  placa: string
  motorista: string | null
  destino: string | null
  liberado_em: string | null
  entrada_em: string | null
  gestor_responsavel_email: string | null
  gestor_responsavel_nome: string | null
  gestor_responsavel_setor: string | null
}

type AcaoMovimentacao = {
  entidade_id: number | string | null
  data_acao: string
}

function podeVerAutorizacoes(operador: Awaited<ReturnType<typeof currentUser>>) {
  return Boolean(
    operador &&
    (podeAcessar(operador, 'portaria') || podeAcessar(operador, 'portaria.veiculos'))
  )
}

export async function GET() {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  if (!podeVerAutorizacoes(operador)) {
    return NextResponse.json({ notificacoes: [] })
  }

  const role = getRole(operador)
  const emailOperador = operador.primaryEmailAddress?.emailAddress?.toLowerCase() || ''
  const supabase = createAdminClient()

  const [movimentacoesQuery, autorizacoesQuery] = await Promise.all([
    supabase
      .from('movimentacoes')
      .select('id, placa, motorista, destino, liberado_em, entrada_em, gestor_responsavel_email, gestor_responsavel_nome, gestor_responsavel_setor')
      .eq('tipo_veiculo', 'externo')
      .is('saida_em', null)
      .order('liberado_em', { ascending: false })
      .returns<Movimentacao[]>(),
    supabase
      .from('TBL_HISTORICOS_ACOES')
      .select('entidade_id, data_acao')
      .eq('tipo_entidade', 'veiculo')
      .eq('acao', 'saida_autorizada')
      .returns<AcaoMovimentacao[]>(),
  ])

  if (movimentacoesQuery.error) {
    return NextResponse.json({ error: movimentacoesQuery.error.message }, { status: 400 })
  }

  if (autorizacoesQuery.error) {
    return NextResponse.json({ error: autorizacoesQuery.error.message }, { status: 400 })
  }

  const autorizacoes = new Map<number, string>()
  ;(autorizacoesQuery.data || []).forEach((acao) => {
    if (acao.entidade_id) autorizacoes.set(Number(acao.entidade_id), acao.data_acao)
  })

  const notificacoesGestor = (movimentacoesQuery.data || [])
    .filter((movimentacao) => Boolean(movimentacao.entrada_em))
    .filter((movimentacao) => !autorizacoes.has(movimentacao.id))
    .filter((movimentacao) => {
      if (role !== 'gestor') return role === 'dev' || role === 'editor'
      return Boolean(emailOperador && movimentacao.gestor_responsavel_email?.toLowerCase() === emailOperador)
    })
    .map((movimentacao) => ({
      id: `autorizacao-saida-${movimentacao.id}`,
      tipo: 'autorizacao_saida',
      titulo: `Veiculo ${movimentacao.placa} aguardando autorizacao`,
      descricao: `${movimentacao.motorista || 'Motorista nao informado'} - ${movimentacao.destino || 'Destino nao informado'}`,
      data: movimentacao.entrada_em || movimentacao.liberado_em,
      href: '/liberacao?aba=autorizacoes',
      placa: movimentacao.placa,
      gestor: movimentacao.gestor_responsavel_nome,
      setor: movimentacao.gestor_responsavel_setor,
    }))

  const notificacoesPortaria = (movimentacoesQuery.data || [])
    .filter((movimentacao) => autorizacoes.has(movimentacao.id))
    .filter(() => role === 'porteiro' || role === 'dev' || role === 'editor')
    .map((movimentacao) => ({
      id: `saida-liberada-portaria-${movimentacao.id}`,
      tipo: 'saida_liberada_portaria',
      titulo: `Saida liberada para ${movimentacao.placa}`,
      descricao: `${movimentacao.motorista || 'Motorista nao informado'} - registre a saida na portaria`,
      data: autorizacoes.get(movimentacao.id) || movimentacao.entrada_em || movimentacao.liberado_em,
      href: '/portaria?aba=veiculos',
      placa: movimentacao.placa,
      gestor: movimentacao.gestor_responsavel_nome,
      setor: movimentacao.gestor_responsavel_setor,
    }))

  const notificacoes = [...notificacoesGestor, ...notificacoesPortaria]
    .sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime())

  return NextResponse.json({ notificacoes })
}
