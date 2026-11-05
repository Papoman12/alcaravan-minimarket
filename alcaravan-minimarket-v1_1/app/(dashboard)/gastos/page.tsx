'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { getColombiaDate, formatColombiaDateTime } from '@/lib/colombia-time'

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  payment_method: string
  created_at: string
  notes?: string
}

const CATEGORIES = [
  'Arriendo',
  'Servicios públicos',
  'Nómina',
  'Transporte',
  'Mantenimiento',
  'Papelería',
  'Aseo',
  'Publicidad',
  'Otros',
]

const PAYMENT_ICONS: Record<string, string> = {
  cash: '💵 Efectivo',
  nequi: '📱 Nequi',
  transfer: '🏦 Transferencia',
  card: '💳 Tarjeta',
}

function NuevoGastoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'Otros',
    payment_method: 'cash',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.description.trim() || !form.amount) {
      setError('Completa descripción y monto')
      return
    }
    setError('')
    setSaving(true)
    try {
      const { error: err } = await supabase.from('expenses').insert({
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        category: form.category,
        payment_method: form.payment_method,
        notes: form.notes || null,
        date: getColombiaDate(),
      })
      if (err) throw err
      onSaved()
    } catch (e) {
      console.error(e)
      setError('Error al guardar. Verifica que la tabla expenses exista.')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-800">Nuevo Gasto</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Descripción *</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Ej: Pago luz EPM, escoba, taxi..."
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
              autoFocus
            />
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Monto ($) *</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              min="0"
              step="100"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Categoría</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Pagado con</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(PAYMENT_ICONS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, payment_method: key })}
                  className={`py-2 px-1 rounded-xl text-xs font-medium text-center transition-all border ${
                    form.payment_method === key
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-amber-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Observación..."
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-stone-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 font-medium">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.description || !form.amount}
            className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors"
          >
            {saving ? 'Guardando...' : 'Registrar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GastosPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterDate, setFilterDate] = useState(getColombiaDate())

  useEffect(() => {
    load()
  }, [filterDate]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('date', filterDate)
      .order('created_at', { ascending: false })
    setExpenses((data ?? []) as Expense[])
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('expenses').delete().eq('id', id)
    load()
  }

  const totalEfectivo = expenses.filter(e => e.payment_method === 'cash').reduce((s, e) => s + e.amount, 0)
  const totalNequi = expenses.filter(e => e.payment_method === 'nequi').reduce((s, e) => s + e.amount, 0)
  const totalDia = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Gastos</h1>
          <p className="text-stone-500 text-sm mt-0.5">Egresos operativos del negocio</p>
        </div>
        <div className="flex gap-3 items-center">
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-700"
          />
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20"
          >
            + Nuevo Gasto
          </button>
        </div>
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Total del día</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalDia)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">💵 En efectivo</p>
          <p className="text-xl font-bold text-stone-800 mt-1">{formatCurrency(totalEfectivo)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">📱 Por Nequi</p>
          <p className="text-xl font-bold text-stone-800 mt-1">{formatCurrency(totalNequi)}</p>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">💸</p>
          <p className="text-stone-500">No hay gastos registrados para este día</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="divide-y divide-stone-100">
            {expenses.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-800 text-sm">{e.description}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {e.category} · {PAYMENT_ICONS[e.payment_method] ?? e.payment_method} · {formatColombiaDateTime(e.created_at)}
                  </p>
                  {e.notes && <p className="text-xs text-stone-400 italic">{e.notes}</p>}
                </div>
                <p className="font-bold text-red-600 text-sm whitespace-nowrap">{formatCurrency(e.amount)}</p>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="text-stone-300 hover:text-red-500 transition-colors px-1 text-sm"
                  title="Eliminar"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <NuevoGastoModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
