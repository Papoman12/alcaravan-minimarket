'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, calculateMargin } from '@/lib/utils'
import type { Product, Category } from '@/types/database'
import ProductForm from './product-form'

export default function ProductsPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'low_stock'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)

  async function loadData() {
    setLoading(true)
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase
        .from('products')
        .select('*, category:categories(id, name, icon), brand:brands(name), unit:units_of_measure(abbreviation)')
        .order('name'),
      supabase.from('categories').select('*').eq('is_active', true).order('name'),
    ])
    setProducts(prods ?? [])
    setCategories(cats ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleToggleActive(product: Product) {
    await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id)
    loadData()
  }

  const filtered = products.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode ?? '').includes(search)

    const matchCat = !categoryFilter || p.category_id === categoryFilter

    const matchStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? p.is_active :
      statusFilter === 'inactive' ? !p.is_active :
      statusFilter === 'low_stock' ? (p.stock <= p.min_stock && p.is_active) : true

    return matchSearch && matchCat && matchStatus
  })

  const stats = {
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    lowStock: products.filter((p) => p.stock <= p.min_stock && p.stock > 0 && p.is_active).length,
    outOfStock: products.filter((p) => p.stock <= 0 && p.is_active).length,
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Productos</h1>
          <p className="text-stone-500 text-sm">{stats.total} productos registrados</p>
        </div>
        <button
          onClick={() => { setEditProduct(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-xl transition-colors shadow-sm shadow-amber-700/30"
        >
          + Nuevo Producto
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Productos', value: stats.total, icon: '📦', color: 'bg-blue-50 border-blue-200' },
          { label: 'Activos', value: stats.active, icon: '✅', color: 'bg-emerald-50 border-emerald-200' },
          { label: 'Stock Bajo', value: stats.lowStock, icon: '🟡', color: 'bg-yellow-50 border-yellow-200' },
          { label: 'Agotados', value: stats.outOfStock, icon: '🔴', color: 'bg-red-50 border-red-200' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.color}`}>
            <span className="text-lg">{stat.icon}</span>
            <p className="text-2xl font-bold text-stone-800 mt-1">{stat.value}</p>
            <p className="text-xs text-stone-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Buscar por nombre, código..."
            className="flex-1 min-w-48 px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 bg-white"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 bg-white"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="low_stock">Stock bajo</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="w-8 h-8 border-3 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-stone-500 font-medium">No hay productos</p>
            <button
              onClick={() => { setEditProduct(null); setShowForm(true) }}
              className="mt-3 text-amber-700 hover:underline text-sm"
            >
              + Crear primer producto
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Producto</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Categoría</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Precio</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Costo</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Margen</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Stock</th>
                  <th className="text-center px-4 py-3 font-semibold text-stone-600">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((product) => {
                  const margin = calculateMargin(product.sale_price, product.purchase_price)
                  const stockBadge =
                    product.stock <= 0
                      ? 'bg-red-100 text-red-700'
                      : product.stock <= product.min_stock
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-emerald-100 text-emerald-700'

                  return (
                    <tr key={product.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : '📦'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-800 truncate">{product.name}</p>
                            <p className="text-xs text-stone-400">{product.code ?? product.barcode ?? 'Sin código'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {(product as any).category?.icon} {(product as any).category?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-stone-800">
                        {formatCurrency(product.sale_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-500">
                        {formatCurrency(product.purchase_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-600' : 'text-red-500'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${stockBadge}`}>
                          {product.stock} {(product as any).unit?.abbreviation ?? 'und'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(product)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            product.is_active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                          }`}
                        >
                          {product.is_active ? '✅ Activo' : '⏸ Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setEditProduct(product); setShowForm(true) }}
                          className="px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <ProductForm
          product={editProduct}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData() }}
        />
      )}
    </div>
  )
}
