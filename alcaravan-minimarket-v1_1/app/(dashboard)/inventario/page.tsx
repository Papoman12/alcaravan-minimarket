'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import type { Product, InventoryMovement } from '@/types/database'

export default function InventoryPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'alerts'>('stock')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdjust, setShowAdjust] = useState<Product | null>(null)
  const [adjustQty, setAdjustQty] = useState(0)
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustType, setAdjustType] = useState<'adjustment_in' | 'adjustment_out'>('adjustment_in')

  async function loadData() {
    setLoading(true)
    const [{ data: prods }, { data: movs }] = await Promise.all([
      supabase
        .from('products')
        .select('*, category:categories(name, icon), unit:units_of_measure(abbreviation)')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('inventory_movements')
        .select('*, product:products(name, code)')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setProducts(prods ?? [])
    setMovements(movs ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleAdjust() {
    if (!showAdjust || adjustQty <= 0 || !adjustReason.trim()) return

    const product = showAdjust
    const newStock = adjustType === 'adjustment_in'
      ? product.stock + adjustQty
      : Math.max(0, product.stock - adjustQty)

    await supabase.from('products').update({ stock: newStock }).eq('id', product.id)
    await supabase.from('inventory_movements').insert({
      product_id: product.id,
      movement_type: adjustType,
      quantity: adjustQty,
      stock_before: product.stock,
      stock_after: newStock,
      reason: adjustReason,
    })

    setShowAdjust(null)
    setAdjustQty(0)
    setAdjustReason('')
    loadData()
  }

  const filtered = products.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const lowStock = products.filter((p) => p.stock <= p.min_stock && p.stock > 0)
  const outOfStock = products.filter((p) => p.stock <= 0)

  const MOVEMENT_LABELS: Record<string, string> = {
    sale: '🛒 Venta',
    purchase: '📦 Compra',
    adjustment_in: '➕ Ajuste entrada',
    adjustment_out: '➖ Ajuste salida',
    return_sale: '↩️ Devolución venta',
    waste: '🗑️ Pérdida',
    initial_stock: '🏁 Stock inicial',
    production_out: '👨‍🍳 Producción',
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Inventario</h1>
        <p className="text-stone-500 text-sm">{products.length} productos activos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total productos', value: products.length, icon: '📦', color: 'bg-blue-50 border-blue-200' },
          { label: 'En stock', value: products.filter((p) => p.stock > p.min_stock).length, icon: '✅', color: 'bg-emerald-50 border-emerald-200' },
          { label: 'Stock bajo', value: lowStock.length, icon: '🟡', color: 'bg-yellow-50 border-yellow-200' },
          { label: 'Agotados', value: outOfStock.length, icon: '🔴', color: 'bg-red-50 border-red-200' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <span className="text-lg">{s.icon}</span>
            <p className="text-2xl font-bold text-stone-800 mt-1">{s.value}</p>
            <p className="text-xs text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-4 w-fit">
        {[
          { key: 'stock', label: '📦 Stock Actual' },
          { key: 'movements', label: '📋 Movimientos' },
          { key: 'alerts', label: `⚠️ Alertas (${lowStock.length + outOfStock.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-stone-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Buscar producto..."
              className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Producto</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Categoría</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Stock</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Mínimo</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Máximo</th>
                  <th className="text-center px-4 py-3 font-semibold text-stone-600">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Ajustar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((product) => {
                  const status =
                    product.stock <= 0 ? { label: '🔴 Agotado', color: 'text-red-600 bg-red-50' }
                    : product.stock <= product.min_stock ? { label: '🟡 Stock bajo', color: 'text-yellow-700 bg-yellow-50' }
                    : { label: '🟢 Normal', color: 'text-emerald-700 bg-emerald-50' }

                  return (
                    <tr key={product.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-stone-800">{product.name}</p>
                        <p className="text-xs text-stone-400">{product.code ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600 text-xs">
                        {(product as any).category?.icon} {(product as any).category?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-stone-800 tabular-nums">
                          {product.stock} {(product as any).unit?.abbreviation ?? 'und'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-stone-500">{product.min_stock}</td>
                      <td className="px-4 py-3 text-right text-stone-500">{product.max_stock || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setShowAdjust(product)}
                          className="px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Producto</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Tipo</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Cantidad</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Antes</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Después</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-stone-400">
                      No hay movimientos registrados
                    </td>
                  </tr>
                ) : movements.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-50/50">
                    <td className="px-4 py-3 text-xs text-stone-500 whitespace-nowrap">
                      {formatDateTime(m.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800">
                      {(m as any).product?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">
                        {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${
                      ['sale', 'adjustment_out', 'waste', 'production_out'].includes(m.movement_type)
                        ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {['sale', 'adjustment_out', 'waste', 'production_out'].includes(m.movement_type) ? '-' : '+'}
                      {m.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-500 tabular-nums">{m.stock_before}</td>
                    <td className="px-4 py-3 text-right font-medium text-stone-800 tabular-nums">{m.stock_after}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">{m.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {outOfStock.length === 0 && lowStock.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-semibold text-emerald-800">¡Todo el inventario está en orden!</p>
              <p className="text-sm text-emerald-600">No hay alertas de stock en este momento.</p>
            </div>
          ) : (
            <>
              {outOfStock.length > 0 && (
                <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-red-50 border-b border-red-200">
                    <h3 className="font-semibold text-red-800">🔴 Productos Agotados ({outOfStock.length})</h3>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {outOfStock.map((p) => (
                      <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                        <p className="font-medium text-stone-800">{p.name}</p>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg font-medium">AGOTADO</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {lowStock.length > 0 && (
                <div className="bg-white rounded-2xl border border-yellow-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-yellow-50 border-b border-yellow-200">
                    <h3 className="font-semibold text-yellow-800">🟡 Stock Bajo ({lowStock.length})</h3>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {lowStock.map((p) => (
                      <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-stone-800">{p.name}</p>
                          <p className="text-xs text-stone-400">Stock: {p.stock} — Mínimo: {p.min_stock}</p>
                        </div>
                        <button
                          onClick={() => setShowAdjust(p)}
                          className="text-xs px-3 py-1.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors"
                        >
                          Ajustar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal de ajuste */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-stone-800 mb-1">Ajustar Inventario</h3>
            <p className="text-sm text-stone-500 mb-4">{showAdjust.name}</p>
            <p className="text-sm text-stone-600 mb-4">
              Stock actual: <strong>{showAdjust.stock}</strong>
            </p>

            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setAdjustType('adjustment_in')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    adjustType === 'adjustment_in' ? 'bg-emerald-700 text-white' : 'border border-stone-200 text-stone-600'
                  }`}
                >
                  ➕ Entrada
                </button>
                <button
                  onClick={() => setAdjustType('adjustment_out')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    adjustType === 'adjustment_out' ? 'bg-red-600 text-white' : 'border border-stone-200 text-stone-600'
                  }`}
                >
                  ➖ Salida
                </button>
              </div>
              <input
                type="number"
                value={adjustQty || ''}
                onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                min="0.001"
                step="0.001"
                placeholder="Cantidad"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
              />
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Motivo del ajuste *"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
              />
              {adjustQty > 0 && (
                <div className="bg-stone-50 rounded-xl p-3 text-sm text-center">
                  <span className="text-stone-600">Nuevo stock: </span>
                  <strong className="text-stone-800">
                    {adjustType === 'adjustment_in'
                      ? showAdjust.stock + adjustQty
                      : Math.max(0, showAdjust.stock - adjustQty)}
                  </strong>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowAdjust(null)}
                className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdjust}
                disabled={adjustQty <= 0 || !adjustReason.trim()}
                className="flex-1 py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 disabled:bg-stone-300 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
