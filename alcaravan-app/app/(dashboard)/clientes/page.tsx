'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Customer } from '@/types/database'

export default function CustomersPage() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('first_name')
    setCustomers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filtered = customers.filter((c) =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search) ||
    (c.document_number ?? '').includes(search)
  )

  const tierColors = {
    standard: 'bg-stone-100 text-stone-600',
    frequent: 'bg-blue-100 text-blue-700',
    vip: 'bg-amber-100 text-amber-700',
  }

  const tierLabels = {
    standard: '⭐ Estándar',
    frequent: '⭐⭐ Frecuente',
    vip: '👑 VIP',
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Clientes</h1>
          <p className="text-stone-500 text-sm">{customers.length} clientes registrados</p>
        </div>
        <button
          onClick={() => { setEditCustomer(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-xl transition-colors shadow-sm"
        >
          + Nuevo Cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm mb-4 p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre, teléfono, documento..."
          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="w-8 h-8 border-3 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-stone-500 font-medium">
              {search ? 'No se encontraron clientes' : 'Sin clientes registrados'}
            </p>
            {!search && (
              <button
                onClick={() => { setEditCustomer(null); setShowForm(true) }}
                className="mt-3 text-amber-700 hover:underline text-sm"
              >
                + Registrar primer cliente
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-stone-600">Contacto</th>
                  <th className="text-center px-4 py-3 font-semibold text-stone-600">Nivel</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Total Compras</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">N° Compras</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Última Compra</th>
                  <th className="text-right px-4 py-3 font-semibold text-stone-600">Puntos</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold flex-shrink-0">
                          {customer.first_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-stone-800">{customer.full_name}</p>
                          <p className="text-xs text-stone-400">
                            {customer.document_type}: {customer.document_number ?? '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-stone-700">{customer.phone ?? '—'}</p>
                      <p className="text-xs text-stone-400">{customer.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${tierColors[customer.loyalty_tier]}`}>
                        {tierLabels[customer.loyalty_tier]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-stone-800">
                      {formatCurrency(customer.total_purchases)}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-600">
                      {customer.purchase_count}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-500 text-xs">
                      {customer.last_purchase_at ? formatDate(customer.last_purchase_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-amber-700 font-medium">{customer.loyalty_points} pts</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setEditCustomer(customer); setShowForm(true) }}
                        className="px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <CustomerForm
          customer={editCustomer}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData() }}
        />
      )}
    </div>
  )
}

// ─── Formulario de cliente ────────────────────────────────────────────
function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const isEdit = !!customer
  const [form, setForm] = useState({
    document_type: customer?.document_type ?? 'CC',
    document_number: customer?.document_number ?? '',
    first_name: customer?.first_name ?? '',
    last_name: customer?.last_name ?? '',
    phone: customer?.phone ?? '',
    whatsapp: customer?.whatsapp ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    city: customer?.city ?? '',
    notes: customer?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim()) { setError('El nombre es requerido.'); return }

    setLoading(true)
    setError('')
    try {
      if (isEdit && customer) {
        const { error: err } = await supabase.from('customers').update(form).eq('id', customer.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('customers').insert(form)
        if (err) throw err
      }
      onSaved()
    } catch {
      setError('Error al guardar. Verifica que el documento no esté duplicado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-stone-200 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-stone-800">
            {isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Tipo documento</label>
              <select
                value={form.document_type}
                onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value as Customer['document_type'] }))}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 bg-white"
              >
                {['CC', 'NIT', 'CE', 'PA', 'TI'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Número documento</label>
              <input
                type="text"
                value={form.document_number}
                onChange={(e) => setForm((f) => ({ ...f, document_number: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Apellido</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">WhatsApp</label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Dirección</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white font-bold transition-colors">
              {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
