'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Supplier {
  id: string
  name: string
  contact_name?: string
  phone?: string
  whatsapp?: string
  email?: string
  nit?: string
  city?: string
  payment_terms_type: string
  is_active: boolean
}

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', whatsapp: '', email: '', nit: '', city: '', payment_terms_type: 'cash' })
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', contact_name: '', phone: '', whatsapp: '', email: '', nit: '', city: '', payment_terms_type: 'cash' })
    setShowModal(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({ name: s.name, contact_name: s.contact_name ?? '', phone: s.phone ?? '', whatsapp: s.whatsapp ?? '', email: s.email ?? '', nit: s.nit ?? '', city: s.city ?? '', payment_terms_type: s.payment_terms_type })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    if (editing) {
      await supabase.from('suppliers').update({ ...form }).eq('id', editing.id)
    } else {
      await supabase.from('suppliers').insert({ ...form, payment_terms: 0, is_active: true })
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function toggleActive(s: Supplier) {
    await supabase.from('suppliers').update({ is_active: !s.is_active }).eq('id', s.id)
    load()
  }

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const paymentLabel: Record<string, string> = { cash: 'Contado', credit: 'Crédito', consignment: 'Consignación' }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Proveedores</h1>
          <p className="text-stone-500 text-sm mt-0.5">{suppliers.filter(s => s.is_active).length} activos</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20">
          + Nuevo Proveedor
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proveedor..."
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => (
            <div key={s.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${s.is_active ? 'border-stone-200' : 'border-stone-100 opacity-60'}`}>
              <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🏭</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-stone-800 truncate">{s.name}</p>
                  {!s.is_active && <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  {s.contact_name && <p className="text-sm text-stone-500">👤 {s.contact_name}</p>}
                  {s.phone && <p className="text-sm text-stone-500">📞 {s.phone}</p>}
                  {s.city && <p className="text-sm text-stone-500">📍 {s.city}</p>}
                  <p className="text-sm text-stone-500">💳 {paymentLabel[s.payment_terms_type] ?? s.payment_terms_type}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(s)} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors">Editar</button>
                <button onClick={() => toggleActive(s)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${s.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                  {s.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">🏭</p>
              <p className="text-stone-400">No hay proveedores</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-800 mb-4">{editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
            <div className="space-y-3">
              {[
                { key: 'name', label: 'Nombre *', placeholder: 'Nombre del proveedor' },
                { key: 'contact_name', label: 'Contacto', placeholder: 'Nombre del contacto' },
                { key: 'nit', label: 'NIT', placeholder: '000.000.000-0' },
                { key: 'phone', label: 'Teléfono', placeholder: '300 000 0000' },
                { key: 'whatsapp', label: 'WhatsApp', placeholder: '300 000 0000' },
                { key: 'email', label: 'Email', placeholder: 'proveedor@email.com' },
                { key: 'city', label: 'Ciudad', placeholder: 'Bogotá' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Forma de pago</label>
                <select
                  value={form.payment_terms_type}
                  onChange={(e) => setForm({ ...form, payment_terms_type: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                >
                  <option value="cash">Contado</option>
                  <option value="credit">Crédito</option>
                  <option value="consignment">Consignación</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
