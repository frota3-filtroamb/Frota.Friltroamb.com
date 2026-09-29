import Image from 'next/image'
import Sidebar from '@/components/Sidebar'

export default function InicioPage() {
  return (
    <div className="min-h-screen flex bg-[#0a1625]">
      <Sidebar />

      <main className="flex-1 bg-[#0a1625]">
        <div className="relative h-[145px] w-full overflow-hidden">
          <Image
            src="/images/banner-frota3.jpg"
            alt="Gestao de Frota"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#061322]/75 via-[#061322]/35 to-transparent" />
        </div>
      </main>
    </div>
  )
}
