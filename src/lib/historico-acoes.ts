import { createAdminClient } from '@/lib/supabase/admin'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type RegistrarHistoricoAcaoParams = {
  supabase: SupabaseAdmin
  tipo_entidade: 'veiculo' | 'pedestre' | 'transferencia'
  entidade_id: number | null
  acao: string
  placa?: string | null
  data_acao?: string | null
  responsavel_nome?: string | null
  responsavel_email?: string | null
  porteiro_id?: number | null
  porteiro_nome?: string | null
  motivo?: string | null
  dados?: Record<string, unknown>
}

export async function registrarHistoricoAcao({
  supabase,
  tipo_entidade,
  entidade_id,
  acao,
  placa,
  data_acao,
  responsavel_nome,
  responsavel_email,
  porteiro_id,
  porteiro_nome,
  motivo,
  dados = {},
}: RegistrarHistoricoAcaoParams) {
  const { error } = await supabase.from('TBL_HISTORICOS_ACOES').insert({
    tipo_entidade,
    entidade_id,
    acao,
    placa: placa || null,
    data_acao: data_acao || new Date().toISOString(),
    responsavel_nome: responsavel_nome || null,
    responsavel_email: responsavel_email || null,
    porteiro_id: porteiro_id || null,
    porteiro_nome: porteiro_nome || null,
    motivo: motivo || null,
    dados,
  })

  return error ? error.message : null
}
