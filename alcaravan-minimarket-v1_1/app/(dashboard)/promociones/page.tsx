'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

interface Promotion {
  id: string
  name: string
  description?: string
  discount_type: string
  discount_value: number
  start_date: string
  end_date?: string
  is_active: boolean
  min_purchase?: number
}

export default function PromocionesPage() {
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', discount_type: 'percentage', discount_value: '', start_date: new Date().toISOString().split('T')[0], end_date: '', min_purchase: '' })
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
    setPromos(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name || !form.discount_value) return
    setSaving(true)
    await supabase.from('promotions').insert({
      name: form.name,
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      start_date: form.start_date,
      end_date: form.end_date || null,
      min_purchase: parseFloat(form.min_purchase) || 0,
      is_active: true,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ name: '', description: '', discount_type: 'percentage', discount_value: '', start_date: new Date().toISOString().split('T')[0], end_date: '', min_purchase: '' })
    load()
  }

  async function toggleActive(p: Promotion) {
    await supabase.from('promotions').update({ is_active: !p.is_active }).eq('id', p.id)
    load()
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Promociones</h1>
          <p className="text-stone-500 text-sm mt-0.5">{promos.filter(p => p.is_active).length} activas</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20">
          + Nueva Promoción
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : promos.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">🎁</p><p className="text-stone-500">No hay promociones</p></div>
      ) : (
        <div className="grid gap-3">
          {promos.map((p) => (
            <div key={p.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${p.is_active ? 'border-amber-200' : 'border-stone-100 opacity-60'}`}>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🎁</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-stone-800">{p.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {p.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                {p.description && <p className="text-sm text-stone-500 mt-0.5">{p.description}</p>}
                <div className="flex gap-3 mt-1">
                  <span className="text-sm font-bold text-amber-700">
                    {p.discount_type === 'percentage' ? `${p.discount_value}% off` : `$${p.discount_value} off`}
                  </span>
                  <span className="text-xs text-stone-400">Desde: {formatDate(p.start_date)}</span>
                  {p.end_date && <span className="text-xs text-stone-400">Hasta: {formatDate(p.end_date)}</span>}
                </div>
              </div>
              <button onClick={() => toggleActive(p)} className={`px-3 py-1.5 text-sm rounded-lg flex-shrink-0 transition-colors ${p.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                {p.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Nueva Promoción</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: 2x1 en cafés" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Descripción</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción de la promoción" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Tipo</label>
                  <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed">Valor fijo ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Descuento *</label>
                  <input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder="0" className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Fecha inicio</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Fecha fin</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.discount_value} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
