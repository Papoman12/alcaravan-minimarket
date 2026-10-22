'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsAdmin } from '@/lib/useIsAdmin'

const BRANCH_ID = '56916f1b-17dc-4c3d-8e65-a7d2a6554891'

interface Customer {
  id: string
  first_name: string
  last_name?: string
  full_name?: string
  document_type?: string
  document_number?: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  city?: string
  is_active: boolean
  created_at: string
}

const DOC_TYPES = ['CC', 'NIT', 'CE', 'PP', 'Otro']

export default function ClientesPage() {
  const isAdmin = useIsAdmin()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '', last_name: '', document_type: 'CC', document_number: '',
    phone: '', whatsapp: '', email: '', address: '', city: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('first_name')
      .limit(200)
    setCustomers(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setError('')
    setForm({ first_name: '', last_name: '', document_type: 'CC', document_number: '', phone: '', whatsapp: '', email: '', address: '', city: '' })
    setShowModal(true)
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setError('')
    setForm({
      first_name: c.first_name,
      last_name: c.last_name ?? '',
      document_type: c.document_type ?? 'CC',
      document_number: c.document_number ?? '',
      phone: c.phone ?? '',
      whatsapp: c.whatsapp ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      city: c.city ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.first_name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const fullName = [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(' ')
    const payload = {
      branch_id: BRANCH_ID,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      full_name: fullName,
      document_type: form.document_type || null,
      document_number: form.document_number.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      is_active: true,
    }
    if (editing) {
      const { error: err } = await supabase.from('customers').update(payload).eq('id', editing.id)
      if (err) { setError('Error al actualizar: ' + err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('customers').insert(payload)
      if (err) {
        if (err.code === '23505') { setError('Error al guardar. Verifica que el documento no esté duplicado.') }
        else { setError('Error al guardar: ' + err.message) }
        setSaving(false); return
      }
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    const { error: err } = await supabase.from('customers').delete().eq('id', id)
    if (err) { alert('Error al eliminar: ' + err.message); return }
    load()
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return !q || c.first_name.toLowerCase().includes(q) || (c.last_name ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) || (c.document_number ?? '').includes(q)
  })

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Clientes</h1>
          <p className="text-stone-500 text-sm mt-0.5">{customers.length} registrados</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors">
          + Nuevo Cliente
        </button>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono o documento..."
        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 mb-4" />

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">👥</p><p className="text-stone-500">No hay clientes registrados</p></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-800">{c.full_name ?? c.first_name}</p>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  {c.document_number && <span className="text-sm text-stone-500">{c.document_type} {c.document_number}</span>}
                  {c.phone && <span className="text-sm text-stone-500">📞 {c.phone}</span>}
                  {c.city && <span className="text-sm text-stone-400">{c.city}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(c)} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50">Editar</button>
                {isAdmin && (
                  <button onClick={() => handleDelete(c.id)} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-800 mb-4">{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            {error && <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm mb-4">{error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
                  <input type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Nombre"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Apellido</label>
                  <input type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Apellido"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Tipo doc.</label>
                  <select value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                    {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Número doc.</label>
                  <input type="text" value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} placeholder="123456789"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="300 000 0000"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">WhatsApp</label>
                  <input type="tel" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="300 000 0000"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Dirección</label>
                  <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Calle 1 # 2-3"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Ciudad</label>
                  <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Ciudad"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300">
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
