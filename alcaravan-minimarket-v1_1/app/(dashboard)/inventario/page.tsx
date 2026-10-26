'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

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

  useEffect(() => {
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
        <button
          onClick={() => downloadCSV(filtered)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
        >
          📥 Descargar Excel ({filtered.length})
        </button>
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
    </div>
  )
}
