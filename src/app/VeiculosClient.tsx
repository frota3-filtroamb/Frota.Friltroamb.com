'use client'

import { useTopbarSearch } from '@/components/TopbarSearchProvider'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Veiculo = {
  NR_PLACA: string
  DS_MODELO: string | null
  DS_MARCA: string | null
  NR_ANO_MODELO: number | null
  DS_COR: string | null
  DS_CHASSI: string | null
  DS_COMBUSTIVEL: string | null
  DS_TIPOVEICULO: string | null
}

type ColunaFiltro = 'placa' | 'modelo' | 'marca' | 'ano' | 'cor' | 'combustivel' | 'setor'
type Filtros = Record<ColunaFiltro, string[]>

const FILTROS_INICIAIS: Filtros = {
  placa: [],
  modelo: [],
  marca: [],
  ano: [],
  cor: [],
  combustivel: [],
  setor: [],
}

function CabecalhoFiltro({
  coluna,
  label,
  selecionados,
  opcoes,
  aberto,
  ativo,
  onAbrir,
  onAlternar,
  onFechar,
  onLimpar,
}: {
  coluna: ColunaFiltro
  label: string
  selecionados: string[]
  opcoes: string[]
  aberto: boolean
  ativo: boolean
  onAbrir: (coluna: ColunaFiltro) => void
  onAlternar: (coluna: ColunaFiltro, valor: string) => void
  onFechar: () => void
  onLimpar: (coluna: ColunaFiltro) => void
}) {
  const filtroRef = useRef<HTMLTableCellElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [montado, setMontado] = useState(false)
  const [posicaoMenu, setPosicaoMenu] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    setMontado(true)
  }, [])

  useEffect(() => {
    if (!aberto) {
      setPosicaoMenu(null)
      return
    }

    function atualizarPosicao() {
      const rect = filtroRef.current?.getBoundingClientRect()
      if (!rect) return
      const larguraMenu = 240
      const margem = 12
      const proximaPosicao = {
        top: rect.bottom + 8,
        left: Math.min(
          Math.max(rect.left, margem),
          window.innerWidth - margem - larguraMenu,
        ),
      }
      setPosicaoMenu(proximaPosicao)
    }

    atualizarPosicao()

    function fecharAoClicarFora(event: PointerEvent) {
      const target = event.target as Node
      if (!filtroRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        onFechar()
      }
    }

    document.addEventListener('pointerdown', fecharAoClicarFora)
    window.addEventListener('resize', atualizarPosicao)
    window.addEventListener('scroll', atualizarPosicao, true)

    return () => {
      document.removeEventListener('pointerdown', fecharAoClicarFora)
      window.removeEventListener('resize', atualizarPosicao)
      window.removeEventListener('scroll', atualizarPosicao, true)
    }
  }, [aberto, onFechar])

  return (
    <th ref={filtroRef} className="relative px-4 py-3.5 text-center text-lg font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">
      <button
        type="button"
        onClick={() => onAbrir(coluna)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 transition ${ativo ? 'bg-emerald-500/15 text-emerald-300' : 'hover:bg-white/5'}`}
      >
        <span>{label}</span>
        <span className="text-[11px]">{aberto ? '^' : 'v'}</span>
      </button>

      {aberto && montado && posicaoMenu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-[240px] rounded-lg border border-emerald-500/20 bg-[#0f1c2e] p-2 text-left shadow-2xl shadow-black/40"
          style={{ top: posicaoMenu.top, left: posicaoMenu.left }}
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Filtrar
            </span>
            <button
              type="button"
              onClick={() => onLimpar(coluna)}
              className="text-[11px] font-semibold normal-case tracking-normal text-emerald-300 hover:text-emerald-200"
            >
              Limpar
            </button>
          </div>

          <div className="app-scroll max-h-56 overflow-y-auto pr-1">
            {opcoes.map((opcao) => (
              <label key={opcao} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs normal-case tracking-normal text-slate-300 hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={selecionados.includes(opcao)}
                  onChange={() => onAlternar(coluna, opcao)}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <span className="truncate">{opcao}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </th>
  )
}

export default function VeiculosClient({ veiculos }: { veiculos: Veiculo[] }) {
  const { busca } = useTopbarSearch()
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS)
  const [menuAberto, setMenuAberto] = useState<ColunaFiltro | null>(null)

  const valorColuna = (veiculo: Veiculo, coluna: ColunaFiltro) => {
    if (coluna === 'placa') return veiculo.NR_PLACA || 'Sem placa'
    if (coluna === 'modelo') return veiculo.DS_MODELO || 'Nao informado'
    if (coluna === 'marca') return veiculo.DS_MARCA || 'Nao informado'
    if (coluna === 'ano') return veiculo.NR_ANO_MODELO ? String(veiculo.NR_ANO_MODELO) : 'Nao informado'
    if (coluna === 'cor') return veiculo.DS_COR || 'Nao informado'
    if (coluna === 'combustivel') return veiculo.DS_COMBUSTIVEL || 'Nao informado'
    return veiculo.DS_TIPOVEICULO || 'Nao informado'
  }

  const opcoesPorColuna = useMemo(() => {
    const colunas: ColunaFiltro[] = ['placa', 'modelo', 'marca', 'ano', 'cor', 'combustivel', 'setor']
    return colunas.reduce((acc, coluna) => {
      acc[coluna] = Array.from(new Set(veiculos.map((veiculo) => valorColuna(veiculo, coluna))))
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      return acc
    }, {} as Record<ColunaFiltro, string[]>)
  }, [veiculos])

  const textoBusca = busca.toLowerCase().trim()
  const veiculosFiltrados = veiculos.filter((veiculo) => {
    const passaBusca =
      !textoBusca ||
      veiculo.NR_PLACA?.toLowerCase().includes(textoBusca) ||
      veiculo.DS_MODELO?.toLowerCase().includes(textoBusca) ||
      veiculo.DS_MARCA?.toLowerCase().includes(textoBusca) ||
      String(veiculo.NR_ANO_MODELO || '').includes(textoBusca) ||
      veiculo.DS_COR?.toLowerCase().includes(textoBusca) ||
      veiculo.DS_COMBUSTIVEL?.toLowerCase().includes(textoBusca) ||
      veiculo.DS_TIPOVEICULO?.toLowerCase().includes(textoBusca)

    if (!passaBusca) return false

    return (Object.keys(filtros) as ColunaFiltro[]).every((coluna) => {
      const selecionados = filtros[coluna]
      if (selecionados.length === 0) return true
      return selecionados.includes(valorColuna(veiculo, coluna))
    })
  })

  const filtrosAtivos = Object.values(filtros).some((valores) => valores.length > 0)

  function alternarFiltro(coluna: ColunaFiltro, valor: string) {
    setFiltros((atuais) => {
      const selecionados = atuais[coluna]
      const proximos = selecionados.includes(valor)
        ? selecionados.filter((item) => item !== valor)
        : [...selecionados, valor]
      return { ...atuais, [coluna]: proximos }
    })
  }

  function limparFiltro(coluna: ColunaFiltro) {
    setFiltros((atuais) => ({ ...atuais, [coluna]: [] }))
  }

  return (
    <main className="veiculos-page animate-tab flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0a1625] p-4 lg:p-5 xl:p-6">
      {filtrosAtivos && (
        <div className="mb-3 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => {
              setFiltros(FILTROS_INICIAIS)
              setMenuAberto(null)
            }}
            className="rounded-lg border border-emerald-500/20 bg-[#132337] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:text-white"
          >
            Limpar filtros
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#0f1c2e] shadow-[0_0_30px_rgba(16,185,129,0.05)]">
        <div className="app-scroll min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-emerald-500/15 bg-[#132337]">
                {([
                  ['placa', 'Placa'],
                  ['modelo', 'Modelo'],
                  ['marca', 'Marca'],
                  ['ano', 'Ano'],
                  ['cor', 'Cor'],
                  ['combustivel', 'Combustivel'],
                  ['setor', 'Setor'],
                ] as Array<[ColunaFiltro, string]>).map(([coluna, label]) => (
                  <CabecalhoFiltro
                    key={coluna}
                    coluna={coluna}
                    label={label}
                    selecionados={filtros[coluna]}
                    opcoes={opcoesPorColuna[coluna]}
                    aberto={menuAberto === coluna}
                    ativo={filtros[coluna].length > 0}
                    onAbrir={(proximaColuna) => setMenuAberto(menuAberto === proximaColuna ? null : proximaColuna)}
                    onAlternar={alternarFiltro}
                    onFechar={() => setMenuAberto(null)}
                    onLimpar={limparFiltro}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {veiculosFiltrados.map((veiculo, index) => (
                <tr
                  key={`${veiculo.NR_PLACA}-${index}`}
                  className="transition-colors hover:bg-emerald-500/5"
                >
                  <td className="px-4 py-3.5 text-center text-base font-semibold text-emerald-300 whitespace-nowrap">{veiculo.NR_PLACA}</td>
                  <td className="px-4 py-3.5 text-center text-base text-slate-300">{veiculo.DS_MODELO || '-'}</td>
                  <td className="px-4 py-3.5 text-center text-base text-slate-300">{veiculo.DS_MARCA || '-'}</td>
                  <td className="px-4 py-3.5 text-center text-base text-slate-300">{veiculo.NR_ANO_MODELO || '-'}</td>
                  <td className="px-4 py-3.5 text-center text-base text-slate-300">{veiculo.DS_COR || '-'}</td>
                  <td className="px-4 py-3.5 text-center text-base text-slate-300">{veiculo.DS_COMBUSTIVEL || '-'}</td>
                  <td className="px-4 py-3.5 text-center text-base text-slate-300">{veiculo.DS_TIPOVEICULO || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {veiculosFiltrados.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-500">
            Nenhum veiculo encontrado.
          </div>
        )}
      </div>
    </main>
  )
}
