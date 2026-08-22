'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateMargin, formatCurrency } from '@/lib/utils'
import type { Product, Category } from '@/types/database'

interface ProductFormProps {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

export default function ProductForm({ product, categories, onClose, onSaved }: ProductFormProps) {
  const supabase = createClient()
  const isEdit = !!product

  const [form, setForm] = useState({
    name: product?.name ?? '',
    code: product?.code ?? '',
    barcode: product?.barcode ?? '',
    category_id: product?.category_id ?? '',
    purchase_price: product?.purchase_price ?? 0,
    sale_price: product?.sale_price ?? 0,
    iva_rate: product?.iva_rate ?? 0,
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 0,
    max_stock: product?.max_stock ?? 0,
    description: product?.description ?? '',
    is_featured: product?.is_featured ?? false,
    is_active: product?.is_active ?? true,
    has_expiry: product?.has_expiry ?? false,
    allows_fractions: product?.allows_fractions ?? false,
    product_type: product?.product_type ?? 'physical',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const margin = calculateMargin(form.sale_price, form.purchase_price)

  function handleChange(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) { setError('El nombre del producto es requerido.'); return }
    if (form.sale_price <= 0) { setError('El precio de venta debe ser mayor a 0.'); return }

    setLoading(true)
    try {
      if (isEdit && product) {
        const { error: err } = await supabase
          .from('products')
          .update(form)
          .eq('id', product.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase
          .from('products')
          .insert({ ...form, stock: Number(form.stock) })
        if (err) throw err
      }
      onSaved()
    } catch (err: unknown) {
      setError('Error al guardar el producto. Verifica los datos.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-stone-200 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-stone-800">
            {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Información básica */}
          <div>
            <h3 className="font-semibold text-stone-700 text-sm mb-3 uppercase tracking-wide">Información Básica</h3>
            <div className="grid gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                  placeholder="Nombre del producto"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Código interno</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => handleChange('code', e.target.value)}
                    placeholder="P001"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Código de barras</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => handleChange('barcode', e.target.value)}
                    placeholder="7700000000000"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Categoría</label>
                <select
                  value={form.category_id}
                  onChange={(e) => handleChange('category_id', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm bg-white"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Precios */}
          <div>
            <h3 className="font-semibold text-stone-700 text-sm mb-3 uppercase tracking-wide">Precios</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Precio de costo *</label>
                <input
                  type="number"
                  value={form.purchase_price}
                  onChange={(e) => handleChange('purchase_price', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="1"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Precio de venta *</label>
                <input
                  type="number"
                  value={form.sale_price}
                  onChange={(e) => handleChange('sale_price', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="1"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
                />
              </div>
            </div>

            {/* Indicador de margen */}
            <div className={`mt-2 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between ${
              margin >= 30 ? 'bg-emerald-50 text-emerald-700'
              : margin >= 15 ? 'bg-yellow-50 text-yellow-700'
              : 'bg-red-50 text-red-700'
            }`}>
              <span>Margen de utilidad</span>
              <span className="font-bold">{margin.toFixed(1)}%</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">IVA (%)</label>
                <select
                  value={form.iva_rate}
                  onChange={(e) => handleChange('iva_rate', parseFloat(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm bg-white"
                >
                  <option value={0}>0% (Exento)</option>
                  <option value={5}>5%</option>
                  <option value={19}>19%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Tipo de producto</label>
                <select
                  value={form.product_type}
                  onChange={(e) => handleChange('product_type', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm bg-white"
                >
                  <option value="physical">Físico / Empaque</option>
                  <option value="prepared">Preparado (receta)</option>
                  <option value="service">Servicio</option>
                </select>
              </div>
            </div>
          </div>

          {/* Inventario */}
          <div>
            <h3 className="font-semibold text-stone-700 text-sm mb-3 uppercase tracking-wide">Inventario</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Stock actual</label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => handleChange('stock', parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.001"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Stock mínimo</label>
                <input
                  type="number"
                  value={form.min_stock}
                  onChange={(e) => handleChange('min_stock', parseFloat(e.target.value) || 0)}
                  min="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Stock máximo</label>
                <input
                  type="number"
                  value={form.max_stock}
                  onChange={(e) => handleChange('max_stock', parseFloat(e.target.value) || 0)}
                  min="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Opciones */}
          <div>
            <h3 className="font-semibold text-stone-700 text-sm mb-3 uppercase tracking-wide">Opciones</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'is_active', label: '✅ Producto activo' },
                { key: 'is_featured', label: '⭐ Producto destacado (POS)' },
                { key: 'has_expiry', label: '📅 Tiene fecha de vencimiento' },
                { key: 'allows_fractions', label: '⚖️ Permite fracciones' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 p-3 rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={(e) => handleChange(key, e.target.checked)}
                    className="rounded accent-amber-700"
                  />
                  <span className="text-sm text-stone-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Descripción (opcional)</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={2}
              placeholder="Descripción del producto..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm resize-none"
            />
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white font-bold transition-colors shadow-sm shadow-amber-700/30"
            >
              {loading ? 'Guardando...' : isEdit ? 'Actualizar Producto' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
