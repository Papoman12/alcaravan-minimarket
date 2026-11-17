'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { getColombiaDate } from '@/lib/colombia-time'

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  payment_method: string
  date: string
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
  cash:     '💵 Efectivo',
  nequi:    '📱 Nequi',
  transfer: '🏦 Transferencia',
  card:     '💳 Tarjeta',
}

type Period = 'today' | 'yesterday' | '7d' | '30d' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today',     label: 'Hoy'      },
  { key: 'yesterday', label: 'Ayer'     },
  { key: '7d',        label: '7 días'   },
  { key: '30d',       label: '30 días'  },
  { key: 'all',       label: 'Todo'     },
]

function getDateRange(period: Period): { from: string; to: string } | null {
  const today = getColombiaDate()
  if (period === 'all') return null
  if (period === 'today') return { from: today, to: today }
  if (period === 'yesterday') {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const y = d.toISOString().split('T')[0]
    return { from: y, to: y }
  }
  const days = period === '7d' ? 7 : 30
  const d = new Date(today + 'T00:00:00')
  d.setDate(d.getDate() - (days - 1))
  return { from: d.toISOString().split('T')[0], to: today }
}

function formatDateLabel(dateStr: string): string {
  const today = getColombiaDate()
  const yesterday = (() => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  })()
  if (dateStr === today) return 'Hoy'
  if (dateStr === yesterday) return 'Ayer'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: '2-digit', month: 'long',
  })
}

// ─── Modal nuevo gasto ─────────────────────────────────────────────────────────
function NuevoGastoModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'Otros',
    payment_method: 'cash',
    notes: '',
    date: getColombiaDate(),
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
        amount:      parseFloat(form.amount),
        category:    form.category,
        payment_method: form.payment_method,
        notes: form.notes || null,
        date:  form.date,
      })
      if (err) throw err
      onSaved()
    } catch (e) {
      console.error(e)
      setError('Error al guardar.')
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
          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Fecha</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              max={getColombiaDate()}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>

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

// ─── Página principal ──────────────────────────────────────────────────────────
export default function GastosPage() {
  const supabase = createClient()
  const [expenses, setExpenses]   = useState<Expense[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [period, setPeriod]       = useState<Period>('7d')
  const [catFilter, setCatFilter] = useState<string>('all')

  useEffect(() => { load() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const range = getDateRange(period)
    let q = supabase.from('expenses').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
    if (range) q = q.gte('date', range.from).lte('date', range.to)
    const { data } = await q
    setExpenses((data ?? []) as Expense[])
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('expenses').delete().eq('id', id)
    load()
  }

  // Filtro por categoría
  const filtered = useMemo(
    () => catFilter === 'all' ? expenses : expenses.filter(e => e.category === catFilter),
    [expenses, catFilter]
  )

  // Totales del período filtrado
  const totalPeriod  = filtered.reduce((s, e) => s + e.amount, 0)
  const totalEfectivo = filtered.filter(e => e.payment_method === 'cash').reduce((s, e) => s + e.amount, 0)
  const totalNequi   = filtered.filter(e => e.payment_method === 'nequi').reduce((s, e) => s + e.amount, 0)
  const totalTransfer = filtered.filter(e => e.payment_method === 'transfer').reduce((s, e) => s + e.amount, 0)

  // Resumen por categoría (del período, sin filtro de cat para mostrarlo completo)
  const catSummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  // Agrupar por fecha
  const byDate = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of filtered) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const usedCategories = [...new Set(expenses.map(e => e.category))]

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Gastos</h1>
          <p className="text-stone-500 text-sm mt-0.5">Egresos operativos del negocio</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20"
        >
          + Nuevo Gasto
        </button>
      </div>

      {/* Filtros de período */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              period === p.key
                ? 'bg-amber-700 text-white border-amber-700 shadow-sm'
                : 'bg-white text-stone-600 border-stone-200 hover:border-amber-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs del período */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Total período</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalPeriod)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{filtered.length} gastos</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">💵 Efectivo</p>
          <p className="text-lg font-bold text-stone-800 mt-1">{formatCurrency(totalEfectivo)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">📱 Nequi</p>
          <p className="text-lg font-bold text-stone-800 mt-1">{formatCurrency(totalNequi)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">🏦 Transferencia</p>
          <p className="text-lg font-bold text-stone-800 mt-1">{formatCurrency(totalTransfer)}</p>
        </div>
      </div>

      {/* Resumen por categoría */}
      {catSummary.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-5">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Por categoría</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCatFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                catFilter === 'all'
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-amber-300'
              }`}
            >
              Todos · {formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
            </button>
            {catSummary.map(([cat, total]) => (
              <button
                key={cat}
                onClick={() => setCatFilter(catFilter === cat ? 'all' : cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  catFilter === cat
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-amber-300'
                }`}
              >
                {cat} · {formatCurrency(total)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista agrupada por fecha */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : byDate.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">💸</p>
          <p className="text-stone-500">No hay gastos en este período</p>
        </div>
      ) : (
        <div className="space-y-4">
          {byDate.map(([date, dayExpenses]) => {
            const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0)
            return (
              <div key={date} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                {/* Cabecera del día */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-100">
                  <p className="text-sm font-semibold text-stone-700 capitalize">{formatDateLabel(date)}</p>
                  <p className="text-sm font-bold text-red-600">{formatCurrency(dayTotal)}</p>
                </div>
                {/* Gastos del día */}
                <div className="divide-y divide-stone-100">
                  {dayExpenses.map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-800 text-sm">{e.description}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {e.category} · {PAYMENT_ICONS[e.payment_method] ?? e.payment_method}
                        </p>
                        {e.notes && <p className="text-xs text-amber-700 italic mt-0.5">{e.notes}</p>}
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
            )
          })}
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
