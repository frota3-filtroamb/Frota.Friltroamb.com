'use client'

import RequirePermissao from '@/components/RequirePermissao'
import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import { podeAcessarDetalhe } from '@/lib/roles'
import { formatCpf, formatPhone, formatPlate, onlyDigits } from '@/lib/masks'

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

type Transferencia = {
  id: number
  placa: string
  base_origem: string
  base_destino: string
  motorista: string | null
  observacao: string | null
  transferido_em: string | null
  transferido_por: string | null
}

export default function LiberacaoPage() {
  const supabase = createClient()
  const { user, isLoaded } = useUser()

  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [origens, setOrigens] = useState<Item[]>([])
  const [destinos, setDestinos] = useState<Item[]>([])
  const [motoristas, setMotoristas] = useState<Item[]>([])
  const [listaTransferencias, setListaTransferencias] = useState<Transferencia[]>([])

  const [tipoVeiculo, setTipoVeiculo] = useState<'interno' | 'externo' | 'veiculo_interno' | 'transferencia' | 'pedestre'>('interno')
  const [movimentoVeiculoInterno, setMovimentoVeiculoInterno] = useState<'entrada' | 'saida'>('entrada')

  const [buscaPlaca, setBuscaPlaca] = useState('')
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<Veiculo | null>(null)
  const [mostrarListaPlaca, setMostrarListaPlaca] = useState(false)

  const [placaExterna, setPlacaExterna] = useState('')
  const [modeloExterno, setModeloExterno] = useState('')

  const [buscaMotorista, setBuscaMotorista] = useState('')
  const [motoristaSelecionado, setMotoristaSelecionado] = useState('')
  const [mostrarListaMotorista, setMostrarListaMotorista] = useState(false)
  const [novoMotorista, setNovoMotorista] = useState('')
  const [mostrarFormMotorista, setMostrarFormMotorista] = useState(false)

  const [buscaOrigem, setBuscaOrigem] = useState('Matriz Filtroamb')
  const [origemSelecionada, setOrigemSelecionada] = useState('Matriz Filtroamb')
  const [mostrarListaOrigem, setMostrarListaOrigem] = useState(false)
  const [novaOrigem, setNovaOrigem] = useState('')
  const [mostrarFormOrigem, setMostrarFormOrigem] = useState(false)

  const [buscaDestino, setBuscaDestino] = useState('')
  const [destinoSelecionado, setDestinoSelecionado] = useState('')
  const [mostrarListaDestino, setMostrarListaDestino] = useState(false)
  const [novoDestino, setNovoDestino] = useState('')
  const [mostrarFormDestino, setMostrarFormDestino] = useState(false)

  const [km, setKm] = useState('')
  const [dataHora, setDataHora] = useState('')

  // States specific to Transferencia
  const [baseOrigem, setBaseOrigem] = useState('')
  const [baseDestino, setBaseDestino] = useState('')
  const [mostrarListaBaseOrigem, setMostrarListaBaseOrigem] = useState(false)
  const [mostrarListaBaseDestino, setMostrarListaBaseDestino] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [buscaFiltroTransf, setBuscaFiltroTransf] = useState('')

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

  const tiposPermitidos = [
    podeVeiculoEmpresa ? 'interno' : null,
    podeVeiculoExterno ? 'externo' : null,
    podePedestre ? 'pedestre' : null,
    podeTransferencia ? 'transferencia' : null,
    podeVeiculoInterno ? 'veiculo_interno' : null,
  ].filter(Boolean) as typeof tipoVeiculo[]

  async function carregarDados() {
    const [v, o, d, m, t] = await Promise.all([
      supabase.from('veiculos').select('NR_PLACA, DS_MODELO, DS_MARCA, NR_ANO_MODELO').order('NR_PLACA'),
      supabase.from('origens').select('id, nome').order('nome'),
      supabase.from('destinos').select('id, nome').order('nome'),
      supabase.from('motoristas').select('id, nome').order('nome'),
      supabase.from('transferencias').select('*').order('transferido_em', { ascending: false }).limit(50),
    ])
    if (v.data) setVeiculos(v.data)
    if (o.data) setOrigens(o.data)
    if (d.data) setDestinos(d.data)
    if (m.data) setMotoristas(m.data)
    if (t.data) setListaTransferencias(t.data)
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
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function cadastrarItem(
    tabela: 'origens' | 'destinos' | 'motoristas',
    valor: string,
    setBusca: (v: string) => void,
    setSelecionado: (v: string) => void,
    setForm: (v: boolean) => void,
    setNovo: (v: string) => void
  ) {
    if (!valor.trim()) return
    const { error } = await supabase.from(tabela).insert({ nome: valor.trim() })
    if (error) {
      setMensagem('Erro ao cadastrar: ' + error.message)
      return
    }
    setBusca(valor.trim())
    setSelecionado(valor.trim())
    setNovo('')
    setForm(false)
    carregarDados()
  }

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

      const { error, data: insertData } = await supabase.from('movimentacoes_pedestres').insert({
        nome: nomePedestre,
        cpf_rg: cpfPedestre || null,
        telefone: telefonePedestre || null,
        empresa: empresaPedestre || null,
        destino: destinoSelecionado || buscaDestino,
        status: 'aguardando_entrada',
        liberado_por: 'Gestor',
        liberado_em: dataHora
          ? new Date(dataHora).toISOString()
          : new Date().toISOString(),
      }).select()

      // DEBUG temporário — verificar no Console do navegador (F12)
      console.log('[Liberacao] insert pedestre - data:', insertData, 'error:', error)

      setCarregando(false)

      if (error) {
        setMensagem('Erro ao liberar pedestre: ' + error.message)
        return
      }

      setMensagem('Pedestre liberado com sucesso! A Portaria já pode ver.')
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
        setMensagem('Selecione um veículo')
        return
      }
      if (!baseOrigem || !baseDestino) {
        setMensagem('Selecione origem e destino')
        return
      }
      if (baseOrigem === baseDestino) {
        setMensagem('Origem e destino não podem ser iguais')
        return
      }

      setCarregando(true)
      setMensagem('')

      const { error } = await supabase.from('transferencias').insert({
        placa: veiculoSelecionado.NR_PLACA,
        base_origem: baseOrigem,
        base_destino: baseDestino,
        motorista: motoristaSelecionado || buscaMotorista || null,
        observacao: observacao || null,
        status: 'concluida',
        transferido_por: 'Gestor',
        transferido_em: dataHora
          ? new Date(dataHora).toISOString()
          : new Date().toISOString(),
      })

      setCarregando(false)

      if (error) {
        setMensagem('Erro ao transferir: ' + error.message)
        return
      }

      setMensagem('Transferência registrada com sucesso!')
      setVeiculoSelecionado(null)
      setBuscaPlaca('')
      setBaseOrigem('')
      setBaseDestino('')
      setBuscaMotorista('')
      setMotoristaSelecionado('')
      setObservacao('')
      setDataHora('')
      carregarDados()
      return
    }

    // Lógica para Liberação (Interno / Externo)
    const placaFinal =
      tipoVeiculo === 'interno'
        ? veiculoSelecionado?.NR_PLACA
        : formatPlate(placaExterna)

    if (!placaFinal) {
      setMensagem(tipoVeiculo === 'interno' ? 'Selecione um veículo da lista' : 'Informe a placa do veículo externo')
      return
    }
    if (tipoVeiculo === 'externo' && placaFinal.length !== 7) {
      setMensagem('A placa deve ter exatamente 7 caracteres')
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
    if (!km || !dataHora) {
      setMensagem('Preencha KM e a data/hora')
      return
    }
    const kmAtual = await validarKmVeiculo(placaFinal)
    if (kmAtual === null) return

    setCarregando(true)
    setMensagem('')

    const dataLiberacao = new Date(dataHora).toISOString()

    const { error } = await supabase.from('movimentacoes').insert({
      placa: placaFinal,
      km: kmAtual,
      motorista: motoristaSelecionado,
      localizacao: origemSelecionada || buscaOrigem,
      destino: destinoSelecionado,
      status: 'aguardando_saida',
      liberado_por: 'Gestor',
      liberado_em: dataLiberacao,
      entrada_em: tipoVeiculo === 'externo' ? dataLiberacao : null,
      tipo_veiculo: tipoVeiculo,
    })

    setCarregando(false)

    if (error) {
      setMensagem('Erro ao liberar: ' + error.message)
      return
    }

    setMensagem('Veículo liberado com sucesso! A Portaria já pode ver.')
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
      setMensagem('Selecione um veículo da lista')
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
    const dataRegistro = new Date(dataHora).toISOString()

    setCarregando(true)
    setMensagem('')

    const { error } = await supabase.from('movimentacoes').insert({
      placa: placaFinal,
      km: null,
      motorista: motoristaSelecionado,
      localizacao: origemSelecionada || buscaOrigem,
      destino: null,
      status: 'finalizado',
      liberado_por: 'Gestor',
      liberado_em: dataRegistro,
      saida_em: movimentoVeiculoInterno === 'saida' ? dataRegistro : null,
      entrada_em: movimentoVeiculoInterno === 'entrada' ? dataRegistro : null,
      tipo_veiculo: movimentoVeiculoInterno === 'saida' ? 'interno_saida' : 'interno_entrada',
    })

    setCarregando(false)

    if (error) {
      setMensagem(`Erro ao registrar ${movimentoVeiculoInterno}: ` + error.message)
      return
    }

    setMensagem(`Veiculo interno registrado com sucesso como ${movimentoVeiculoInterno} no historico do controle.`)
    setVeiculoSelecionado(null)
    setBuscaPlaca('')
    setMotoristaSelecionado('')
    setBuscaMotorista('')
    setDestinoSelecionado('')
    setBuscaDestino('')
    setKm('')
    setDataHora('')
  }

  function formatarData(data: string | null) {
    if (!data) return '—'
    return new Date(data).toLocaleString('pt-BR')
  }

  const transferenciasFiltradas = listaTransferencias.filter((t) => {
    const texto = buscaFiltroTransf.toLowerCase()
    return (
      t.placa?.toLowerCase().includes(texto) ||
      t.base_origem?.toLowerCase().includes(texto) ||
      t.base_destino?.toLowerCase().includes(texto) ||
      t.motorista?.toLowerCase().includes(texto)
    )
  })

  // Dropdown comum para motorista
  const MotoristaDropdown = (opcional: boolean = false) => (
    <div data-dropdown className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Motorista {opcional && '(opcional)'}
        </label>
        <button type="button" onClick={() => setMostrarFormMotorista(!mostrarFormMotorista)} className="text-xs text-emerald-400 hover:text-emerald-300">
          + Cadastrar
        </button>
      </div>
      {mostrarFormMotorista && (
        <div className="mb-2 flex gap-2">
          <input
            type="text"
            value={novoMotorista}
            onChange={(e) => setNovoMotorista(e.target.value)}
            placeholder="Nome..."
            className="flex-1 px-3 py-2 bg-[#132337] border border-emerald-500/20 rounded-lg text-sm text-white"
          />
          <button
            type="button"
            onClick={() => cadastrarItem('motoristas', novoMotorista, setBuscaMotorista, setMotoristaSelecionado, setMostrarFormMotorista, setNovoMotorista)}
            className="px-3 py-2 bg-emerald-500 text-[#0a1625] text-sm font-semibold rounded-lg"
          >
            Salvar
          </button>
        </div>
      )}
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
        <div className="absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
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

  return (
    <RequirePermissao permissao="liberacao">
      <div className="min-h-screen flex bg-[#0a1625]">
        <Sidebar />

        <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
          <div className="relative h-28 md:h-36 shrink-0 overflow-hidden">
            <img src="/images/banner-frota3.jpg" alt="Filtroamb" className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1625]/90 via-[#0a1625]/55 to-transparent" />
            <div data-banner className="absolute inset-0 flex items-end pb-4 px-8">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {tipoVeiculo === 'transferencia' ? 'Transferencia de Bases' :
                    tipoVeiculo === 'pedestre' ? 'Liberacao de Pedestres / Visitantes' :
                      tipoVeiculo === 'veiculo_interno' ? `${movimentoVeiculoInterno === 'entrada' ? 'Entrada' : 'Saida'} de Veiculo Interno` : 'Liberacao Portaria'}
                </h1>
                <p className="text-sm text-emerald-300 mt-0.5">
                  {tipoVeiculo === 'transferencia' ? 'Mudanca definitiva de base (nao fica em rota)' :
                    tipoVeiculo === 'pedestre' ? 'Autorize a entrada de terceiros, visitantes e funcionarios sem veiculo' :
                      tipoVeiculo === 'veiculo_interno' ? 'Registre entradas e saidas de veiculos internos da empresa' :
                        'Autorize a saida de veiculos internos ou externos'}
                </p>
              </div>
            </div>
          </div>

          {/* Main content compactado */}
          <div className="flex-1 overflow-y-auto bg-[#0a1625]" style={{ zoom: 0.95 }}>
            <main className="p-6">
              <div className="max-w-6xl mx-auto">
                <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
                  {podeVeiculoEmpresa && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('interno'); setMensagem('') }}
                      className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md cursor-pointer ${tipoVeiculo === 'interno' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]' : 'bg-[#0f1c2e] border-white/10 text-slate-400 hover:border-emerald-500/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'}`}
                    >
                      Veiculo da Empresa
                    </button>
                  )}
                  {podeVeiculoExterno && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('externo'); setMensagem('') }}
                      className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md cursor-pointer ${tipoVeiculo === 'externo' ? 'bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-[0_0_20px_rgba(249,115,22,0.25)]' : 'bg-[#0f1c2e] border-white/10 text-slate-400 hover:border-orange-500/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'}`}
                    >
                      Veiculo Externo
                    </button>
                  )}
                  {podePedestre && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('pedestre'); setMensagem('') }}
                      className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md cursor-pointer ${tipoVeiculo === 'pedestre' ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.25)]' : 'bg-[#0f1c2e] border-white/10 text-slate-400 hover:border-purple-500/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'}`}
                    >
                      Pedestres / Visitantes
                    </button>
                  )}
                  {podeTransferencia && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('transferencia'); setMensagem('') }}
                      className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md cursor-pointer ${tipoVeiculo === 'transferencia' ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.25)]' : 'bg-[#0f1c2e] border-white/10 text-slate-400 hover:border-blue-500/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'}`}
                    >
                      Transferencia de Bases
                    </button>
                  )}
                  {podeVeiculoInterno && (
                    <button
                      type="button"
                      onClick={() => { setTipoVeiculo('veiculo_interno'); setMovimentoVeiculoInterno('entrada'); setMensagem('') }}
                      className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md cursor-pointer ${tipoVeiculo === 'veiculo_interno' ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_20px_rgba(14,165,233,0.25)]' : 'bg-[#0f1c2e] border-white/10 text-slate-400 hover:border-sky-500/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]'}`}
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
                        {tipoVeiculo === 'interno' && 'Frota própria Filtroamb'}
                        {tipoVeiculo === 'externo' && 'Veículo de terceiro / visitante'}
                        {tipoVeiculo === 'pedestre' && 'Pessoas entrando a pé ou visitantes que deixam o carro fora'}
                        {tipoVeiculo === 'transferencia' && 'Use quando o veículo muda de base de trabalho'}
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
                      /* ======= FORMULÁRIO DE PEDESTRE ======= */
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
                              placeholder="Ex: João da Silva"
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
                              Empresa / Representação
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
                              <button type="button" onClick={() => setMostrarFormDestino(!mostrarFormDestino)} className="text-xs text-purple-400 hover:text-purple-300">
                                + Cadastrar
                              </button>
                            </div>
                            {mostrarFormDestino && (
                              <div className="mb-2 flex gap-2">
                                <input
                                  type="text"
                                  value={novoDestino}
                                  onChange={(e) => setNovoDestino(e.target.value)}
                                  placeholder="Novo destino..."
                                  className="flex-1 px-3 py-2 bg-[#132337] border border-purple-500/20 rounded-lg text-sm text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => cadastrarItem('destinos', novoDestino, setBuscaDestino, setDestinoSelecionado, setMostrarFormDestino, setNovoDestino)}
                                  className="px-3 py-2 bg-purple-500 text-[#0a1625] text-sm font-semibold rounded-lg"
                                >
                                  Salvar
                                </button>
                              </div>
                            )}
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
                              <div className="absolute z-20 w-full mt-1.5 bg-[#132337] border border-purple-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
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
                      /* ======= FORMULÁRIO DE TRANSFERÊNCIA ======= */
                      <div className="space-y-5">
                        <div data-dropdown className="relative max-w-xl">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Veículo
                          </label>
                          <input
                            type="text"
                            value={buscaPlaca}
                            onChange={(e) => {
                              setBuscaPlaca(formatPlate(e.target.value))
                              setVeiculoSelecionado(null)
                              setMostrarListaPlaca(true)
                            }}
                            onFocus={() => setMostrarListaPlaca(true)}
                            placeholder="Buscar placa..."
                            className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 uppercase transition"
                          />
                          {veiculoSelecionado && (
                            <div className="mt-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
                              ✓ {veiculoSelecionado.NR_PLACA} — {veiculoSelecionado.DS_MODELO}
                            </div>
                          )}
                          {mostrarListaPlaca && !veiculoSelecionado && buscaPlaca.length >= 1 && (
                            <div className="absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-56 overflow-auto">
                              {Array.from(
                                new Map(
                                  veiculos
                                    .filter((v) =>
                                      formatPlate(v.NR_PLACA || '').includes(buscaPlaca)
                                    )
                                    .map((v) => [v.NR_PLACA, v])
                                ).values()
                              )
                                .slice(0, 8)
                                .map((v, i) => (
                                  <button
                                    key={`${v.NR_PLACA}-${i}`}
                                    type="button"
                                    onClick={() => {
                                      setVeiculoSelecionado(v)
                                      setBuscaPlaca(v.NR_PLACA)
                                      setMostrarListaPlaca(false)
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-emerald-500/10 border-b border-white/5 last:border-0"
                                  >
                                    <div className="font-semibold text-emerald-300">{v.NR_PLACA}</div>
                                    <div className="text-xs text-slate-400">{v.DS_MODELO}</div>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
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
                              <div className="absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
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
                              <div className="absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
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
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
                          {MotoristaDropdown(true)}
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
                        </div>

                        <div className="max-w-4xl">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Observação
                          </label>
                          <textarea
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            rows={2}
                            placeholder="Ex: Veículo realocado para operar em Canoas"
                            className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition resize-none"
                          />
                        </div>

                        <div className="pt-2 max-w-4xl">
                          <button
                            type="submit"
                            disabled={carregando}
                            className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold py-3 rounded-xl transition disabled:opacity-40"
                          >
                            {carregando ? 'Salvando...' : 'Registrar Transferência'}
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
                      /* ======= FORMULÁRIO DE LIBERAÇÃO ======= */
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
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Veículo</label>
                              <input
                                type="text"
                                value={buscaPlaca}
                                onChange={(e) => {
                                  setBuscaPlaca(formatPlate(e.target.value))
                                  setVeiculoSelecionado(null)
                                  setMostrarListaPlaca(true)
                                }}
                                onFocus={() => setMostrarListaPlaca(true)}
                                placeholder="Buscar por placa..."
                                className="w-full px-4 py-2.5 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 uppercase transition"
                              />
                              {veiculoSelecionado && (
                                <div className="mt-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
                                  {veiculoSelecionado.NR_PLACA} — {veiculoSelecionado.DS_MODELO}
                                </div>
                              )}
                              {mostrarListaPlaca && !veiculoSelecionado && buscaPlaca.length >= 1 && (
                                <div className="absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-52 overflow-auto">
                                  {Array.from(
                                    new Map(
                                      veiculos
                                        .filter((v) => formatPlate(v.NR_PLACA || '').includes(buscaPlaca))
                                        .map((v) => [v.NR_PLACA, v])
                                    ).values()
                                  )
                                    .slice(0, 8)
                                    .map((v, i) => (
                                      <button
                                        key={`${v.NR_PLACA}-${i}`}
                                        type="button"
                                        onClick={() => {
                                          setVeiculoSelecionado(v)
                                          setBuscaPlaca(v.NR_PLACA)
                                          setMostrarListaPlaca(false)
                                        }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 border-b border-white/5 last:border-0"
                                      >
                                        <div className="font-semibold text-emerald-300">{v.NR_PLACA}</div>
                                        <div className="text-xs text-slate-400">{v.DS_MODELO}{v.DS_MARCA ? ` • ${v.DS_MARCA}` : ''}</div>
                                      </button>
                                    ))}
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
                                  onChange={(e) => setPlacaExterna(formatPlate(e.target.value))}
                                  placeholder="ABC1D23"
                                  maxLength={7}
                                  className="w-full px-4 py-2.5 bg-[#132337] border border-orange-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 uppercase transition"
                                />
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

                          <div className={`grid gap-3 ${tipoVeiculo === 'veiculo_interno' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {tipoVeiculo !== 'veiculo_interno' && (
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

                          {tipoVeiculo !== 'veiculo_interno' && MotoristaDropdown(false)}
                        </div>

                        <div className="space-y-4">
                          <div data-dropdown className="relative">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Origem</label>
                              <button type="button" onClick={() => setMostrarFormOrigem(!mostrarFormOrigem)} className="text-xs text-emerald-400">
                                + Cadastrar
                              </button>
                            </div>
                            {mostrarFormOrigem && (
                              <div className="mb-2 flex gap-2">
                                <input
                                  type="text"
                                  value={novaOrigem}
                                  onChange={(e) => setNovaOrigem(e.target.value)}
                                  placeholder="Nova origem..."
                                  className="flex-1 px-3 py-2 bg-[#132337] border border-emerald-500/20 rounded-lg text-sm text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => cadastrarItem('origens', novaOrigem, setBuscaOrigem, setOrigemSelecionada, setMostrarFormOrigem, setNovaOrigem)}
                                  className="px-3 py-2 bg-emerald-500 text-[#0a1625] text-sm font-semibold rounded-lg"
                                >
                                  Salvar
                                </button>
                              </div>
                            )}
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
                              <div className="absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
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

                          {tipoVeiculo === 'veiculo_interno' ? (
                            MotoristaDropdown(false)
                          ) : (
                            <div data-dropdown className="relative">
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Destino</label>
                                <button type="button" onClick={() => setMostrarFormDestino(!mostrarFormDestino)} className="text-xs text-emerald-400">
                                  + Cadastrar
                                </button>
                              </div>
                              {mostrarFormDestino && (
                                <div className="mb-2 flex gap-2">
                                  <input
                                    type="text"
                                    value={novoDestino}
                                    onChange={(e) => setNovoDestino(e.target.value)}
                                    placeholder="Novo destino..."
                                    className="flex-1 px-3 py-2 bg-[#132337] border border-emerald-500/20 rounded-lg text-sm text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => cadastrarItem('destinos', novoDestino, setBuscaDestino, setDestinoSelecionado, setMostrarFormDestino, setNovoDestino)}
                                    className="px-3 py-2 bg-emerald-500 text-[#0a1625] text-sm font-semibold rounded-lg"
                                  >
                                    Salvar
                                  </button>
                                </div>
                              )}
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
                                <div className="absolute z-20 w-full mt-1.5 bg-[#132337] border border-emerald-500/25 rounded-xl shadow-2xl max-h-40 overflow-auto">
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

                {/* Histórico de Transferências caso a aba seja transferencia */}
                {tipoVeiculo === 'transferencia' && (
                  <div className="animate-tab mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white tracking-tight">
                        Histórico de Transferências
                      </h3>
                      <input
                        type="text"
                        value={buscaFiltroTransf}
                        onChange={(e) => setBuscaFiltroTransf(e.target.value)}
                        placeholder="Filtrar..."
                        className="w-56 px-3 py-2 bg-[#132337] border border-emerald-500/20 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </div>

                    <div className="bg-[#0f1c2e] rounded-2xl border border-emerald-500/15 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-[#132337] border-b border-emerald-500/15">
                              <th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Placa</th>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">De</th>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Para</th>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Motorista</th>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold text-emerald-400/90 uppercase tracking-wider whitespace-nowrap">Data</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {transferenciasFiltradas.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                                  Nenhuma transferência registrada.
                                </td>
                              </tr>
                            ) : (
                              transferenciasFiltradas.map((t) => (
                                <tr key={t.id} className="hover:bg-emerald-500/5 transition-colors">
                                  <td className="px-5 py-3.5 font-medium text-emerald-300 whitespace-nowrap">{t.placa}</td>
                                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{t.base_origem}</td>
                                  <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{t.base_destino}</td>
                                  <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">{t.motorista || '—'}</td>
                                  <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                                    {formatarData(t.transferido_em)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </RequirePermissao>
  )
}
