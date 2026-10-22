'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsAdmin } from '@/lib/useIsAdmin'

const BRANCH_ID = '56916f1b-17dc-4c3d-8e65-a7d2a6554891'

interface Expense {
  id: string
  date: string
  category: string
  description?: string
  amount: number
  payment_method?: string
  notes?: string
  created_at: string
}

const CATEGORIES = ['Arriendo', 'Servicios públicos', 'Nómina', 'Proveedores', 'Mantenimiento', 'Marketing', 'Transporte', 'Otros']
const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta']

export default function GastosPage() {
  const isAdmin = useIsAdmin()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Otros',
    description: '',
    amount: '',
    payment_method: 'Efectivo',
    notes: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .limit(100)
    setExpenses(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setError('')
    setForm({ date: new Date().toISOString().split('T')[0], category: 'Otros', description: '', amount: '', payment_method: 'Efectivo', notes: '' })
    setShowModal(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setError('')
    setForm({
      date: e.date,
      category: e.category,
      description: e.description ?? '',
      amount: e.amount.toString(),
      payment_method: e.payment_method ?? 'Efectivo',
      notes: e.notes ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.amount || !form.date) { setError('Monto y fecha son obligatorios'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = {
      branch_id: BRANCH_ID,
      date: form.date,
      category: form.category,
      description: form.description.trim() || null,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      const { error: err } = await supabase.from('expenses').update(payload).eq('id', editing.id)
      if (err) { setError('Error al actualizar: ' + err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('expenses').insert(payload)
      if (err) { setError('Error al guardar: ' + err.message); setSaving(false); return }
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    const { error: err } = await supabase.from('expenses').delete().eq('id', id)
    if (err) { alert('Error al eliminar: ' + err.message); return }
    load()
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Gastos</h1>
          <p className="text-stone-500 text-sm mt-0.5">{expenses.length} registros · Total: {fmt(total)}</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors">
          + Nuevo Gasto
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">💸</p><p className="text-stone-500">No hay gastos registrados</p></div>
      ) : (
        <div className="grid gap-3">
          {expenses.map(e => (
            <div key={e.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">💸</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-stone-800">{e.category}</p>
                  <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{e.payment_method}</span>
                </div>
                {e.description && <p className="text-sm text-stone-500 mt-0.5">{e.description}</p>}
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  <span className="text-sm font-bold text-red-600">{fmt(e.amount)}</span>
                  <span className="text-sm text-stone-400">{new Date(e.date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(e)} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50">Editar</button>
                {isAdmin && (
                  <button onClick={() => handleDelete(e.id)} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Eliminar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">{editing ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
            {error && <div className="bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm mb-4">{error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Fecha *</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Monto *</label>
                  <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Categoría</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Método de pago</label>
                  <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                    {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Descripción</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detalle del gasto"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
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
