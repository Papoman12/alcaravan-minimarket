'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const BRANCH_ID = '56916f1b-17dc-4c3d-8e65-a7d2a6554891'

interface Order {
  id: string
  order_number: string
  order_type: string
  table_number?: string
  customer_name?: string
  status: string
  notes?: string
  created_at: string
  order_items?: OrderItem[]
}

interface OrderItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  notes?: string
}

interface Product {
  id: string
  name: string
  sale_price: number
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '⏳ Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'preparing', label: '👨‍🍳 Preparando', color: 'bg-blue-100 text-blue-700' },
  { value: 'ready', label: '🔔 Listo', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'delivered', label: '✅ Entregado', color: 'bg-stone-100 text-stone-600' },
  { value: 'cancelled', label: '❌ Cancelado', color: 'bg-red-100 text-red-700' },
]

export default function CafeteriaPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('active')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ order_type: 'dine_in', table_number: '', customer_name: '', notes: '' })
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: number; unit_price: number; notes: string }[]>([])

  useEffect(() => { load(); loadProducts() }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(50)
    setOrders(data ?? [])
    setLoading(false)
  }

  async function loadProducts() {
    const supabase = createClient()
    const { data } = await supabase.from('products').select('id, name, sale_price').eq('is_active', true).order('name')
    setProducts(data ?? [])
  }

  function openNew() {
    setError('')
    setForm({ order_type: 'dine_in', table_number: '', customer_name: '', notes: '' })
    setItems([])
    setShowModal(true)
  }

  function addItem(product: Product) {
    const exists = items.find(i => i.product_id === product.id)
    if (exists) {
      setItems(items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setItems([...items, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.sale_price, notes: '' }])
    }
  }

  function removeItem(productId: string) { setItems(items.filter(i => i.product_id !== productId)) }
  function updateQty(productId: string, qty: number) {
    if (qty <= 0) { removeItem(productId); return }
    setItems(items.map(i => i.product_id === productId ? { ...i, quantity: qty } : i))
  }

  async function handleSave() {
    if (items.length === 0) { setError('Agrega al menos un producto al pedido'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const orderNum = 'CAF-' + Date.now().toString().slice(-8)
    const orderPayload = {
      branch_id: BRANCH_ID,
      order_number: orderNum,
      order_type: form.order_type,
      table_number: form.table_number.trim() || null,
      customer_name: form.customer_name.trim() || null,
      status: 'pending',
      notes: form.notes.trim() || null,
    }
    const { data: orderData, error: orderErr } = await supabase.from('orders').insert(orderPayload).select().single()
    if (orderErr) { setError('Error al crear pedido: ' + orderErr.message); setSaving(false); return }
    const itemsPayload = items.map(i => ({
      order_id: orderData.id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      notes: i.notes.trim() || null,
      status: 'pending',
    }))
    const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload)
    if (itemsErr) { setError('Error al guardar items: ' + itemsErr.message); setSaving(false); return }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function updateStatus(id: string, status: string) {
    const supabase = createClient()
    await supabase.from('orders').update({ status }).eq('id', id)
    load()
  }

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status))
  const displayed = filterStatus === 'active' ? activeOrders : orders
  const statusInfo = (s: string) => STATUS_OPTIONS.find(x => x.value === s) ?? { label: s, color: 'bg-stone-100 text-stone-600' }
  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Cafetería</h1>
          <p className="text-stone-500 text-sm mt-0.5">{activeOrders.length} pedidos activos</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors">
          + Nuevo Pedido
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilterStatus('active')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filterStatus === 'active' ? 'bg-amber-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>
          Activos ({activeOrders.length})
        </button>
        <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${filterStatus === 'all' ? 'bg-amber-700 text-white' : 'bg-white border border-stone-200 text-stone-600'}`}>
          Todos ({orders.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">☕</p><p className="text-stone-500">No hay pedidos activos</p></div>
      ) : (
        <div className="grid gap-3">
          {displayed.map(o => {
            const si = statusInfo(o.status)
            const orderItems = o.order_items ?? []
            const orderTotal = orderItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0)
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">☕</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-stone-800">
                        {o.table_number ? `Mesa ${o.table_number}` : o.customer_name ?? o.order_number}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${si.color}`}>{si.label}</span>
                    </div>
                    {orderItems.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {orderItems.map(item => (
                          <p key={item.id} className="text-sm text-stone-600">× {item.quantity} {item.product_name} — {fmt(item.unit_price * item.quantity)}</p>
                        ))}
                      </div>
                    )}
                    {orderTotal > 0 && <p className="text-sm font-bold text-amber-700 mt-1">Total: {fmt(orderTotal)}</p>}
                    <p className="text-xs text-stone-400 mt-0.5">{new Date(o.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                {!['delivered', 'cancelled'].includes(o.status) && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {STATUS_OPTIONS.filter(s => s.value !== o.status && s.value !== 'cancelled').map(s => (
                      <button key={s.value} onClick={() => updateStatus(o.id, s.value)}
                        className={`px-3 py-1 text-xs rounded-lg font-medium ${s.color}`}>→ {s.label}</button>
                    ))}
                    <button onClick={() => updateStatus(o.id, 'cancelled')} className="px-3 py-1 text-xs rounded-lg font-medium bg-red-50 text-red-600">Cancelar</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Nuevo Pedido</h3>
            {error && <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm mb-4">{error}</div>}
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-3 gap-2">
                {['dine_in', 'takeaway', 'delivery'].map(t => (
                  <button key={t} onClick={() => setForm({ ...form, order_type: t })}
                    className={`py-2 rounded-xl text-sm font-medium border transition-colors ${form.order_type === t ? 'bg-amber-700 text-white border-amber-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                    {t === 'dine_in' ? '🪑 Mesa' : t === 'takeaway' ? '🥡 Para llevar' : '🛵 Domicilio'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {form.order_type === 'dine_in' && (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Número de mesa</label>
                    <input type="text" value={form.table_number} onChange={e => setForm({ ...form, table_number: e.target.value })} placeholder="1, 2, 3..."
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Cliente (opcional)</label>
                  <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} placeholder="Nombre"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
            </div>

            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Productos</p>
            <div className="grid grid-cols-2 gap-2 mb-4 max-h-48 overflow-y-auto">
              {products.map(p => (
                <button key={p.id} onClick={() => addItem(p)}
                  className="text-left px-3 py-2 bg-stone-50 hover:bg-amber-50 rounded-xl border border-stone-200 hover:border-amber-300 transition-colors">
                  <p className="text-sm font-medium text-stone-800 truncate">{p.name}</p>
                  <p className="text-xs text-amber-700">{fmt(p.sale_price)}</p>
                </button>
              ))}
            </div>

            {items.length > 0 && (
              <div className="bg-stone-50 rounded-xl p-3 mb-4 space-y-2">
                <p className="text-xs font-semibold text-stone-500 uppercase">Pedido</p>
                {items.map(item => (
                  <div key={item.product_id} className="flex items-center gap-2">
                    <p className="flex-1 text-sm text-stone-700 truncate">{item.product_name}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-6 h-6 bg-stone-200 rounded-lg text-sm flex items-center justify-center hover:bg-stone-300">−</button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-6 h-6 bg-stone-200 rounded-lg text-sm flex items-center justify-center hover:bg-stone-300">+</button>
                    </div>
                    <p className="text-sm font-medium text-stone-700 w-20 text-right">{fmt(item.quantity * item.unit_price)}</p>
                    <button onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
                <div className="border-t border-stone-200 pt-2 flex justify-between">
                  <span className="font-semibold text-stone-700">Total</span>
                  <span className="font-bold text-amber-700">{fmt(total)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || items.length === 0} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300">
                {saving ? 'Guardando...' : 'Crear Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
