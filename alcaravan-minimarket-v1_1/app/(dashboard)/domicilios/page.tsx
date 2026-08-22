'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface Delivery {
  id: string
  delivery_number: string
  customer_name: string
  address: string
  phone?: string
  total: number
  status: string
  notes?: string
  created_at: string
}

const STATUS_OPTIONS = [
  { key: 'pending', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  { key: 'confirmed', label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: '✅' },
  { key: 'preparing', label: 'Preparando', color: 'bg-orange-100 text-orange-700', icon: '👨‍🍳' },
  { key: 'on_way', label: 'En camino', color: 'bg-purple-100 text-purple-700', icon: '🚚' },
  { key: 'delivered', label: 'Entregado', color: 'bg-emerald-100 text-emerald-700', icon: '🏁' },
  { key: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-600', icon: '❌' },
]

export default function DomiciliosPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [form, setForm] = useState({ customer_name: '', address: '', phone: '', total: '', notes: '' })
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('deliveries').select('*').order('created_at', { ascending: false }).limit(100)
    setDeliveries(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.customer_name || !form.address) return
    setSaving(true)
    const num = 'D' + Date.now().toString().slice(-8)
    await supabase.from('deliveries').insert({
      delivery_number: num,
      customer_name: form.customer_name,
      address: form.address,
      phone: form.phone || null,
      total: parseFloat(form.total) || 0,
      notes: form.notes || null,
      status: 'pending',
    })
    setSaving(false)
    setShowModal(false)
    setForm({ customer_name: '', address: '', phone: '', total: '', notes: '' })
    load()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('deliveries').update({ status }).eq('id', id)
    load()
  }

  const filtered = activeFilter === 'all' ? deliveries : deliveries.filter(d => d.status === activeFilter)
  const getStatus = (key: string) => STATUS_OPTIONS.find(s => s.key === key) ?? { label: key, color: 'bg-stone-100 text-stone-600', icon: '📦' }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Domicilios</h1>
          <p className="text-stone-500 text-sm mt-0.5">{deliveries.filter(d => ['pending','confirmed','preparing','on_way'].includes(d.status)).length} activos</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20">
          + Nuevo Domicilio
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <button onClick={() => setActiveFilter('all')} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${activeFilter === 'all' ? 'bg-amber-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>Todos</button>
        {STATUS_OPTIONS.map(s => (
          <button key={s.key} onClick={() => setActiveFilter(s.key)} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${activeFilter === s.key ? 'bg-amber-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">🚚</p><p className="text-stone-500">No hay domicilios</p></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((d) => {
            const st = getStatus(d.status)
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-stone-400">{d.delivery_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.icon} {st.label}</span>
                    </div>
                    <p className="font-semibold text-stone-800">{d.customer_name}</p>
                    <p className="text-sm text-stone-500">📍 {d.address}</p>
                    {d.phone && <p className="text-sm text-stone-500">📞 {d.phone}</p>}
                    {d.notes && <p className="text-sm text-stone-400 mt-1">{d.notes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-amber-700">{formatCurrency(d.total)}</p>
                  </div>
                </div>
                {!['delivered','cancelled'].includes(d.status) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
                    {STATUS_OPTIONS.filter(s => !['delivered','cancelled'].includes(s.key) && s.key !== d.status).slice(0, 3).map(s => (
                      <button key={s.key} onClick={() => updateStatus(d.id, s.key)} className="text-xs px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors">
                        {s.icon} {s.label}
                      </button>
                    ))}
                    <button onClick={() => updateStatus(d.id, 'delivered')} className="text-xs px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors ml-auto">
                      🏁 Entregado
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Nuevo Domicilio</h3>
            <div className="space-y-3">
              {[
                { key: 'customer_name', label: 'Cliente *', placeholder: 'Nombre del cliente' },
                { key: 'address', label: 'Dirección *', placeholder: 'Calle 123 # 45-67' },
                { key: 'phone', label: 'Teléfono', placeholder: '300 000 0000' },
                { key: 'total', label: 'Total ($)', placeholder: '0', type: 'number' },
                { key: 'notes', label: 'Notas', placeholder: 'Instrucciones de entrega...' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
                  <input type={type ?? 'text'} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.customer_name || !form.address} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
