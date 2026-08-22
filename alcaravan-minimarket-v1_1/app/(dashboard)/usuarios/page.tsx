'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AppUser {
  id: string
  email: string
  full_name: string
  phone?: string
  role: string
  is_active: boolean
  created_at: string
}

const ROLES: Record<string, { label: string; color: string; icon: string }> = {
  admin: { label: 'Administrador', color: 'bg-purple-100 text-purple-700', icon: '👑' },
  cashier: { label: 'Cajero', color: 'bg-blue-100 text-blue-700', icon: '💵' },
  inventory: { label: 'Inventario', color: 'bg-amber-100 text-amber-700', icon: '📦' },
  kitchen: { label: 'Cocina', color: 'bg-orange-100 text-orange-700', icon: '👨‍🍳' },
  delivery: { label: 'Domiciliario', color: 'bg-green-100 text-green-700', icon: '🚚' },
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteRole, setInviteRole] = useState('cashier')
  const [inviteName, setInviteName] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', role: 'cashier' })
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('full_name')
    setUsers(data ?? [])
    setLoading(false)
  }

  async function handleInvite() {
    if (!inviteEmail || !invitePassword || !inviteName) return
    setSaving(true)
    setInviteMsg('')
    try {
      // Crear usuario en Supabase Auth usando admin
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, password: invitePassword, full_name: inviteName, phone: invitePhone, role: inviteRole }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Error')
      setInviteMsg('✅ Usuario creado exitosamente')
      setInviteEmail('')
      setInvitePassword('')
      setInviteName('')
      setInvitePhone('')
      load()
      setTimeout(() => { setShowInvite(false); setInviteMsg('') }, 2000)
    } catch (err: any) {
      setInviteMsg(`❌ ${err.message}`)
    }
    setSaving(false)
  }

  async function handleEdit() {
    if (!editing) return
    setSaving(true)
    await supabase.from('users').update({ full_name: editForm.full_name, phone: editForm.phone, role: editForm.role }).eq('id', editing.id)
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function toggleActive(u: AppUser) {
    await supabase.from('users').update({ is_active: !u.is_active }).eq('id', u.id)
    load()
  }

  function openEdit(u: AppUser) {
    setEditing(u)
    setEditForm({ full_name: u.full_name, phone: u.phone ?? '', role: u.role })
    setShowModal(true)
  }

  const roleInfo = (role: string) => ROLES[role] ?? { label: role, color: 'bg-stone-100 text-stone-600', icon: '👤' }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Usuarios</h1>
          <p className="text-stone-500 text-sm mt-0.5">{users.filter(u => u.is_active).length} activos</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20">
          + Nuevo Usuario
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">👤</p><p className="text-stone-500">No hay usuarios registrados</p></div>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => {
            const r = roleInfo(u.role)
            return (
              <div key={u.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${u.is_active ? 'border-stone-200' : 'border-stone-100 opacity-60'}`}>
                <div className="w-12 h-12 bg-amber-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow">
                  <span className="text-white font-bold text-lg">{u.full_name?.[0]?.toUpperCase() ?? '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-stone-800">{u.full_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.color}`}>{r.icon} {r.label}</span>
                    {!u.is_active && <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                  </div>
                  <p className="text-sm text-stone-500 mt-0.5">✉️ {u.email}</p>
                  {u.phone && <p className="text-sm text-stone-500">📞 {u.phone}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(u)} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors">Editar</button>
                  <button onClick={() => toggleActive(u)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                    {u.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal editar */}
      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Editar Usuario</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre completo</label>
                <input type="text" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
                <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="300 000 0000" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Rol</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={handleEdit} disabled={saving} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear usuario */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-1">Nuevo Usuario</h3>
            <p className="text-sm text-stone-500 mb-4">El usuario podrá ingresar con este correo y contraseña</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre completo *</label>
                <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nombre del empleado" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico *</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="empleado@alcaravan.com" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña *</label>
                <input type="text" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
                <input type="text" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="300 000 0000" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Rol</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
            </div>
            {inviteMsg && (
              <div className={`mt-3 px-3 py-2 rounded-xl text-sm ${inviteMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {inviteMsg}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowInvite(false); setInviteMsg('') }} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={handleInvite} disabled={saving || !inviteEmail || !invitePassword || !inviteName} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors">
                {saving ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
