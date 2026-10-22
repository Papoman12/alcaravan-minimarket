'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsAdmin } from '@/lib/useIsAdmin'

const BRANCH_ID = '56916f1b-17dc-4c3d-8e65-a7d2a6554891'

interface Promotion {
  id: string
  name: string
  description?: string
  type: string
  discount_value: number
  starts_at?: string
  ends_at?: string
  is_active: boolean
  uses_count?: number
}

const PROMO_TYPES = [
  { value: 'percentage', label: 'Descuento porcentual (%)' },
  { value: 'fixed', label: 'Descuento fijo ($)' },
  { value: '2x1', label: '2x1' },
  { value: 'bundle', label: 'Combo / paquete' },
]

export default function PromocionesPage() {
  const isAdmin = useIsAdmin()
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', description: '', type: 'percentage', discount_value: '', starts_at: '', ends_at: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
    setPromos(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null); setError('')
    setForm({ name: '', description: '', type: 'percentage', discount_value: '', starts_at: '', ends_at: '' })
    setShowModal(true)
  }

  function openEdit(p: Promotion) {
    setEditing(p); setError('')
    setForm({ name: p.name, description: p.description ?? '', type: p.type, discount_value: p.discount_value.toString(), starts_at: p.starts_at ? p.starts_at.split('T')[0] : '', ends_at: p.ends_at ? p.ends_at.split('T')[0] : '' })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name || !form.discount_value) { setError('El nombre y el valor del descuento son obligatorios'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const payload = {
      branch_id: BRANCH_ID,
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      discount_value: parseFloat(form.discount_value),
      starts_at: form.starts_at ? new Date(form.starts_at + 'T00:00:00').toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at + 'T23:59:59').toISOString() : null,
      is_active: true,
      uses_count: 0,
    }
    if (editing) {
      const { error: err } = await supabase.from('promotions').update(payload).eq('id', editing.id)
      if (err) { setError('Error al actualizar: ' + err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('promotions').insert(payload)
      if (err) { setError('Error al guardar: ' + err.message); setSaving(false); return }
    }
    setSaving(false); setShowModal(false); load()
  }

  async function toggleActive(p: Promotion) {
    const supabase = createClient()
    await supabase.from('promotions').update({ is_active: !p.is_active }).eq('id', p.id)
    load()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar esta promoción? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    const { error: err } = await supabase.from('promotions').delete().eq('id', id)
    if (err) { alert('Error al eliminar: ' + err.message); return }
    load()
  }

  const typeLabel = (t: string) => PROMO_TYPES.find(x => x.value === t)?.label ?? t
  const fmt = (n: number, type: string) => type === 'percentage' ? n + '%' : '$' + n.toLocaleString('es-CO')

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Promociones</h1>
          <p className="text-stone-500 text-sm mt-0.5">{promos.filter(p => p.is_active).length} activas · {promos.length} total</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors">+ Nueva Promoción</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : promos.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">🎁</p><p className="text-stone-500">No hay promociones registradas</p></div>
      ) : (
        <div className="grid gap-3">
          {promos.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${p.is_active ? 'border-stone-200' : 'border-stone-100 opacity-60'}`}>
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-2xl">🎁</span></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-stone-800">{p.name}</p>
                  {!p.is_active && <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Inactiva</span>}
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{typeLabel(p.type)}</span>
                </div>
                {p.description && <p className="text-sm text-stone-500 mt-0.5">{p.description}</p>}
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  <span className="text-sm font-bold text-purple-700">{fmt(p.discount_value, p.type)}</span>
                  {p.ends_at && <span className="text-sm text-stone-400">Vence: {new Date(p.ends_at).toLocaleDateString('es-CO')}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                <button onClick={() => openEdit(p)} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50">Editar</button>
                <button onClick={() => toggleActive(p)} className={`px-3 py-1.5 text-sm rounded-lg ${p.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                  {p.is_active ? 'Desactivar' : 'Activar'}
                </button>
                {isAdmin && (
                  <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">{editing ? 'Editar Promoción' : 'Nueva Promoción'}</h3>
            {error && <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm mb-4">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Descuento fin de semana"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Descripción</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descripción de la promoción"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Tipo *</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                    {PROMO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{form.type === 'percentage' ? 'Descuento (%)' : 'Descuento ($)'} *</label>
                  <input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Fecha inicio</label>
                  <input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Fecha fin</label>
                  <input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
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
