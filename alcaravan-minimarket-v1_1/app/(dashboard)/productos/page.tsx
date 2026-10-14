'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Product {
  id: string
  name: string
  code?: string
  barcode?: string
  category_id?: string
  purchase_price?: number
  sale_price: number
  stock?: number
  min_stock?: number
  is_active: boolean
}

interface Category {
  id: string
  name: string
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    code: '',
    barcode: '',
    category_id: '',
    purchase_price: '',
    sale_price: '',
    stock: '',
    min_stock: '',
  })

  useEffect(() => {
    load()
    loadCategories()
  }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('name')
    setProducts(data ?? [])
    setLoading(false)
  }

  async function loadCategories() {
    const supabase = createClient()
    const { data } = await supabase.from('categories').select('id, name').order('name')
    setCategories(data ?? [])
  }

  function openNew() {
    setEditing(null)
    setError('')
    setForm({ name: '', code: '', barcode: '', category_id: '', purchase_price: '', sale_price: '', stock: '', min_stock: '' })
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setError('')
    setForm({
      name: p.name,
      code: p.code ?? '',
      barcode: p.barcode ?? '',
      category_id: p.category_id ?? '',
      purchase_price: p.purchase_price?.toString() ?? '',
      sale_price: p.sale_price.toString(),
      stock: p.stock?.toString() ?? '',
      min_stock: p.min_stock?.toString() ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name || !form.sale_price) {
      setError('El nombre y el precio de venta son obligatorios')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      barcode: form.barcode.trim() || null,
      category_id: form.category_id || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      sale_price: parseFloat(form.sale_price),
      stock: form.stock ? parseFloat(form.stock) : 0,
      min_stock: form.min_stock ? parseFloat(form.min_stock) : null,
      is_active: true,
    }

    if (editing) {
      const { error: err } = await supabase.from('products').update(payload).eq('id', editing.id)
      if (err) { setError('Error al actualizar: ' + err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('products').insert(payload)
      if (err) { setError('Error al guardar: ' + err.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    load()
  }

  async function toggleActive(p: Product) {
    const supabase = createClient()
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    load()
  }

  const margin = (cost: number, sale: number) =>
    cost > 0 ? (((sale - cost) / cost) * 100).toFixed(1) : null

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  )

  const catName = (id?: string) => categories.find(c => c.id === id)?.name ?? ''

  const fmt = (n?: number) =>
    n != null ? '$' + n.toLocaleString('es-CO') : '—'

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Productos</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {products.filter(p => p.is_active).length} activos · {products.length} total
          </p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20"
        >
          + Nuevo Producto
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código o barras..."
          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 bg-white"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">📦</p>
          <p className="text-stone-500">
            {search ? 'No se encontraron productos' : 'No hay productos registrados'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(p => {
            const m = p.purchase_price ? margin(p.purchase_price, p.sale_price) : null
            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${p.is_active ? 'border-stone-200' : 'border-stone-100 opacity-60'}`}
              >
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-stone-800">{p.name}</p>
                    {!p.is_active && (
                      <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                    {p.category_id && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {catName(p.category_id)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 flex-wrap">
                    <span className="text-sm font-bold text-amber-700">{fmt(p.sale_price)}</span>
                    {p.purchase_price && (
                      <span className="text-sm text-stone-500">Costo: {fmt(p.purchase_price)}</span>
                    )}
                    {m && (
                      <span className="text-sm text-emerald-600 font-medium">{m}% margen</span>
                    )}
                    {p.stock != null && (
                      <span className={`text-sm font-medium ${(p.stock ?? 0) <= (p.min_stock ?? 0) ? 'text-red-600' : 'text-stone-500'}`}>
                        Stock: {p.stock}
                        {(p.stock ?? 0) <= (p.min_stock ?? 0) && ' ⚠️'}
                      </span>
                    )}
                  </div>
                  {(p.code || p.barcode) && (
                    <p className="text-xs text-stone-400 mt-0.5">
                      {p.code && `Cód: ${p.code}`}{p.code && p.barcode && ' · '}{p.barcode && `Barras: ${p.barcode}`}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActive(p)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${p.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                  >
                    {p.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-800 mb-4">
              {editing ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Información básica</p>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Agua Cristal 600ml"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Código interno</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    placeholder="P001"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Código de barras</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={e => setForm({ ...form, barcode: e.target.value })}
                    placeholder="Escanea el código"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Categoría</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider pt-2">Precios</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Precio de costo</label>
                  <input
                    type="number"
                    value={form.purchase_price}
                    onChange={e => setForm({ ...form, purchase_price: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Precio de venta *</label>
                  <input
                    type="number"
                    value={form.sale_price}
                    onChange={e => setForm({ ...form, sale_price: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
              </div>

              {form.purchase_price && form.sale_price && (
                <div className="bg-emerald-50 rounded-xl px-3 py-2 text-sm text-emerald-700">
                  Margen de utilidad: <strong>
                    {(((parseFloat(form.sale_price) - parseFloat(form.purchase_price)) / parseFloat(form.purchase_price)) * 100).toFixed(1)}%
                  </strong>
                </div>
              )}

              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider pt-2">Inventario</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Stock inicial</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Stock mínimo</label>
                  <input
                    type="number"
                    value={form.min_stock}
                    onChange={e => setForm({ ...form, min_stock: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.sale_price}
                className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors"
              >
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
