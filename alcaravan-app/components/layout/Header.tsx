'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'

interface HeaderProps {
  title: string
  onMenuToggle: () => void
}

export default function Header({ title, onMenuToggle }: HeaderProps) {
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const now = new Date()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-stone-200 flex items-center px-4 gap-3 sticky top-0 z-30 shadow-sm">
      {/* Hamburger menu (mobile) */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-600"
        aria-label="Menú"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Título */}
      <h2 className="font-semibold text-stone-800 text-base flex-1 truncate">{title}</h2>

      {/* Fecha y hora */}
      <span className="hidden sm:block text-xs text-stone-500 tabular-nums">
        {formatDateTime(now)}
      </span>

      {/* Notificaciones */}
      <button className="relative p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-500">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {/* Badge de notificación */}
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* Avatar de usuario */}
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-stone-100 transition-colors"
        >
          <div className="w-8 h-8 bg-amber-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow">
            A
          </div>
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-xl border border-stone-200 py-1 z-50 animate-fade-in">
            <div className="px-4 py-3 border-b border-stone-100">
              <p className="text-sm font-medium text-stone-800">Administrador</p>
              <p className="text-xs text-stone-500 truncate">admin@alcaravan.com</p>
            </div>
            <a href="/configuracion" className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors">
              <span>⚙️</span> Configuración
            </a>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <span>🚪</span> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
