'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Purchase {
  id: string
  purchase_number: string
  total: number
  status: string
  created_at: string
  notes?: string
  supplier?: { name: string }
}

interface Supplier {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  code?: string
  purchase_price: number
  stock: number
  unit?: { abbreviation: string }
}

interface PurchaseItem {
  product: Product
  quantity: number
  unit_cost: number
}

// ─── Modal Nueva Compra ───────────────────────────────────────────────────────
function NuevaCompraModal({
  suppliers,
  onClose,
  onSaved,
}: {
  suppliers: Supplier[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Buscar productos
  useEffect(() => {
    const q = search.trim()
    if (!q) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('products')
        .select('id, name, code, purchase_price, stock, unit:units_of_measure(abbreviation)')
        .eq('is_active', true)
        .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
        .order('name')
        .limit(10)
      setSearchResults((data ?? []) as unknown as Product[])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  function addProduct(product: Product) {
    // Si ya está, no agregar de nuevo
    if (items.find(i => i.product.id === product.id)) {
      setSearch('')
      setSearchResults([])
      return
    }
    setItems(prev => [...prev, {
      product,
      quantity: 1,
      unit_cost: product.purchase_price,
    }])
    setSearch('')
    setSearchResults([])
    searchRef.current?.focus()
  }

  function removeItem(productId: string) {
    setItems(prev => prev.filter(i => i.product.id !== productId))
  }

  function updateItem(productId: string, field: 'quantity' | 'unit_cost', value: number) {
    setItems(prev => prev.map(i =>
      i.product.id === productId ? { ...i, [field]: value } : i
    ))
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0)

  async function handleSave() {
    if (!supplierId) { setError('Selecciona un proveedor'); return }
    if (items.length === 0) { setError('Agrega al menos un producto'); return }
    setError('')
    setSaving(true)

    try {
      const purchaseNumber = 'C' + Date.now().toString().slice(-8)

      // 1. Crear la compra
      const { data: purchase, error: purchaseErr } = await supabase
        .from('purchases')
        .insert({
          purchase_number: purchaseNumber,
          supplier_id: supplierId,
          total,
          subtotal: total,
          status: 'received',
          notes: notes || null,
        })
        .select('id')
        .single()

      if (purchaseErr) throw purchaseErr

      // 2. Insertar líneas de la compra
      const purchaseLines = items.map(i => ({
        purchase_id: purchase.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        total_cost: i.quantity * i.unit_cost,
      }))

      await Promise.resolve(
        supabase.from('purchase_items').insert(purchaseLines)
      ).catch(() => {
        // Si la tabla no existe aún, seguimos de todos modos
      })

      // 3. Actualizar stock de cada producto
      for (const item of items) {
        await supabase
          .from('products')
          .update({ stock: item.product.stock + item.quantity })
          .eq('id', item.product.id)
      }

      onSaved()
    } catch (e) {
      console.error(e)
      setError('Error al guardar. Intenta de nuevo.')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800">Nueva Compra</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Proveedor */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Proveedor *</label>
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
            >
              <option value="">Seleccionar proveedor...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Buscar productos */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Agregar productos</label>
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
              {searching && (
                <div className="absolute right-3 top-3">
                  <div className="w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-800">{p.name}</p>
                        {p.code && <p className="text-xs text-stone-400 font-mono">{p.code}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-stone-500">Stock: {p.stock}</p>
                        <p className="text-xs text-stone-400">{formatCurrency(p.purchase_price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Líneas de productos */}
          {items.length > 0 && (
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="bg-stone-50 px-3 py-2 grid grid-cols-[2fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-stone-500 uppercase">
                <span>Producto</span>
                <span className="text-center">Cantidad</span>
                <span className="text-right">Costo unit.</span>
                <span />
              </div>
              <div className="divide-y divide-stone-100">
                {items.map(item => (
                  <div key={item.product.id} className="px-3 py-2.5 grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                    <div>
                      <p className="text-sm font-medium text-stone-800 truncate">{item.product.name}</p>
                      <p className="text-xs text-stone-400">
                        Subtotal: {formatCurrency(item.quantity * item.unit_cost)}
                        {item.product.unit?.abbreviation && ` · ${item.product.unit.abbreviation}`}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={e => updateItem(item.product.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="text-center px-2 py-1.5 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 w-full"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.unit_cost}
                      onChange={e => updateItem(item.product.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                      className="text-right px-2 py-1.5 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 w-full"
                    />
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="text-stone-300 hover:text-red-500 transition-colors px-1 text-lg leading-none"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {/* Total */}
              <div className="bg-amber-50 px-3 py-2.5 flex items-center justify-between border-t border-stone-200">
                <span className="text-sm font-semibold text-stone-700">Total compra</span>
                <span className="text-lg font-bold text-amber-800">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none"
              placeholder="Observaciones opcionales..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          {/* Info */}
          <p className="text-xs text-stone-400 bg-stone-50 px-3 py-2 rounded-xl">
            Al guardar, el stock de cada producto se actualizará automáticamente en el inventario.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-stone-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !supplierId || items.length === 0}
            className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors"
          >
            {saving ? 'Guardando...' : `Guardar compra · ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ComprasPage() {
  const supabase = createClient()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase
        .from('purchases')
        .select('*, supplier:suppliers(name)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ])
    setPurchases((p ?? []) as unknown as Purchase[])
    setSuppliers(s ?? [])
    setLoading(false)
  }

  async function handleDelete(purchase: Purchase) {
    if (!confirm(`¿Eliminar compra ${purchase.purchase_number}? Esta acción revertirá el stock si la compra estaba recibida.`)) return
    setDeletingId(purchase.id)

    // Si la compra estaba recibida, revertir el stock
    if (purchase.status === 'received') {
      const { data: lines } = await supabase
        .from('purchase_items')
        .select('product_id, quantity')
        .eq('purchase_id', purchase.id)

      if (lines && lines.length > 0) {
        for (const line of lines) {
          // Obtener stock actual
          const { data: prod } = await supabase
            .from('products')
            .select('stock')
            .eq('id', line.product_id)
            .single()
          if (prod) {
            await supabase
              .from('products')
              .update({ stock: Math.max(0, prod.stock - line.quantity) })
              .eq('id', line.product_id)
          }
        }
      }
    }

    // Eliminar la compra (cascade elimina purchase_items)
    await supabase.from('purchases').delete().eq('id', purchase.id)
    setDeletingId(null)
    load()
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    received: { label: 'Recibida', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-600' },
  }

  const totalMes = purchases
    .filter(p => {
      const d = new Date(p.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, p) => s + p.total, 0)

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Compras</h1>
          <p className="text-stone-500 text-sm mt-0.5">Registro de compras a proveedores</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20"
        >
          + Nueva Compra
        </button>
      </div>

      {/* Resumen del mes */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-5">
        <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Total comprado este mes</p>
        <p className="text-2xl font-bold text-amber-800 mt-1">{formatCurrency(totalMes)}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🧾</p>
          <p className="text-stone-500">No hay compras registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">N° Compra</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {purchases.map((p) => {
                const st = statusLabel[p.status] ?? { label: p.status, color: 'bg-stone-100 text-stone-600' }
                const isDeleting = deletingId === p.id
                return (
                  <tr key={p.id} className={`hover:bg-stone-50 transition-colors ${isDeleting ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-sm text-stone-700">{p.purchase_number}</td>
                    <td className="px-4 py-3 text-stone-800">{(p.supplier as { name?: string } | undefined)?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-500 text-sm">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-stone-800">{formatCurrency(p.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={isDeleting}
                        className="text-stone-300 hover:text-red-500 transition-colors disabled:opacity-50 text-sm px-2 py-1 rounded-lg hover:bg-red-50"
                        title="Eliminar compra"
                      >
                        {isDeleting ? '...' : '🗑'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <NuevaCompraModal
          suppliers={suppliers}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            load()
          }}
        />
      )}
    </div>
  )
}
