'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  icon: string
  label: string
  phase?: number
}

const navItems: NavItem[] = [
  { href: '/',             icon: '🏠', label: 'Dashboard' },
  { href: '/pos',          icon: '🛒', label: 'Punto de Venta' },
  { href: '/caja',         icon: '💰', label: 'Caja' },
  { href: '/ventas',       icon: '🧾', label: 'Ventas' },
  { href: '/clientes',     icon: '👥', label: 'Clientes' },
  { href: '/productos',    icon: '📦', label: 'Productos' },
  { href: '/inventario',   icon: '📊', label: 'Inventario' },
  { href: '/compras',      icon: '🧾', label: 'Compras' },
  { href: '/proveedores',  icon: '🏭', label: 'Proveedores' },
  { href: '/cafeteria',    icon: '☕', label: 'Cafetería',   phase: 3 },
  { href: '/produccion',   icon: '👨‍🍳', label: 'Producción',  phase: 3 },
  { href: '/domicilios',   icon: '🚚', label: 'Domicilios',  phase: 4 },
  { href: '/promociones',  icon: '🎁', label: 'Promociones', phase: 4 },
  { href: '/gastos',       icon: '💳', label: 'Gastos' },
  { href: '/reportes',     icon: '📈', label: 'Reportes' },
  { href: '/usuarios',     icon: '👤', label: 'Usuarios' },
  { href: '/configuracion',icon: '⚙️', label: 'Configuración' },
  { href: '/ai',           icon: '🤖', label: 'Alcaraván AI', phase: 5 },
]

// admin (o cualquier rol no listado) ve TODO
const PERMISOS: Record<string, string[]> = {
  cajero:    ['/', '/pos', '/caja', '/ventas', '/clientes'],
  bodega:    ['/', '/productos', '/inventario', '/compras', '/proveedores'],
  inventario:['/', '/productos', '/inventario', '/compras', '/proveedores'],
}

function getRutas(rol: string): string[] | null {
  return PERMISOS[rol.toLowerCase()] ?? null // null = admin = ve todo
}

export default function Sidebar({
  onClose,
  userRole = 'admin',
}: {
  onClose?: () => void
  userRole?: string
}) {
  const pathname = usePathname()

  const rutasPermitidas = getRutas(userRole)
  const itemsVisibles = rutasPermitidas
    ? navItems.filter(item => rutasPermitidas.includes(item.href))
    : navItems

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="flex flex-col h-full bg-gradient-to-b from-amber-950 to-stone-900 text-white">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
            <span className="text-xl">☕</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm leading-tight truncate">ALCARAVÁN</h1>
            <p className="text-amber-300/70 text-[10px] uppercase tracking-widest">Minimarket Café</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {itemsVisibles.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
                isActive
                  ? 'bg-amber-700 text-white shadow-lg shadow-amber-900/50'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )}
            >
              <span className="text-base leading-none flex-shrink-0">{item.icon}</span>
              <span className="font-medium truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10 space-y-2">
        <p className="text-white/40 text-[10px] text-center capitalize">Rol: {userRole}</p>
        <button
          onClick={handleLogout}
          className="w-full py-2 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
        >
          🚪 Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
