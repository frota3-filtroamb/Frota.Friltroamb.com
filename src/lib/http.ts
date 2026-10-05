export async function lerJsonSeguro(resposta: Response): Promise<Record<string, unknown>> {
  const texto = await resposta.text()

  if (!texto.trim()) {
    return {}
  }

  try {
    return JSON.parse(texto) as Record<string, unknown>
  } catch {
    throw new Error(`Resposta invalida do servidor (${resposta.status}).`)
  }
}
