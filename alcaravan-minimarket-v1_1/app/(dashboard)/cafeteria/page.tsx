'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface Order {
  id: string
  order_number: string
  table_number?: string
  customer_name?: string
  total: number
  status: string
  notes?: string
  created_at: string
}

const STATUS = [
  { key: 'received', label: 'Recibido', color: 'bg-blue-100 text-blue-700', icon: '📋' },
  { key: 'preparing', label: 'Preparando', color: 'bg-orange-100 text-orange-700', icon: '👨‍🍳' },
  { key: 'ready', label: 'Listo', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  { key: 'delivered', label: 'Entregado', color: 'bg-stone-100 text-stone-600', icon: '🏁' },
  { key: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-600', icon: '❌' },
]

export default function CafeteriaPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('active')
  const [form, setForm] = useState({ table_number: '', customer_name: '', total: '', notes: '' })
  const supabase = createClient()

  useEffect(() => { load() }, [])
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  async function load() {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100)
    setOrders(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const num = 'M' + Date.now().toString().slice(-6)
    await supabase.from('orders').insert({
      order_number: num,
      table_number: form.table_number || null,
      customer_name: form.customer_name || null,
      total: parseFloat(form.total) || 0,
      subtotal: parseFloat(form.total) || 0,
      notes: form.notes || null,
      status: 'received',
    })
    setSaving(false)
    setShowModal(false)
    setForm({ table_number: '', customer_name: '', total: '', notes: '' })
    load()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('orders').update({ status }).eq('id', id)
    load()
  }

  const filtered = filter === 'active'
    ? orders.filter(o => ['received','preparing','ready'].includes(o.status))
    : filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const getStatus = (key: string) => STATUS.find(s => s.key === key) ?? { label: key, color: 'bg-stone-100 text-stone-600', icon: '📦' }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Cafetería</h1>
          <p className="text-stone-500 text-sm mt-0.5">{orders.filter(o => ['received','preparing','ready'].includes(o.status)).length} pedidos activos</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20">
          + Nuevo Pedido
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {[{key:'active',label:'Activos'},{key:'all',label:'Todos'},{key:'delivered',label:'Entregados'}].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filter === f.key ? 'bg-amber-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">☕</p><p className="text-stone-500">No hay pedidos activos</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((o) => {
            const st = getStatus(o.status)
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-stone-400">{o.order_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.icon} {st.label}</span>
                </div>
                {o.table_number && <p className="font-bold text-stone-800">Mesa {o.table_number}</p>}
                {o.customer_name && <p className="text-sm text-stone-600">{o.customer_name}</p>}
                {o.notes && <p className="text-sm text-stone-400 mt-1 italic">"{o.notes}"</p>}
                <p className="font-bold text-amber-700 mt-2">{formatCurrency(o.total)}</p>
                {!['delivered','cancelled'].includes(o.status) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100">
                    {o.status !== 'preparing' && (
                      <button onClick={() => updateStatus(o.id, 'preparing')} className="flex-1 text-xs py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 hover:bg-orange-100 transition-colors">
                        👨‍🍳 Preparando
                      </button>
                    )}
                    {o.status !== 'ready' && (
                      <button onClick={() => updateStatus(o.id, 'ready')} className="flex-1 text-xs py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors">
                        ✅ Listo
                      </button>
                    )}
                    <button onClick={() => updateStatus(o.id, 'delivered')} className="flex-1 text-xs py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors">
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
            <h3 className="text-lg font-bold text-stone-800 mb-4">Nuevo Pedido</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">N° Mesa</label>
                <input type="text" value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} placeholder="Ej: 3" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Cliente</label>
                <input type="text" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Nombre del cliente" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Total ($)</label>
                <input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} placeholder="0" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Descripción del pedido</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Ej: 2 cafés, 1 sandwich..." className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
