'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  payment_method: string
  expense_date: string
  notes?: string
}

const CATEGORIES = ['Servicios', 'Arriendo', 'Nómina', 'Suministros', 'Mantenimiento', 'Transporte', 'Publicidad', 'Impuestos', 'Otro']

export default function GastosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', category: 'Suministros', payment_method: 'cash', expense_date: new Date().toISOString().split('T')[0], notes: '' })
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(100)
    setExpenses(data ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.description || !form.amount) return
    setSaving(true)
    await supabase.from('expenses').insert({
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
      payment_method: form.payment_method,
      expense_date: form.expense_date,
      notes: form.notes || null,
    })
    setSaving(false)
    setShowModal(false)
    setForm({ description: '', amount: '', category: 'Suministros', payment_method: 'cash', expense_date: new Date().toISOString().split('T')[0], notes: '' })
    load()
  }

  const totalMes = expenses.filter(e => e.expense_date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Gastos</h1>
          <p className="text-stone-500 text-sm mt-0.5">Este mes: <span className="font-semibold text-red-600">{formatCurrency(totalMes)}</span></p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20">
          + Nuevo Gasto
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" /></div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16"><p className="text-5xl mb-3">💳</p><p className="text-stone-500">No hay gastos registrados</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Descripción</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Fecha</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800">{e.description}</p>
                    {e.notes && <p className="text-xs text-stone-400">{e.notes}</p>}
                  </td>
                  <td className="px-4 py-3"><span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-full">{e.category}</span></td>
                  <td className="px-4 py-3 text-stone-500 text-sm">{formatDate(e.expense_date)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Nuevo Gasto</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Descripción *</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" placeholder="Ej: Pago de luz" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Monto ($) *</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Categoría</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Fecha</label>
                <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Notas</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" placeholder="Opcional" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.description || !form.amount} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
