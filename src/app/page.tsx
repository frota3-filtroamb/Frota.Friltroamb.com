import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase/server'
import VeiculosClient from './VeiculosClient'

export default async function Home() {
  const supabase = await createClient()

 const { data: veiculos, error } = await supabase
  .from('veiculos')
  .select('*')
  .order('NR_PLACA')

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-2xl shadow text-red-600">
          Erro: {error.message}
        </div>
      </div>
    )
  }

  return (
<div className="min-h-screen flex bg-[#0a1625]">      {/* Barra lateral */}
<Sidebar />
      {/* Conteúdo */}
      <div className="flex-1 ml-14 flex flex-col h-screen overflow-hidden">
        <VeiculosClient veiculos={veiculos || []} />
      </div>
    </div>
  )
}
