const RH_REGISTRO_GERAL_URL = 'https://webhook.filtroamb.com.br/webhook/rh-registro-geral'

export type RegistroRhGeral = {
  id: string
  colaborador: string | null
  cpf: string | null
  empresa: string | null
  base: string | null
  categoria: string | null
  cargo: string | null
  cnpj: string | null
  data_admissao: string | null
  data_demissao: string | null
  situacao: string | null
  centro_custo: string | null
  departamento: string | null
  origem: string | null
  origem_id: string | null
  updated_at: string | null
}

export function digitosDocumento(valor: string | null | undefined) {
  return (valor || '').replace(/\D/g, '')
}

export async function buscarRegistrosRhGeral() {
  const apiKey = process.env.RH_REGISTRO_GERAL_API_KEY || process.env.RH_API_KEY

  if (!apiKey) {
    return { data: null, error: 'RH_REGISTRO_GERAL_API_KEY ou RH_API_KEY nao configurada no servidor.' }
  }

  let resposta: Response

  try {
    resposta = await fetch(RH_REGISTRO_GERAL_URL, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
      cache: 'no-store',
    })
  } catch {
    return { data: null, error: 'Nao foi possivel conectar ao endpoint de RH.' }
  }

  const texto = await resposta.text()
  let payload: unknown = null

  if (texto) {
    try {
      payload = JSON.parse(texto)
    } catch {
      payload = texto
    }
  }

  if (!resposta.ok) {
    return {
      data: null,
      error: `Erro ao buscar registros do RH (${resposta.status}).`,
      detalhe: payload,
    }
  }

  return {
    data: Array.isArray(payload) ? payload as RegistroRhGeral[] : [],
    error: null,
  }
}
