'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useUser } from '@clerk/nextjs'
import { KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { podeAcessarDetalhe } from '@/lib/roles'
import { formatCpf, formatPhone, formatPlate, formatPlateDisplay, onlyDigits } from '@/lib/masks'

type Veiculo = {
  NR_PLACA: string
  DS_MODELO: string | null
  DS_MARCA: string | null
  NR_ANO_MODELO: number | null
}

type Item = {
  id: number
  nome: string
}

export default function LiberacaoPage() {
  const supabase = createClient()
  const { user, isLoaded } = useUser()

  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [origens, setOrigens] = useState<Item[]>([])
  const [destinos, setDestinos] = useState<Item[]>([])
  const [motoristas, setMotoristas] = useState<Item[]>([])

  const [tipoVeiculo, setTipoVeiculo] = useState<'interno' | 'externo' | 'veiculo_interno' | 'transferencia' | 'pedestre'>('interno')
  const [movimentoVeiculoInterno, setMovimentoVeiculoInterno] = useState<'entrada' | 'saida'>('entrada')

  const [buscaPlaca, setBuscaPlaca] = useState('')
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<Veiculo | null>(null)
  const [mostrarListaPlaca, setMostrarListaPlaca] = useState(false)
  const [indicePlacaAtivo, setIndicePlacaAtivo] = useState(-1)

  const [placaExterna, setPlacaExterna] = useState('')
  const [modeloExterno, setModeloExterno] = useState('')

  const [buscaMotorista, setBuscaMotorista] = useState('')
  const [motoristaSelecionado, setMotoristaSelecionado] = useState('')
  const [mostrarListaMotorista, setMostrarListaMotorista] = useState(false)

  const [buscaOrigem, setBuscaOrigem] = useState('Matriz Filtroamb')
  const [origemSelecionada, setOrigemSelecionada] = useState('Matriz Filtroamb')
  const [mostrarListaOrigem, setMostrarListaOrigem] = useState(false)

  const [buscaDestino, setBuscaDestino] = useState('')
  const [destinoSelecionado, setDestinoSelecionado] = useState('')
  const [mostrarListaDestino, setMostrarListaDestino] = useState(false)

  const [km, setKm] = useState('')
  const [dataHora, setDataHora] = useState('')

  // States specific to Transferencia
  const [baseOrigem, setBaseOrigem] = useState('')
  const [baseDestino, setBaseDestino] = useState('')
  const [mostrarListaBaseOrigem, setMostrarListaBaseOrigem] = useState(false)
  const [mostrarListaBaseDestino, setMostrarListaBaseDestino] = useState(false)

  // States specific to Pedestre
  const [nomePedestre, setNomePedestre] = useState('')
  const [cpfPedestre, setCpfPedestre] = useState('')
  const [telefonePedestre, setTelefonePedestre] = useState('')
  const [empresaPedestre, setEmpresaPedestre] = useState('')

  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const podeVeiculoEmpresa = podeAcessarDetalhe(user, 'liberacao', 'liberacao.veiculo_empresa')
  const podeVeiculoExterno = podeAcessarDetalhe(user, 'liberacao', 'liberacao.veiculo_externo')
  const podePedestre = podeAcessarDetalhe(user, 'liberacao', 'liberacao.pedestre')
  const podeTransferencia = podeAcessarDetalhe(user, 'liberacao', 'liberacao.transferencia')
  const podeVeiculoInterno = podeAcessarDetalhe(user, 'liberacao', 'liberacao.veiculo_interno')
  const identificadorLiberacao =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    'Usuario nao identificado'

  const tiposPermitidos = [
    podeVeiculoEmpresa ? 'interno' : null,
    podeVeiculoExterno ? 'externo' : null,
    podePedestre ? 'pedestre' : null,
    podeTransferencia ? 'transferencia' : null,
    podeVeiculoInterno ? 'veiculo_interno' : null,
  ].filter(Boolean) as typeof tipoVeiculo[]

  const placaExternaNormalizada = formatPlate(placaExterna)
  const placaExternaPertenceEmpresa =
    tipoVeiculo === 'externo' &&
    placaExternaNormalizada.length === 7 &&
    veiculos.some((veiculo) => formatPlate(veiculo.NR_PLACA || '') === placaExternaNormalizada)
  const mensagemListaPlaca = veiculos.length === 0
    ? 'Nenhum veiculo carregado.'
    : 'Nenhuma placa encontrada.'

  const veiculosFiltradosPorPlaca = useMemo(() => {
    const buscaNormalizada = formatPlate(buscaPlaca)
    if (!buscaNormalizada) return []

    return Array.from(
      new Map(
        veiculos
          .filter((veiculo) => formatPlate(veiculo.NR_PLACA || '').includes(buscaNormalizada))
          .map((veiculo) => [veiculo.NR_PLACA, veiculo]),
      ).values(),
    ).slice(0, 8)
  }, [buscaPlaca, veiculos])

  function selecionarVeiculoPorPlaca(veiculo: Veiculo) {
    setVeiculoSelecionado(veiculo)
    setBuscaPlaca(formatPlateDisplay(veiculo.NR_PLACA))
    setMostrarListaPlaca(false)
    setIndicePlacaAtivo(-1)
  }

  function navegarListaPlaca(event: KeyboardEvent<HTMLInputElement>) {
    if (!mostrarListaPlaca || veiculoSelecionado || veiculosFiltradosPorPlaca.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndicePlacaAtivo((indice) => (indice + 1) % veiculosFiltradosPorPlaca.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndicePlacaAtivo((indice) => (indice <= 0 ? veiculosFiltradosPorPlaca.length - 1 : indice - 1))
      return
    }

    if (event.key === 'Enter') {
      const selecionado = veiculosFiltradosPorPlaca[indicePlacaAtivo >= 0 ? indicePlacaAtivo : 0]
      if (selecionado) {
        event.preventDefault()
        selecionarVeiculoPorPlaca(selecionado)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setMostrarListaPlaca(false)
      setIndicePlacaAtivo(-1)
    }
  }

  async function registrarLiberacaoSegura(dados: Record<string, unknown>) {
    const resposta = await fetch('/api/liberacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
    const resultado = await resposta.json()

    if (!resposta.ok) {
      throw new Error(resultado.error || 'Erro ao registrar liberacao.')
    }

    return typeof resultado.mensagem === 'string' ? resultado.mensagem : 'Registro criado com sucesso.'
  }

  async function carregarDados() {
    const [v, o, d, m] = await Promise.all([
      supabase.from('veiculos').select('NR_PLACA, DS_MODELO, DS_MARCA, NR_ANO_MODELO').order('NR_PLACA'),
      supabase.from('origens').select('id, nome').order('nome'),
      supabase.from('destinos').select('id, nome').order('nome'),
      supabase.from('motoristas').select('id, nome').order('nome'),
    ])
    if (v.data) setVeiculos(v.data)
    if (o.data) setOrigens(o.data)
    if (d.data) setDestinos(d.data)
    if (m.data) setMotoristas(m.data)
  }

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    if (!isLoaded || tiposPermitidos.length === 0 || tiposPermitidos.includes(tipoVeiculo)) return
    setTipoVeiculo(tiposPermitidos[0])
    setMensagem('')
  }, [isLoaded, tiposPermitidos, tipoVeiculo])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setMostrarListaPlaca(false)
        setMostrarListaMotorista(false)
        setMostrarListaOrigem(false)
        setMostrarListaDestino(false)
        setMostrarListaBaseOrigem(false)
        setMostrarListaBaseDestino(false)
        setIndicePlacaAtivo(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function validarKmVeiculo(placa: string) {
    const kmAtual = Number(km.replace(/\D/g, ''))

    if (!Number.isFinite(kmAtual) || kmAtual <= 0) {
      setMensagem('Informe um KM maior que zero')
      return null
    }

    const { data, error } = await supabase
      .from('movimentacoes')
      .select('km')
      .eq('placa', placa)
      .not('km', 'is', null)
      .order('km', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      setMensagem('Erro ao validar KM: ' + error.message)
      return null
    }

    const ultimoKm = Number(data?.km ?? 0)
    if (kmAtual < ultimoKm) {
      setMensagem(`KM informado nao pode ser menor que o ultimo registrado (${ultimoKm})`)
      return null
    }

    return kmAtual
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!tiposPermitidos.includes(tipoVeiculo)) {
      setMensagem('Voce nao tem permissao para acessar este topico.')
      return
    }

    if (tipoVeiculo === 'veiculo_interno') {
      await registrarMovimentoVeiculoInterno()
      return
    }

    if (tipoVeiculo === 'pedestre') {
      if (!nomePedestre) {
        setMensagem('Preencha o nome do pedestre/visitante')
        return
      }
      if (!destinoSelecionado && !buscaDestino) {
        setMensagem('Selecione o destino (ex: Setor Comercial, Diretoria, etc)')
        return
      }
      if (cpfPedestre && onlyDigits(cpfPedestre).length !== 11) {
        setMensagem('Informe um CPF com 11 digitos')
        return
      }
      if (telefonePedestre) {
        const telefoneDigits = onlyDigits(telefonePedestre)
        if (telefoneDigits.length < 10 || telefoneDigits.length > 11) {
          setMensagem('Informe um telefone com DDD')
          return
        }
      }

      setCarregando(true)
      setMensagem('')

      try {
        const mensagemSucesso = await registrarLiberacaoSegura({
          tipo: 'pedestre',
          nome: nomePedestre,
          cpf_rg: cpfPedestre || null,
          telefone: telefonePedestre || null,
          empresa: empresaPedestre || null,
          destino: destinoSelecionado || buscaDestino,
          liberado_em: dataHora || null,
        })
        setMensagem(mensagemSucesso)
      } catch (error) {
        setMensagem(error instanceof Error ? `Erro ao liberar pedestre: ${error.message}` : 'Erro ao liberar pedestre.')
        return
      } finally {
        setCarregando(false)
      }
      setNomePedestre('')
      setCpfPedestre('')
      setTelefonePedestre('')
      setEmpresaPedestre('')
      setDestinoSelecionado('')
      setBuscaDestino('')
      setDataHora('')
      return
    }

    if (tipoVeiculo === 'transferencia') {
      if (!veiculoSelecionado) {
        setMensagem('Selecione um veiculo')
        return
      }
      if (!baseOrigem || !baseDestino) {
        setMensagem('Selecione origem e destino')
        return
      }
      if (baseOrigem === baseDestino) {
        setMensagem('Origem e destino nao podem ser iguais')
        return
      }

      setCarregando(true)
      setMensagem('')

      try {
        const mensagemSucesso = await registrarLiberacaoSegura({
          tipo: 'transferencia',
          placa: veiculoSelecionado.NR_PLACA,
          base_origem: baseOrigem,
          base_destino: baseDestino,
          motorista: motoristaSelecionado || buscaMotorista || null,
          transferido_em: dataHora || null,
        })
        setMensagem(mensagemSucesso)
      } catch (error) {
        setMensagem(error instanceof Error ? `Erro ao transferir: ${error.message}` : 'Erro ao transferir.')
        return
      } finally {
        setCarregando(false)
      }
      setVeiculoSelecionado(null)
      setBuscaPlaca('')
      setBaseOrigem('')
      setBaseDestino('')
      setBuscaMotorista('')
      setMotoristaSelecionado('')
      setDataHora('')
      carregarDados()
      return
    }

    // Logica para Liberacao (Interno / Externo)
    const placaFinal =
      tipoVeiculo === 'interno'
        ? veiculoSelecionado?.NR_PLACA
        : formatPlate(placaExterna)

    if (!placaFinal) {
      setMensagem(tipoVeiculo === 'interno' ? 'Selecione um veiculo da lista' : 'Informe a placa do veiculo externo')
      return
    }
    if (tipoVeiculo === 'externo' && placaFinal.length !== 7) {
      setMensagem('A placa deve ter exatamente 7 caracteres')
      return
    }
    if (
      tipoVeiculo === 'externo' &&
      veiculos.some((veiculo) => formatPlate(veiculo.NR_PLACA || '') === placaFinal)
    ) {
      setMensagem('Essa placa pertence a um veiculo da empresa. Use a opcao Veiculo da Empresa ou Veiculo Interno.')
      return
    }
    if (!motoristaSelecionado) {
      setMensagem('Selecione um motorista')
      return
    }
    if (!destinoSelecionado) {
      setMensagem('Selecione um destino')
      return
    }
    if (tipoVeiculo === 'interno' && !km) {
      setMensagem('Preencha o KM')
      return
    }
    if (!dataHora) {
      setMensagem('Preencha a data/hora')
      return
    }
    const kmAtual = tipoVeiculo === 'interno' ? await validarKmVeiculo(placaFinal) : null
    if (tipoVeiculo === 'interno' && kmAtual === null) return

    setCarregando(true)
    setMensagem('')

    try {
      const mensagemSucesso = await registrarLiberacaoSegura({
        tipo: 'veiculo',
        tipo_veiculo: tipoVeiculo,
        placa: placaFinal,
        km: kmAtual,
        motorista: motoristaSelecionado,
        origem: origemSelecionada || buscaOrigem || null,
        destino: destinoSelecionado,
        data: dataHora,
      })
      setMensagem(mensagemSucesso)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao liberar: ${error.message}` : 'Erro ao liberar.')
      return
    } finally {
      setCarregando(false)
    }
    setVeiculoSelecionado(null)
    setBuscaPlaca('')
    setPlacaExterna('')
    setModeloExterno('')
    setMotoristaSelecionado('')
    setBuscaMotorista('')
    setDestinoSelecionado('')
    setBuscaDestino('')
    setKm('')
    setDataHora('')
  }

  async function registrarMovimentoVeiculoInterno(e?: React.FormEvent) {
    e?.preventDefault()
    const placaFinal = veiculoSelecionado?.NR_PLACA

    if (!placaFinal) {
      setMensagem('Selecione um veiculo da lista')
      return
    }
    if (!motoristaSelecionado) {
      setMensagem('Selecione um motorista')
      return
    }
    if (!dataHora) {
      setMensagem('Preencha a data/hora')
      return
    }
    setCarregando(true)
    setMensagem('')

    try {
      const mensagemSucesso = await registrarLiberacaoSegura({
        tipo: 'veiculo_interno',
        placa: placaFinal,
        motorista: motoristaSelecionado,
        origem: origemSelecionada || buscaOrigem || null,
        movimento: movimentoVeiculoInterno,
        data: dataHora,
      })
      setMensagem(mensagemSucesso)
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro ao registrar ${movimentoVeiculoInterno}: ${error.message}` : `Erro ao registrar ${movimentoVeiculoInterno}.`)
      return
    } finally {
      setCarregando(false)
    }
    setVeiculoSelecionado(null)
    setBuscaPlaca('')
    setMotoristaSelecionado('')
    setBuscaMotorista('')
    setDestinoSelecionado('')
    setBuscaDestino('')
    setKm('')
    setDataHora('')
  }

  // Dropdown comum para motorista
  const MotoristaDropdown = (opcional: boolean = false) => (
    <div data-dropdown className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Motorista {opcional && '(opcional)'}
        </label>
      </div>
      <input
        type="text"
        value={buscaMotorista}
        onChange={(e) => {
          setBuscaMotorista(e.target.value)
          setMotoristaSelecionado('')
          setMostrarListaMotorista(true)
        }}
        onFocus={() => setMostrarListaMotorista(true)}
        placeholder="Buscar motorista..."
        className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
      />
      {motoristaSelecionado && (
        <div className="mt-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
          {motoristaSelecionado}
        </div>
      )}
      {mostrarListaMotorista && !motoristaSelecionado && (
        <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
          {motoristas
            .filter((m) => m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()))
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMotoristaSelecionado(m.nome)
                  setBuscaMotorista(m.nome)
                  setMostrarListaMotorista(false)
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
              >
                {m.nome}
              </button>
            ))}
        </div>
      )}
    </div>
  )

  const OrigemDropdown = () => (
    <div data-dropdown className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Origem</label>
      </div>
      <input
        type="text"
        value={buscaOrigem}
        onChange={(e) => {
          setBuscaOrigem(e.target.value)
          setOrigemSelecionada('')
          setMostrarListaOrigem(true)
        }}
        onFocus={() => setMostrarListaOrigem(true)}
        className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
      />
      {mostrarListaOrigem && (
        <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
          {origens
            .filter((o) => o.nome.toLowerCase().includes(buscaOrigem.toLowerCase()))
            .map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setOrigemSelecionada(o.nome)
                  setBuscaOrigem(o.nome)
                  setMostrarListaOrigem(false)
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
              >
                {o.nome}
              </button>
            ))}
        </div>
      )}
    </div>
  )

  const IdentificadorLiberacao = (destaque: 'emerald' | 'purple' | 'blue' | 'sky' = 'emerald') => {
    const estilos = {
      emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
      purple: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
      blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
      sky: 'bg-sky-500/10 border-sky-500/20 text-sky-300',
    }

    return (
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Identificador
        </label>
        <div className={`w-full px-4 py-2.5 border rounded-xl text-sm font-semibold ${estilos[destaque]}`}>
          {identificadorLiberacao}
        </div>
      </div>
    )
  }

  return (
    <RequirePermissao permissao="liberacao">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Main content compactado */}
          <div className="app-scroll flex-1 overflow-y-auto bg-[#0a1625]" style={{ zoom: 0.95 }}>
            <main className="p-6">
              <div className="max-w-6xl mx-auto">
                <div className="app-scroll mb-4 flex gap-1.5 overflow-x-auto rounded-xl border border-emerald-500/20 bg-[#132337] p-1.5">
                  {podeVeiculoEmpresa && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('interno'); setMensagem('') }}
                      className={`min-w-[160px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${tipoVeiculo === 'interno' ? 'bg-emerald-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      Veiculo Empresa
                    </button>
                  )}
                  {podeVeiculoExterno && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('externo'); setMensagem('') }}
                      className={`min-w-[160px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${tipoVeiculo === 'externo' ? 'bg-orange-500 text-[#0a1625] shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      Veiculo Externo
                    </button>
                  )}
                  {podePedestre && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('pedestre'); setMensagem('') }}
                      className={`min-w-[170px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${tipoVeiculo === 'pedestre' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      Pedestres / Visitantes
                    </button>
                  )}
                  {podeTransferencia && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('transferencia'); setMensagem('') }}
                      className={`min-w-[170px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${tipoVeiculo === 'transferencia' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      Transferencia
                    </button>
                  )}
                  {podeVeiculoInterno && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('veiculo_interno'); setMovimentoVeiculoInterno('entrada'); setMensagem('') }}
                      className={`min-w-[160px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 whitespace-nowrap active:translate-y-0 cursor-pointer ${tipoVeiculo === 'veiculo_interno' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      Veiculo Interno
                    </button>
                  )}
                </div>

                <div key={tipoVeiculo} className="animate-tab bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 overflow-visible">
                  <div className="px-6 py-3 border-b border-white/5 bg-[#132337]/60 flex items-center justify-between rounded-t-2xl">
                    <div>
                      <h2 className="text-sm font-semibold text-white">
                        {tipoVeiculo === 'transferencia' ? 'Nova Transferencia' :
                          tipoVeiculo === 'pedestre' ? 'Liberar Entrada de Pedestre' :
                            tipoVeiculo === 'veiculo_interno' ? `Registrar ${movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de Veiculo Interno` : 'Nova Autorizacao de Saida'}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {tipoVeiculo === 'interno' && 'Frota propria Filtroamb'}
                        {tipoVeiculo === 'externo' && 'Veiculo de terceiro / visitante'}
                        {tipoVeiculo === 'pedestre' && 'Pessoas entrando a pe ou visitantes que deixam o carro fora'}
                        {tipoVeiculo === 'transferencia' && 'Use quando o veiculo muda de base de trabalho'}
                        {tipoVeiculo === 'veiculo_interno' && `${movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de veiculo interno da empresa`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${tipoVeiculo === 'interno' ? 'bg-emerald-500/15 text-emerald-300' :
                      tipoVeiculo === 'externo' ? 'bg-orange-500/15 text-orange-300' :
                        tipoVeiculo === 'pedestre' ? 'bg-purple-500/15 text-purple-300' :
                          tipoVeiculo === 'veiculo_interno' ? 'bg-sky-500/15 text-sky-300' :
                            'bg-blue-500/15 text-blue-300'
                      }`}>
                      {tipoVeiculo === 'interno' ? 'Interno' :
                        tipoVeiculo === 'externo' ? 'Externo' :
                          tipoVeiculo === 'pedestre' ? 'Pedestre' :
                            tipoVeiculo === 'veiculo_interno' ? 'Veiculo Interno' : 'Transferencia'}
                    </span>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6">

                    {tipoVeiculo === 'pedestre' ? (
                      /* ======= FORMULÃRIO DE PEDESTRE ======= */
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Nome Completo *
                            </label>
                            <input
                              type="text"
                              value={nomePedestre}
                              onChange={(e) => setNomePedestre(e.target.value)}
                              placeholder="Ex: Joao da Silva"
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              CPF
                            </label>
                            <input
                              type="text"
                              value={cpfPedestre}
                              onChange={(e) => setCpfPedestre(formatCpf(e.target.value))}
                              placeholder="000.000.000-00"
                              inputMode="numeric"
                              maxLength={14}
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Telefone
                            </label>
                            <input
                              type="text"
                              value={telefonePedestre}
                              onChange={(e) => setTelefonePedestre(formatPhone(e.target.value))}
                              placeholder="00 0 0000-0000"
                              inputMode="tel"
                              maxLength={15}
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Empresa / Representacao
                            </label>
                            <input
                              type="text"
                              value={empresaPedestre}
                              onChange={(e) => setEmpresaPedestre(e.target.value)}
                              placeholder="Ex: Empresa Parceira LTDA"
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
                          <div data-dropdown className="relative">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Destino / Setor *</label>
                            </div>
                            <input
                              type="text"
                              value={buscaDestino}
                              onChange={(e) => {
                                setBuscaDestino(e.target.value)
                                setDestinoSelecionado('')
                                setMostrarListaDestino(true)
                              }}
                              onFocus={() => setMostrarListaDestino(true)}
                              placeholder="Buscar destino..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                            {mostrarListaDestino && !destinoSelecionado && (
                              <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-purple-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
                                {destinos
                                  .filter((d) => d.nome.toLowerCase().includes(buscaDestino.toLowerCase()))
                                  .map((d) => (
                                    <button
                                      key={d.id}
                                      type="button"
                                      onClick={() => {
                                        setDestinoSelecionado(d.nome)
                                        setBuscaDestino(d.nome)
                                        setMostrarListaDestino(false)
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-purple-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
                                    >
                                      {d.nome}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Data e hora
                            </label>
                            <input
                              type="datetime-local"
                              value={dataHora}
                              onChange={(e) => setDataHora(e.target.value)}
                              className="w-full px-4 py-2.5 bg-[#132337] border border-purple-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition"
                            />
                          </div>
                          {IdentificadorLiberacao('purple')}
                        </div>

                        <div className="pt-2 max-w-4xl">
                          <button
                            type="submit"
                            disabled={carregando}
                            className="w-full bg-purple-500 hover:bg-purple-400 text-white font-semibold py-3 rounded-xl transition shadow-[0_0_20px_rgba(168,85,247,0.25)] disabled:opacity-40"
                          >
                            {carregando ? 'Liberando...' : 'Liberar Entrada de Pedestre'}
                          </button>
                        </div>

                        {mensagem && (
                          <div className={`p-3 rounded-xl text-sm max-w-4xl ${mensagem.includes('sucesso')
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-300 border border-red-500/20'
                            }`}>
                            {mensagem}
                          </div>
                        )}
                      </div>

                    ) : tipoVeiculo === 'transferencia' ? (
                      /* ======= FORMULÃRIO DE TRANSFERÃŠNCIA ======= */
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
                          <div data-dropdown className="relative">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Veiculo
                            </label>
                            <input
                              type="text"
                              value={buscaPlaca}
                              onChange={(e) => {
                                setBuscaPlaca(formatPlateDisplay(e.target.value))
                                setVeiculoSelecionado(null)
                                setMostrarListaPlaca(true)
                                setIndicePlacaAtivo(-1)
                              }}
                              onFocus={() => setMostrarListaPlaca(true)}
                              onKeyDown={navegarListaPlaca}
                              placeholder="Buscar placa..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 uppercase transition"
                            />
                            {veiculoSelecionado && (
                              <div className="mt-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
                                ✓ {formatPlateDisplay(veiculoSelecionado.NR_PLACA)} — {veiculoSelecionado.DS_MODELO}
                              </div>
                            )}
                            {mostrarListaPlaca && !veiculoSelecionado && buscaPlaca.length >= 1 && (
                              <div className="app-scroll absolute z-50 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-56 overflow-auto">
                                {veiculosFiltradosPorPlaca.length > 0 ? (
                                  veiculosFiltradosPorPlaca.map((v, i) => (
                                    <button
                                      key={`${v.NR_PLACA}-${i}`}
                                      type="button"
                                      onClick={() => selecionarVeiculoPorPlaca(v)}
                                      className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 ${indicePlacaAtivo === i ? 'bg-emerald-500/15' : 'hover:bg-emerald-500/10'}`}
                                    >
                                      <div className="font-semibold text-emerald-300">{formatPlateDisplay(v.NR_PLACA)}</div>
                                      <div className="text-xs text-slate-400">{v.DS_MODELO}</div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-4 py-3 text-sm text-slate-400">{mensagemListaPlaca}</div>
                                )}
                              </div>
                            )}
                          </div>

                          <div data-dropdown className="relative">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Base origem
                            </label>
                            <input
                              type="text"
                              value={baseOrigem}
                              onChange={(e) => {
                                setBaseOrigem(e.target.value)
                                setMostrarListaBaseOrigem(true)
                              }}
                              onFocus={() => setMostrarListaBaseOrigem(true)}
                              placeholder="Buscar base origem..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                            />
                            {mostrarListaBaseOrigem && (
                              <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
                                {origens
                                  .filter((b) =>
                                    b.nome.toLowerCase().includes(baseOrigem.toLowerCase())
                                  )
                                  .map((b) => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => {
                                        setBaseOrigem(b.nome)
                                        setMostrarListaBaseOrigem(false)
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
                                    >
                                      {b.nome}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>

                          {MotoristaDropdown(true)}
                          <div data-dropdown className="relative">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Base destino
                            </label>
                            <input
                              type="text"
                              value={baseDestino}
                              onChange={(e) => {
                                setBaseDestino(e.target.value)
                                setMostrarListaBaseDestino(true)
                              }}
                              onFocus={() => setMostrarListaBaseDestino(true)}
                              placeholder="Buscar base destino..."
                              className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                            />
                            {mostrarListaBaseDestino && (
                              <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
                                {origens
                                  .filter((b) =>
                                    b.nome.toLowerCase().includes(baseDestino.toLowerCase())
                                  )
                                  .map((b) => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => {
                                        setBaseDestino(b.nome)
                                        setMostrarListaBaseDestino(false)
                                      }}
                                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
                                    >
                                      {b.nome}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                              Data e hora
                            </label>
                            <input
                              type="datetime-local"
                              value={dataHora}
                              onChange={(e) => setDataHora(e.target.value)}
                              className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                            />
                          </div>
                          {IdentificadorLiberacao('blue')}
                        </div>

                        <div className="pt-2 max-w-4xl">
                          <button
                            type="submit"
                            disabled={carregando}
                            className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold py-3 rounded-xl transition disabled:opacity-40"
                          >
                            {carregando ? 'Salvando...' : 'Registrar Transferencia'}
                          </button>
                        </div>

                        {mensagem && (
                          <div className={`p-3 rounded-xl text-sm max-w-4xl ${mensagem.includes('sucesso')
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-300 border border-red-500/20'
                            }`}>
                            {mensagem}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ======= FORMULÃRIO DE LIBERAÃ‡ÃƒO ======= */
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          {tipoVeiculo === 'veiculo_interno' && (
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => { setMovimentoVeiculoInterno('entrada'); setMensagem('') }}
                                className={`py-2.5 rounded-xl text-sm font-semibold border transition ${movimentoVeiculoInterno === 'entrada' ? 'bg-sky-500 text-white border-sky-400 shadow-[0_0_18px_rgba(14,165,233,0.25)]' : 'bg-[#132337] text-slate-400 border-white/10 hover:text-white hover:border-sky-500/30'}`}
                              >
                                Entrada
                              </button>
                              <button
                                type="button"
                                onClick={() => { setMovimentoVeiculoInterno('saida'); setMensagem('') }}
                                className={`py-2.5 rounded-xl text-sm font-semibold border transition ${movimentoVeiculoInterno === 'saida' ? 'bg-orange-500 text-[#0a1625] border-orange-400 shadow-[0_0_18px_rgba(249,115,22,0.22)]' : 'bg-[#132337] text-slate-400 border-white/10 hover:text-white hover:border-orange-500/30'}`}
                              >
                                Saida
                              </button>
                            </div>
                          )}

                          {(tipoVeiculo === 'interno' || tipoVeiculo === 'veiculo_interno') ? (
                            <div data-dropdown className="relative">
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Veiculo</label>
                              <input
                                type="text"
                                value={buscaPlaca}
                                onChange={(e) => {
                                  setBuscaPlaca(formatPlateDisplay(e.target.value))
                                  setVeiculoSelecionado(null)
                                  setMostrarListaPlaca(true)
                                  setIndicePlacaAtivo(-1)
                                }}
                                onFocus={() => setMostrarListaPlaca(true)}
                                onKeyDown={navegarListaPlaca}
                                placeholder="Buscar por placa..."
                                className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 uppercase transition"
                              />
                              {veiculoSelecionado && (
                                <div className="mt-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
                                  {formatPlateDisplay(veiculoSelecionado.NR_PLACA)} *” {veiculoSelecionado.DS_MODELO}
                                </div>
                              )}
                              {mostrarListaPlaca && !veiculoSelecionado && buscaPlaca.length >= 1 && (
                                <div className="app-scroll absolute z-50 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-52 overflow-auto">
                                  {veiculosFiltradosPorPlaca.length > 0 ? (
                                    veiculosFiltradosPorPlaca.map((v, i) => (
                                      <button
                                        key={`${v.NR_PLACA}-${i}`}
                                        type="button"
                                        onClick={() => selecionarVeiculoPorPlaca(v)}
                                        className={`w-full text-left px-4 py-2.5 border-b border-white/5 last:border-0 ${indicePlacaAtivo === i ? 'bg-emerald-500/15' : 'hover:bg-emerald-500/10'}`}
                                      >
                                        <div className="font-semibold text-emerald-300">{formatPlateDisplay(v.NR_PLACA)}</div>
                                        <div className="text-xs text-slate-400">{v.DS_MODELO}{v.DS_MARCA ? ` â€¢ ${v.DS_MARCA}` : ''}</div>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-4 py-3 text-sm text-slate-400">{mensagemListaPlaca}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Placa externa</label>
                                <input
                                  type="text"
                                  value={placaExterna}
                                  onChange={(e) => setPlacaExterna(formatPlateDisplay(e.target.value))}
                                  placeholder="ABC1D23"
                                  maxLength={8}
                                  className={`w-full px-4 py-2.5 bg-[#132337] border rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 uppercase transition ${placaExternaPertenceEmpresa ? 'border-red-500/40 focus:ring-red-400/30' : 'border-orange-500/20 focus:ring-orange-400/40'}`}
                                />
                                {placaExternaPertenceEmpresa && (
                                  <p className="mt-2 text-xs font-medium text-red-300">
                                    Essa placa pertence a um veiculo da empresa. Use Veiculo da Empresa ou Veiculo Interno.
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Modelo</label>
                                <input
                                  type="text"
                                  value={modeloExterno}
                                  onChange={(e) => setModeloExterno(e.target.value)}
                                  placeholder="Ex: Strada"
                                  className="w-full px-4 py-2.5 bg-[#132337] border border-orange-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 transition"
                                />
                              </div>
                            </div>
                          )}

                          <div className={`grid gap-3 ${tipoVeiculo === 'interno' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {tipoVeiculo === 'interno' && (
                              <div data-dropdown>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">KM Atual</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={km}
                                  onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))}
                                  placeholder="0"
                                  className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Data e Hora</label>
                              <input
                                type="datetime-local"
                                value={dataHora}
                                onChange={(e) => setDataHora(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                              />
                            </div>
                          </div>

                          {OrigemDropdown()}
                        </div>

                        <div className="space-y-4">
                          {MotoristaDropdown(false)}

                          {tipoVeiculo === 'veiculo_interno' ? (
                            IdentificadorLiberacao('sky')
                          ) : tipoVeiculo === 'externo' ? (
                            IdentificadorLiberacao('blue')
                          ) : (
                            IdentificadorLiberacao()
                          )}

                          {tipoVeiculo !== 'veiculo_interno' && (
                            <div data-dropdown className="relative">
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Destino</label>
                              </div>
                              <input
                                type="text"
                                value={buscaDestino}
                                onChange={(e) => {
                                  setBuscaDestino(e.target.value)
                                  setDestinoSelecionado('')
                                  setMostrarListaDestino(true)
                                }}
                                onFocus={() => setMostrarListaDestino(true)}
                                placeholder="Buscar destino..."
                                className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                              />
                              {mostrarListaDestino && !destinoSelecionado && (
                                <div className="app-scroll absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
                                  {destinos
                                    .filter((d) => d.nome.toLowerCase().includes(buscaDestino.toLowerCase()))
                                    .map((d) => (
                                      <button
                                        key={d.id}
                                        type="button"
                                        onClick={() => {
                                          setDestinoSelecionado(d.nome)
                                          setBuscaDestino(d.nome)
                                          setMostrarListaDestino(false)
                                        }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 text-sm text-slate-200 border-b border-white/5 last:border-0"
                                      >
                                        {d.nome}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={carregando}
                              className={`w-full font-semibold py-3 rounded-xl transition ${tipoVeiculo === 'veiculo_interno'
                                ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.25)]'
                                : tipoVeiculo === 'interno'
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-[#0a1625] shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                                  : 'bg-orange-500 hover:bg-orange-400 text-[#0a1625] shadow-[0_0_20px_rgba(249,115,22,0.25)]'
                                } disabled:opacity-40`}
                            >
                              {carregando
                                ? tipoVeiculo === 'veiculo_interno' ? 'Registrando...' : 'Liberando...'
                                : tipoVeiculo === 'veiculo_interno'
                                  ? `Registrar ${movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de Veiculo Interno`
                                  : tipoVeiculo === 'interno'
                                    ? 'Liberar Veiculo da Empresa'
                                    : 'Liberar Veiculo Externo'}
                            </button>
                          </div>

                          {mensagem && (
                            <div className={`p-3 rounded-xl text-sm ${mensagem.includes('sucesso')
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-300 border border-red-500/20'
                              }`}>
                              {mensagem}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </form>
                </div>

              </div>
            </main>
          </div>
        </div>
      </div>
    </RequirePermissao>
  )
}
