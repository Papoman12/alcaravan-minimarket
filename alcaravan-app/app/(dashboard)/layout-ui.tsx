'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/pos': 'Punto de Venta',
  '/productos': 'Productos',
  '/inventario': 'Inventario',
  '/clientes': 'Clientes',
  '/caja': 'Caja',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
  '/compras': 'Compras',
  '/proveedores': 'Proveedores',
  '/gastos': 'Gastos',
  '/cafeteria': 'Cafetería',
  '/produccion': 'Producción',
  '/domicilios': 'Domicilios',
  '/promociones': 'Promociones',
  '/ai': 'Alcaraván AI',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? 'Alcaraván'

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {/* Sidebar desktop */}
      <div className="hidden lg:flex lg:w-60 lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar móvil — overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-72 z-50 lg:hidden animate-slide-in">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={title}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
