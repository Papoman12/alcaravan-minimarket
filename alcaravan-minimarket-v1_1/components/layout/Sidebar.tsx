'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/pos', icon: '🛒', label: 'Punto de Venta' },
  { href: '/productos', icon: '📦', label: 'Productos' },
  { href: '/inventario', icon: '📊', label: 'Inventario' },
  { href: '/compras', icon: '🧾', label: 'Compras', phase: 2 },
  { href: '/proveedores', icon: '🏭', label: 'Proveedores', phase: 2 },
  { href: '/cafeteria', icon: '☕', label: 'Cafetería', phase: 3 },
  { href: '/produccion', icon: '👨‍🍳', label: 'Producción', phase: 3 },
  { href: '/domicilios', icon: '🚚', label: 'Domicilios', phase: 4 },
  { href: '/clientes', icon: '👥', label: 'Clientes' },
  { href: '/promociones', icon: '🎁', label: 'Promociones', phase: 4 },
  { href: '/caja', icon: '💰', label: 'Caja' },
  { href: '/gastos', icon: '💳', label: 'Gastos', phase: 2 },
  { href: '/reportes', icon: '📈', label: 'Reportes' },
  { href: '/ai', icon: '🤖', label: 'Alcaraván AI', phase: 5 },
  { href: '/configuracion', icon: '⚙️', label: 'Configuración' },
]

// Módulos activos en Fase 1
const activePhase1 = ['/', '/pos', '/productos', '/inventario', '/clientes', '/caja', '/reportes', '/configuracion']

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col h-full bg-gradient-to-b from-amber-950 to-stone-900 text-white">
      {/* Logo */}
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

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          const isEnabled = activePhase1.includes(item.href)

          return (
            <Link
              key={item.href}
              href={isEnabled ? item.href : '#'}
              onClick={isEnabled ? onClose : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group',
                isActive && isEnabled
                  ? 'bg-amber-700 text-white shadow-lg shadow-amber-900/50'
                  : isEnabled
                  ? 'text-white/70 hover:text-white hover:bg-white/10'
                  : 'text-white/25 cursor-not-allowed'
              )}
            >
              <span className="text-base leading-none flex-shrink-0">{item.icon}</span>
              <span className="font-medium truncate">{item.label}</span>
              {item.phase && !isEnabled && (
                <span className="ml-auto text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  F{item.phase}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-white/30 text-[10px] text-center">
          v1.0 — Fase 1 MVP
        </p>
      </div>
    </aside>
  )
}
