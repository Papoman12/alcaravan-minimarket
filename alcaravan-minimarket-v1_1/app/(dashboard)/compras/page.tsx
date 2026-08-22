'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Purchase {
  id: string
  purchase_number: string
  supplier_id: string
  total: number
  status: string
  created_at: string
  supplier?: { name: string }
}

interface Supplier {
  id: string
  name: string
}

export default function ComprasPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ supplier_id: '', notes: '', total: '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('purchases').select('*, supplier:suppliers(name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
    ])
    setPurchases(p ?? [])
    setSuppliers(s ?? [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.supplier_id || !form.total) return
    setSaving(true)
    const purchaseNumber = 'C' + Date.now().toString().slice(-8)
    await supabase.from('purchases').insert({
      purchase_number: purchaseNumber,
      supplier_id: form.supplier_id,
      total: parseFloat(form.total),
      subtotal: parseFloat(form.total),
      status: 'received',
      notes: form.notes || null,
    })
    setForm({ supplier_id: '', notes: '', total: '' })
    setShowModal(false)
    setSaving(false)
    load()
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    received: { label: 'Recibida', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-600' },
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Compras</h1>
          <p className="text-stone-500 text-sm mt-0.5">Registro de compras a proveedores</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/20"
        >
          + Nueva Compra
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🧾</p>
          <p className="text-stone-500">No hay compras registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">N° Compra</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {purchases.map((p) => {
                const st = statusLabel[p.status] ?? { label: p.status, color: 'bg-stone-100 text-stone-600' }
                return (
                  <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-stone-700">{p.purchase_number}</td>
                    <td className="px-4 py-3 text-stone-800">{p.supplier?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-500 text-sm">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-stone-800">{formatCurrency(p.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Nueva Compra</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Proveedor</label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                >
                  <option value="">Seleccionar proveedor...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Total ($)</label>
                <input
                  type="number"
                  value={form.total}
                  onChange={(e) => setForm({ ...form, total: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none"
                  placeholder="Observaciones..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.supplier_id || !form.total} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
