'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

// ─── Modal: Consumo Interno ───────────────────────────────────────────────────
// Para registrar productos usados por la tienda (leche para café, escoba, etc.)
// Se descuentan del inventario al precio de COSTO, no al precio de venta.

interface ConsumoItem {
  product: Product
  quantity: number
  reason: string
}

function ConsumoInternoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [items, setItems] = useState<ConsumoItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, code, barcode, purchase_price, sale_price, stock, min_stock, is_active, category:categories(name), unit:units_of_measure(abbreviation)')
        .eq('is_active', true)
        .or(`name.ilike.%${search}%,code.ilike.%${search}%`)
        .order('name').limit(8)
      setResults((data ?? []) as unknown as Product[])
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  function addProduct(p: Product) {
    if (items.find(i => i.product.id === p.id)) return
    setItems(prev => [...prev, { product: p, quantity: 1, reason: '' }])
    setSearch(''); setResults([])
  }

  function updateItem(id: string, field: 'quantity' | 'reason', value: string | number) {
    setItems(prev => prev.map(i => i.product.id === id ? { ...i, [field]: value } : i))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.product.id !== id))
  }

  const totalCosto = items.reduce((s, i) => s + i.product.purchase_price * i.quantity, 0)

  async function handleSave() {
    if (items.length === 0) return
    for (const item of items) {
      if (item.quantity <= 0) { setError('Verifica las cantidades — deben ser mayores a 0.'); return }
      if (item.quantity > item.product.stock) {
        setError(`"${item.product.name}" solo tiene ${item.product.stock} en stock.`); return
      }
    }

    setSaving(true); setError('')
    try {
      for (const item of items) {
        // Descontar del stock
        await supabase
          .from('products')
          .update({ stock: item.product.stock - item.quantity })
          .eq('id', item.product.id)

        // Registrar movimiento (si la tabla existe)
        await supabase.from('inventory_adjustments').insert({
          product_id: item.product.id,
          product_name: item.product.name,
          type: 'consumo_interno',
          quantity: -item.quantity,
          cost_price: item.product.purchase_price,
          total_cost: item.product.purchase_price * item.quantity,
          reason: item.reason || 'Consumo interno',
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        }).then(() => {}).catch(() => {}) // silencioso si la tabla no existe
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="px-6 py-5 border-b border-stone-100">
          <h2 className="text-xl font-bold text-stone-800">🏪 Consumo Interno</h2>
          <p className="text-stone-500 text-sm mt-1">
            Productos usados por la tienda — se descuentan al precio de costo
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Buscador */}
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar producto (leche, escoba, papel...)"
              className="w-full px-4 py-3 rounded-xl border-2 border-amber-700 focus:outline-none text-sm"
            />
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-stone-200 shadow-xl z-20 max-h-48 overflow-y-auto">
                {results.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 text-left border-b border-stone-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-800">{p.name}</p>
                      <p className="text-xs text-stone-400">Stock: {p.stock} · Costo: {formatCurrency(p.purchase_price)}</p>
                    </div>
                    <span className="text-amber-700 text-lg ml-2">+</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items agregados */}
          {items.length === 0 && (
            <p className="text-center text-stone-400 text-sm py-4">
              Busca y agrega los productos que vas a usar
            </p>
          )}

          {items.map(item => (
            <div key={item.product.id} className="bg-stone-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-stone-800 text-sm">{item.product.name}</p>
                  <p className="text-xs text-stone-500">
                    Costo: {formatCurrency(item.product.purchase_price)} · Stock actual: {item.product.stock}
                  </p>
                </div>
                <button onClick={() => removeItem(item.product.id)} className="text-red-400 hover:text-red-600 ml-2 text-lg">✕</button>
              </div>
              <div className="flex gap-2">
                <div className="w-28">
                  <label className="text-xs text-stone-500 mb-0.5 block">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    max={item.product.stock}
                    value={item.quantity}
                    onChange={e => updateItem(item.product.id, 'quantity', parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-stone-500 mb-0.5 block">¿Para qué se usa?</label>
                  <input
                    type="text"
                    value={item.reason}
                    onChange={e => updateItem(item.product.id, 'reason', e.target.value)}
                    placeholder="Ej: cappuccino, limpieza, cocina..."
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
              </div>
              <p className="text-xs text-right text-stone-500">
                Costo total: <span className="font-bold text-stone-700">{formatCurrency(item.product.purchase_price * item.quantity)}</span>
              </p>
            </div>
          ))}

          {items.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-amber-800 font-medium">Costo total del consumo</span>
              <span className="text-lg font-bold text-amber-800">{formatCurrency(totalCosto)}</span>
            </div>
          )}

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="flex-1 py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 disabled:bg-stone-300 transition-colors"
          >
            {saving ? 'Guardando...' : '✓ Registrar consumo'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Product {
  id: string
  name: string
  code?: string
  barcode?: string
  purchase_price: number
  sale_price: number
  stock: number
  min_stock?: number
  is_active: boolean
  category?: { name: string }
  unit?: { abbreviation: string }
}

function getStockStatus(p: Product) {
  if (p.stock <= 0) return { label: 'Agotado', color: 'bg-red-100 text-red-700' }
  if (p.min_stock && p.stock <= p.min_stock) return { label: 'Stock bajo', color: 'bg-orange-100 text-orange-700' }
  return { label: 'En stock', color: 'bg-emerald-100 text-emerald-700' }
}

function downloadCSV(products: Product[]) {
  const BOM = '﻿' // Para que Excel abra correctamente con tildes
  const headers = ['Nombre', 'Código', 'Código de Barras', 'Categoría', 'Unidad', 'Stock', 'Stock Mínimo', 'Precio Costo', 'Precio Venta', 'Margen %', 'Estado']
  const rows = products.map(p => {
    const margen = p.purchase_price > 0 ? (((p.sale_price - p.purchase_price) / p.purchase_price) * 100).toFixed(1) : '0'
    return [
      p.name,
      p.code ?? '',
      p.barcode ?? '',
      p.category?.name ?? '',
      p.unit?.abbreviation ?? '',
      p.stock,
      p.min_stock ?? '',
      p.purchase_price,
      p.sale_price,
      margen,
      p.is_active ? 'Activo' : 'Inactivo',
    ]
  })

  const csvContent = BOM + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<string[]>([])
  const [showConsumo, setShowConsumo] = useState(false)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('id, name, code, barcode, purchase_price, sale_price, stock, min_stock, is_active, category:categories(name), unit:units_of_measure(abbreviation)')
      .order('name')
      .limit(500)
    const rows = (data ?? []) as unknown as Product[]
    setProducts(rows)
    const cats = [...new Set(rows.map(p => p.category?.name).filter(Boolean))] as string[]
    setCategories(cats.sort())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = products.filter(p => {
    if (filter === 'low' && !(p.min_stock && p.stock <= p.min_stock && p.stock > 0)) return false
    if (filter === 'out' && p.stock > 0) return false
    if (categoryFilter !== 'all' && p.category?.name !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q) || (p.barcode ?? '').includes(q)
    }
    return true
  })

  const totalProductos = products.length
  const agotados = products.filter(p => p.stock <= 0).length
  const stockBajo = products.filter(p => p.min_stock && p.stock <= p.min_stock && p.stock > 0).length
  const valorInventario = products.reduce((s, p) => s + p.purchase_price * p.stock, 0)
  const valorVenta = products.reduce((s, p) => s + p.sale_price * p.stock, 0)

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Inventario</h1>
          <p className="text-stone-500 text-sm mt-0.5">{totalProductos} productos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowConsumo(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-sm"
          >
            🏪 Consumo Interno
          </button>
          <button
            onClick={() => downloadCSV(filtered)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            📥 Descargar Excel ({filtered.length})
          </button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Valor en costo</p>
          <p className="text-xl font-bold text-stone-800 mt-1">{formatCurrency(valorInventario)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Valor en venta</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{formatCurrency(valorVenta)}</p>
        </div>
        <div
          onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}
          className={`rounded-2xl border p-4 cursor-pointer transition-all ${filter === 'out' ? 'bg-red-50 border-red-300' : 'bg-white border-stone-200 hover:border-red-200'}`}
        >
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Agotados</p>
          <p className="text-xl font-bold text-red-600 mt-1">{agotados}</p>
        </div>
        <div
          onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
          className={`rounded-2xl border p-4 cursor-pointer transition-all ${filter === 'low' ? 'bg-orange-50 border-orange-300' : 'bg-white border-stone-200 hover:border-orange-200'}`}
        >
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Stock bajo</p>
          <p className="text-xl font-bold text-orange-600 mt-1">{stockBajo}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código..."
          className="flex-1 min-w-48 px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
        >
          <option value="all">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'low', label: '⚠️ Stock bajo' },
            { key: 'out', label: '❌ Agotados' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as typeof filter)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${filter === f.key ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">📦</p>
          <p className="text-stone-500">No hay productos con estos filtros</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          {/* Encabezado tabla */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-0 px-4 py-3 bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wide">
            <span>Producto</span>
            <span>Categoría</span>
            <span className="text-center">Stock</span>
            <span className="text-center">Mín.</span>
            <span className="text-right">Costo</span>
            <span className="text-right">Precio venta</span>
            <span className="text-center">Estado</span>
          </div>

          {/* Filas */}
          <div className="divide-y divide-stone-100">
            {filtered.map(p => {
              const status = getStockStatus(p)
              const margen = p.purchase_price > 0
                ? (((p.sale_price - p.purchase_price) / p.purchase_price) * 100).toFixed(0)
                : null
              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-0 px-4 py-3 items-center hover:bg-stone-50 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-stone-800 text-sm truncate">{p.name}</p>
                    {(p.code || p.barcode) && (
                      <p className="text-xs text-stone-400 font-mono">{p.code || p.barcode}</p>
                    )}
                  </div>
                  <span className="text-xs text-stone-500 truncate">{p.category?.name ?? '—'}</span>
                  <div className="text-center">
                    <span className={`font-bold text-sm ${p.stock <= 0 ? 'text-red-600' : p.min_stock && p.stock <= p.min_stock ? 'text-orange-600' : 'text-stone-800'}`}>
                      {p.stock}
                    </span>
                    <span className="text-xs text-stone-400 ml-1">{p.unit?.abbreviation ?? ''}</span>
                  </div>
                  <span className="text-center text-xs text-stone-400">{p.min_stock ?? '—'}</span>
                  <span className="text-right text-sm text-stone-600">{formatCurrency(p.purchase_price)}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-stone-800">{formatCurrency(p.sale_price)}</p>
                    {margen && <p className="text-[10px] text-emerald-600">+{margen}%</p>}
                  </div>
                  <div className="text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal consumo interno */}
      {showConsumo && (
        <ConsumoInternoModal
          onClose={() => setShowConsumo(false)}
          onSaved={() => { setShowConsumo(false); load() }}
        />
      )}
    </div>
  )
}
