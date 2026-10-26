'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'

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
  '/usuarios': 'Usuarios',
  '/ventas': 'Ventas',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [userRole, setUserRole] = useState<string>('admin')
  const pathname = usePathname()
  const router = useRouter()
  const title = pageTitles[pathname] ?? 'Alcaraván'

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/login'
          return
        }
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        // Si no tiene role asignado → tratar como admin (ve todo)
        const rol = (userData as any)?.role ?? 'admin'
        setUserRole(rol)
        setAuthChecked(true)
      } catch {
        window.location.href = '/login'
      }
    }
    checkAuth()
  }, [router])

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-stone-500 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      <div className="hidden lg:flex lg:w-60 lg:flex-shrink-0">
        <Sidebar userRole={userRole} />
      </div>

      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-72 z-50 lg:hidden animate-slide-in">
            <Sidebar userRole={userRole} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
