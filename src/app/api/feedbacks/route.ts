import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Body = Record<string, unknown>

function texto(valor: unknown) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

function tipoFeedback(valor: unknown) {
  return valor === 'bug' || valor === 'ideia' || valor === 'outro' ? valor : null
}

function numero(valor: unknown) {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function nomeArquivoSeguro(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
}

export async function POST(request: NextRequest) {
  const operador = await currentUser()

  if (!operador) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  let body: Body = {}
  let arquivo: File | null = null
  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      body = {
        tipo: formData.get('tipo'),
        mensagem: formData.get('mensagem'),
        pagina: formData.get('pagina'),
      }
      const anexo = formData.get('anexo')
      arquivo = anexo instanceof File && anexo.size > 0 ? anexo : null
    } else {
      body = (await request.json()) as Body
    }
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 })
  }

  const tipo = tipoFeedback(body.tipo)
  const mensagem = texto(body.mensagem)
  const pagina = texto(body.pagina)
  const anexo = typeof body.anexo === 'object' && body.anexo !== null ? body.anexo as Body : null

  if (!tipo) {
    return NextResponse.json({ error: 'Tipo de feedback invalido.' }, { status: 400 })
  }

  if (!mensagem || mensagem.length < 8) {
    return NextResponse.json({ error: 'Descreva o feedback com pelo menos 8 caracteres.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  let anexoPath: string | null = null
  let anexoNome = texto(anexo?.nome)
  let anexoTipo = texto(anexo?.tipo)
  let anexoTamanho = numero(anexo?.tamanho)

  if (arquivo) {
    if (!arquivo.type.startsWith('image/')) {
      return NextResponse.json({ error: 'O anexo deve ser uma imagem.' }, { status: 400 })
    }

    if (arquivo.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'O anexo deve ter no maximo 5 MB.' }, { status: 400 })
    }

    const caminho = `${operador.id}/${Date.now()}-${nomeArquivoSeguro(arquivo.name)}`
    const { error: uploadError } = await supabase.storage
      .from('feedback-anexos')
      .upload(caminho, arquivo, {
        contentType: arquivo.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    anexoPath = caminho
    anexoNome = arquivo.name
    anexoTipo = arquivo.type || null
    anexoTamanho = arquivo.size
  }

  const { error } = await supabase.from('TBL_FEEDBACKS').insert({
    tipo,
    mensagem,
    pagina,
    usuario_id: operador.id,
    usuario_nome:
      operador.fullName ||
      [operador.firstName, operador.lastName].filter(Boolean).join(' ') ||
      null,
    usuario_email:
      operador.primaryEmailAddress?.emailAddress ||
      operador.emailAddresses[0]?.emailAddress ||
      null,
    anexo_path: anexoPath,
    anexo_nome: anexoNome,
    anexo_tipo: anexoTipo,
    anexo_tamanho: anexoTamanho,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ mensagem: 'Feedback enviado com sucesso.' })
}
