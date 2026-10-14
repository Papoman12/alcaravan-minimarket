'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const BRANCH_ID = '56916f1b-17dc-4c3d-8e65-a7d2a6554891'

interface ProductionRecord {
  id: string
  recipe_id?: string
  product_id?: string
  quantity_produced: number
  production_date: string
  status: string
  notes?: string
  created_at: string
}

interface Recipe {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
}

const STATUS_OPTIONS = [
  { value: 'planned', label: '📋 Planificado' },
  { value: 'in_progress', label: '⚙️ En proceso' },
  { value: 'completed', label: '✅ Completado' },
  { value: 'cancelled', label: '❌ Cancelado' },
]

export default function ProduccionPage() {
  const [records, setRecords] = useState<ProductionRecord[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ProductionRecord | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    recipe_id: '',
    product_id: '',
    quantity_produced: '',
    production_date: new Date().toISOString().split('T')[0],
    status: 'completed',
    notes: '',
  })

  useEffect(() => {
    load()
    loadRecipes()
    loadProducts()
  }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('production_records')
      .select('*')
      .order('production_date', { ascending: false })
      .limit(100)
    setRecords(data ?? [])
    setLoading(false)
  }

  async function loadRecipes() {
    const supabase = createClient()
    const { data } = await supabase.from('recipes').select('id, name').order('name')
    setRecipes(data ?? [])
  }

  async function loadProducts() {
    const supabase = createClient()
    const { data } = await supabase.from('products').select('id, name').eq('is_active', true).order('name')
    setProducts(data ?? [])
  }

  function openNew() {
    setEditing(null)
    setError('')
    setForm({ recipe_id: '', product_id: '', quantity_produced: '', production_date: new Date().toISOString().split('T')[0], status: 'completed', notes: '' })
    setShowModal(true)
  }

  function openEdit(r: ProductionRecord) {
    setEditing(r)
    setError('')
    setForm({
      recipe_id: r.recipe_id ?? '',
      product_id: r.product_id ?? '',
      quantity_produced: r.quantity_produced.toString(),
      production_date: r.production_date,
      status: r.status,
      notes: r.notes ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.quantity_produced || !form.production_date) {
      setError('Cantidad y fecha son obligatorios')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = {
      branch_id: BRANCH_ID,
      recipe_id: form.recipe_id || null,
      product_id: form.product_id || null,
      quantity_produced: parseFloat(form.quantity_produced),
      production_date: form.production_date,
      status: form.status,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      const { error: err } = await supabase.from('production_records').update(payload).eq('id', editing.id)
      if (err) { setError('Error al actualizar: ' + err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('production_records').insert(payload)
      if (err) { setError('Error al guardar: ' + err.message); setSaving(false); return }
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  const recipeName = (id?: string) => recipes.find(r => r.id === id)?.name ?? '—'
  const productName = (id?: string) => products.find(p => p.id === id)?.name ?? '—'
  const statusInfo = (s: string) => STATUS_OPTIONS.find(x => x.value === s) ?? { label: s }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Producción</h1>
          <p className="text-stone-500 text-sm mt-0.5">{records.length} registros</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors">
          + Nuevo Registro
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">🏭</p><p className="text-stone-500">No hay registros de producción</p></div>
      ) : (
        <div className="grid gap-3">
          {records.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🏭</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-stone-800">
                    {r.recipe_id ? recipeName(r.recipe_id) : r.product_id ? productName(r.product_id) : 'Sin receta/producto'}
                  </p>
                  <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{statusInfo(r.status).label}</span>
                </div>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  <span className="text-sm font-medium text-emerald-700">Cantidad: {r.quantity_produced}</span>
                  <span className="text-sm text-stone-500">{new Date(r.production_date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                {r.notes && <p className="text-xs text-stone-400 mt-0.5">{r.notes}</p>}
              </div>
              <button onClick={() => openEdit(r)} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 flex-shrink-0">Editar</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">{editing ? 'Editar Registro' : 'Nuevo Registro de Producción'}</h3>
            {error && <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm mb-4">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Receta</label>
                <select value={form.recipe_id} onChange={e => setForm({ ...form, recipe_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                  <option value="">Seleccionar receta...</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Producto</label>
                <select value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Cantidad producida *</label>
                  <input type="number" value={form.quantity_produced} onChange={e => setForm({ ...form, quantity_produced: e.target.value })} placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Fecha *</label>
                  <input type="date" value={form.production_date} onChange={e => setForm({ ...form, production_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Estado</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Observaciones..."
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300">
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
