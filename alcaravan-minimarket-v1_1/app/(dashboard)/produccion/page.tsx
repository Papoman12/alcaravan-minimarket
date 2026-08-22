'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

interface ProductionOrder {
  id: string
  order_number: string
  product_name: string
  quantity: number
  unit: string
  status: string
  notes?: string
  scheduled_date?: string
  created_at: string
}

const STATUS = [
  { key: 'pending', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  { key: 'in_progress', label: 'En producción', color: 'bg-blue-100 text-blue-700', icon: '⚙️' },
  { key: 'completed', label: 'Completado', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  { key: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-600', icon: '❌' },
]

export default function ProduccionPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ product_name: '', quantity: '', unit: 'unidades', scheduled_date: '', notes: '' })
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('production_orders').select('*').order('created_at', { ascending: false }).limit(100)
    setOrders(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.product_name || !form.quantity) return
    setSaving(true)
    const num = 'P' + Date.now().toString().slice(-8)
    await supabase.from('production_orders').insert({
      order_number: num,
      product_name: form.product_name,
      quantity: parseFloat(form.quantity),
      unit: form.unit,
      scheduled_date: form.scheduled_date || null,
      notes: form.notes || null,
      status: 'pending',
    })
    setSaving(false)
    setShowModal(false)
    setForm({ product_name: '', quantity: '', unit: 'unidades', scheduled_date: '', notes: '' })
    load()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('production_orders').update({ status }).eq('id', id)
    load()
  }

  const getStatus = (key: string) => STATUS.find(s => s.key === key) ?? { label: key, color: 'bg-stone-100 text-stone-600', icon: '📦' }
  const active = orders.filter(o => ['pending','in_progress'].includes(o.status))

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Producción</h1>
          <p className="text-stone-500 text-sm mt-0.5">{active.length} órdenes activas</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20">
          + Nueva Orden
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">👨‍🍳</p><p className="text-stone-500">No hay órdenes de producción</p></div>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => {
            const st = getStatus(o.status)
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-stone-400">{o.order_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.icon} {st.label}</span>
                  </div>
                  <p className="font-semibold text-stone-800">{o.product_name}</p>
                  <p className="text-sm text-stone-500">Cantidad: <span className="font-medium">{o.quantity} {o.unit}</span></p>
                  {o.scheduled_date && <p className="text-sm text-stone-400">Fecha: {formatDate(o.scheduled_date)}</p>}
                  {o.notes && <p className="text-sm text-stone-400 italic mt-1">"{o.notes}"</p>}
                </div>
                {!['completed','cancelled'].includes(o.status) && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {o.status === 'pending' && (
                      <button onClick={() => updateStatus(o.id, 'in_progress')} className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors">
                        ⚙️ Iniciar
                      </button>
                    )}
                    <button onClick={() => updateStatus(o.id, 'completed')} className="text-xs px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors">
                      ✅ Completar
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
            <h3 className="text-lg font-bold text-stone-800 mb-4">Nueva Orden de Producción</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Producto *</label>
                <input type="text" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} placeholder="Ej: Café tinto, Sandwich..." className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Cantidad *</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Unidad</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                    <option value="unidades">Unidades</option>
                    <option value="litros">Litros</option>
                    <option value="kg">Kg</option>
                    <option value="porciones">Porciones</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Fecha programada</label>
                <input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none" placeholder="Instrucciones especiales..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.product_name || !form.quantity} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
