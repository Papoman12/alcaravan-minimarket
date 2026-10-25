'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserRow {
  id: string
  email: string
  full_name: string
  phone?: string
  is_active: boolean
  created_at: string
  roles?: { name: string }
}

const ROLES = [
  { value: 'admin', label: '👑 Administrador' },
  { value: 'cashier', label: '🧾 Cajero' },
  { value: 'inventory', label: '📦 Inventario' },
  { value: 'kitchen', label: '👨‍🍳 Cocina / Cafetería' },
  { value: 'delivery', label: '🛵 Domiciliario' },
]

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role_name: 'cashier',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('users')
      .select('id, email, full_name, phone, is_active, created_at, roles(name)')
      .order('created_at', { ascending: false })

    if (err) {
      console.error('Error cargando usuarios:', err.message)
    }
    setUsers((data as UserRow[]) ?? [])
    setLoading(false)
  }

  async function handleCreate() {
    if (!form.full_name || !form.email || !form.password) {
      setError('Nombre, correo y contraseña son obligatorios')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener mínimo 6 caracteres')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role_name: form.role_name,
        }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error ?? 'Error al crear usuario')
        setSaving(false)
        return
      }

      setShowModal(false)
      setSuccessMsg(`✅ Usuario "${form.full_name}" creado correctamente`)
      setForm({ full_name: '', email: '', password: '', phone: '', role_name: 'cashier' })
      setTimeout(() => setSuccessMsg(''), 4000)
      load()
    } catch (err: any) {
      setError('Error de red: ' + err.message)
    }

    setSaving(false)
  }

  async function toggleActive(user: UserRow) {
    const supabase = createClient()
    await supabase
      .from('users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)
    load()
  }

  const roleLabel = (name?: string) =>
    ROLES.find((r) => r.value === name)?.label ?? name ?? '—'

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Usuarios</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {users.filter((u) => u.is_active).length} activos · {users.length} total
          </p>
        </div>
        <button
          onClick={() => { setError(''); setShowModal(true) }}
          className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors"
        >
          + Nuevo Usuario
        </button>
      </div>

      {/* Mensaje de éxito */}
      {successMsg && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium">
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">👤</p>
          <p className="text-stone-500">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <div
              key={u.id}
              className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${
                u.is_active ? 'border-stone-200' : 'border-stone-100 opacity-60'
              }`}
            >
              {/* Avatar */}
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-amber-700">
                  {u.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-stone-800">{u.full_name}</p>
                  {!u.is_active && (
                    <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                      Inactivo
                    </span>
                  )}
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {roleLabel((u.roles as any)?.name)}
                  </span>
                </div>
                <p className="text-sm text-stone-500 mt-0.5">{u.email}</p>
                {u.phone && (
                  <p className="text-xs text-stone-400">📞 {u.phone}</p>
                )}
              </div>

              {/* Acciones */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => toggleActive(u)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                    u.is_active
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  }`}
                >
                  {u.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Nuevo Usuario</h3>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Ej: María García"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Contraseña *
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="300 000 0000"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Rol *
                  </label>
                  <select
                    value={form.role_name}
                    onChange={(e) => setForm({ ...form, role_name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creando...
                  </span>
                ) : (
                  'Crear Usuario'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
