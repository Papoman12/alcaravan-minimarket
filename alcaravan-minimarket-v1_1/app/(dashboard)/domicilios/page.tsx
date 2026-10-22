'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsAdmin } from '@/lib/useIsAdmin'

const BRANCH_ID = '56916f1b-17dc-4c3d-8e65-a7d2a6554891'

interface Delivery {
  id: string
  customer_name: string
  customer_phone?: string
  delivery_address: string
  delivery_reference?: string
  city?: string
  delivery_fee?: number
  payment_method?: string
  status: string
  notes?: string
  created_at: string
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '⏳ Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'assigned', label: '👤 Asignado', color: 'bg-blue-100 text-blue-700' },
  { value: 'picked_up', label: '🛵 En camino', color: 'bg-orange-100 text-orange-700' },
  { value: 'delivered', label: '✅ Entregado', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: '❌ Cancelado', color: 'bg-red-100 text-red-700' },
]

const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta']

export default function DomiciliosPage() {
  const isAdmin = useIsAdmin()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Delivery | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', delivery_address: '',
    delivery_reference: '', city: '', delivery_fee: '', payment_method: 'Efectivo', notes: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('deliveries').select('*').order('created_at', { ascending: false }).limit(100)
    setDeliveries(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null); setError('')
    setForm({ customer_name: '', customer_phone: '', delivery_address: '', delivery_reference: '', city: '', delivery_fee: '', payment_method: 'Efectivo', notes: '' })
    setShowModal(true)
  }

  function openEdit(d: Delivery) {
    setEditing(d); setError('')
    setForm({
      customer_name: d.customer_name, customer_phone: d.customer_phone ?? '',
      delivery_address: d.delivery_address, delivery_reference: d.delivery_reference ?? '',
      city: d.city ?? '', delivery_fee: d.delivery_fee?.toString() ?? '',
      payment_method: d.payment_method ?? 'Efectivo', notes: d.notes ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.customer_name || !form.delivery_address) { setError('Nombre del cliente y dirección son obligatorios'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const payload = {
      branch_id: BRANCH_ID,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || null,
      delivery_address: form.delivery_address.trim(),
      delivery_reference: form.delivery_reference.trim() || null,
      city: form.city.trim() || null,
      delivery_fee: form.delivery_fee ? parseFloat(form.delivery_fee) : 0,
      payment_method: form.payment_method,
      status: 'pending',
      notes: form.notes.trim() || null,
    }
    if (editing) {
      const { error: err } = await supabase.from('deliveries').update(payload).eq('id', editing.id)
      if (err) { setError('Error al actualizar: ' + err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('deliveries').insert(payload)
      if (err) { setError('Error al guardar: ' + err.message); setSaving(false); return }
    }
    setSaving(false); setShowModal(false); load()
  }

  async function updateStatus(id: string, status: string) {
    const supabase = createClient()
    await supabase.from('deliveries').update({ status }).eq('id', id)
    load()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este domicilio? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    const { error: err } = await supabase.from('deliveries').delete().eq('id', id)
    if (err) { alert('Error al eliminar: ' + err.message); return }
    load()
  }

  const filtered = filterStatus === 'all' ? deliveries : deliveries.filter(d => d.status === filterStatus)
  const statusInfo = (s: string) => STATUS_OPTIONS.find(x => x.value === s) ?? { label: s, color: 'bg-stone-100 text-stone-600' }
  const fmt = (n?: number) => n != null ? '$' + n.toLocaleString('es-CO') : '—'

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Domicilios</h1>
          <p className="text-stone-500 text-sm mt-0.5">{deliveries.filter(d => d.status === 'pending').length} pendientes · {deliveries.length} total</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors">+ Nuevo Domicilio</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filterStatus === 'all' ? 'bg-amber-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
          Todos ({deliveries.length})
        </button>
        {STATUS_OPTIONS.map(s => (
          <button key={s.value} onClick={() => setFilterStatus(s.value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filterStatus === s.value ? 'bg-amber-700 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
            {s.label} ({deliveries.filter(d => d.status === s.value).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">🛵</p><p className="text-stone-500">No hay domicilios</p></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(d => {
            const si = statusInfo(d.status)
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-2xl">🛵</span></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-stone-800">{d.customer_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${si.color}`}>{si.label}</span>
                    </div>
                    <p className="text-sm text-stone-600 mt-0.5">📍 {d.delivery_address}{d.city ? `, ${d.city}` : ''}</p>
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {d.customer_phone && <span className="text-sm text-stone-500">📞 {d.customer_phone}</span>}
                      {d.delivery_fee != null && d.delivery_fee > 0 && <span className="text-sm font-medium text-amber-700">Flete: {fmt(d.delivery_fee)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(d)} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50">Editar</button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(d.id)} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Eliminar</button>
                    )}
                  </div>
                </div>
                {d.status !== 'delivered' && d.status !== 'cancelled' && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {STATUS_OPTIONS.filter(s => s.value !== d.status && s.value !== 'cancelled').map(s => (
                      <button key={s.value} onClick={() => updateStatus(d.id, s.value)} className={`px-3 py-1 text-xs rounded-lg font-medium ${s.color}`}>→ {s.label}</button>
                    ))}
                    <button onClick={() => updateStatus(d.id, 'cancelled')} className="px-3 py-1 text-xs rounded-lg font-medium bg-red-50 text-red-600">Cancelar</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-800 mb-4">{editing ? 'Editar Domicilio' : 'Nuevo Domicilio'}</h3>
            {error && <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm mb-4">{error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nombre cliente *</label>
                  <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} placeholder="Nombre"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
                  <input type="tel" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} placeholder="300 000 0000"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Dirección *</label>
                <input type="text" value={form.delivery_address} onChange={e => setForm({ ...form, delivery_address: e.target.value })} placeholder="Calle 1 # 2-3"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Referencia</label>
                  <input type="text" value={form.delivery_reference} onChange={e => setForm({ ...form, delivery_reference: e.target.value })} placeholder="Casa amarilla..."
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Ciudad</label>
                  <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Ciudad"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Costo domicilio</label>
                  <input type="number" value={form.delivery_fee} onChange={e => setForm({ ...form, delivery_fee: e.target.value })} placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Pago</label>
                  <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                    {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Instrucciones especiales..."
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none" />
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
