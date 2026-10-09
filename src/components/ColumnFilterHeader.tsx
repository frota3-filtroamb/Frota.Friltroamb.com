'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ColumnFilterHeaderProps<TColuna extends string> = {
  coluna: TColuna
  label: string
  selecionados: string[]
  opcoes: string[]
  aberto: boolean
  ativo: boolean
  onAbrir: (coluna: TColuna) => void
  onAlternar: (coluna: TColuna, valor: string) => void
  onFechar: () => void
  onLimpar: (coluna: TColuna) => void
  className?: string
}

export default function ColumnFilterHeader<TColuna extends string>({
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
  className = 'px-3 py-2.5 text-center text-[13px] font-semibold text-emerald-400/90 uppercase tracking-wide whitespace-nowrap',
}: ColumnFilterHeaderProps<TColuna>) {
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
        left: Math.min(Math.max(rect.left, margem), window.innerWidth - margem - larguraMenu),
      }
      setPosicaoMenu(proximaPosicao)
    }

    function fecharAoClicarFora(event: PointerEvent) {
      const target = event.target as Node
      if (!filtroRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        onFechar()
      }
    }

    atualizarPosicao()
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
    <th ref={filtroRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => onAbrir(coluna)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 transition cursor-pointer ${ativo ? 'bg-emerald-500/15 text-emerald-300' : 'hover:bg-white/5'}`}
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
              className="text-[11px] font-semibold normal-case tracking-normal text-emerald-300 hover:text-emerald-200 cursor-pointer"
            >
              Limpar
            </button>
          </div>

          <div className="app-scroll max-h-56 overflow-y-auto pr-1">
            {opcoes.length === 0 ? (
              <p className="px-2 py-2 text-xs normal-case tracking-normal text-slate-500">Sem opcoes.</p>
            ) : (
              opcoes.map((opcao) => (
                <label key={opcao} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs normal-case tracking-normal text-slate-300 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={selecionados.includes(opcao)}
                    onChange={() => onAlternar(coluna, opcao)}
                    className="h-3.5 w-3.5 accent-emerald-500"
                  />
                  <span className="truncate">{opcao}</span>
                </label>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </th>
  )
}
