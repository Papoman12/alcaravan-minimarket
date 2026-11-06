'use client'

/**
 * Caja — Apertura, cierre y arqueo diario
 *
 * Flujo:
 *  1. Al inicio del día: cajero ingresa el efectivo con que abre la caja.
 *  2. Durante el día: las ventas se acumulan automáticamente.
 *  3. Al cierre: cajero cuenta el efectivo, el sistema muestra el arqueo
 *     (esperado vs real) y registra el cierre.
 *
 * Zona horaria: Colombia UTC-5. Supabase guarda en UTC, pero el "día"
 * se calcula según Colombia para evitar el bug de las 7pm.
 *
 * Tabla requerida en Supabase (ejecutar en SQL Editor si no existe):
 *
 *   CREATE TABLE IF NOT EXISTS cash_sessions (
 *     id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     date          DATE NOT NULL,          -- fecha Colombia YYYY-MM-DD
 *     opened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     closed_at     TIMESTAMPTZ,
 *     opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
 *     closing_amount NUMERIC(12,2),
 *     expected_cash  NUMERIC(12,2),
 *     difference     NUMERIC(12,2),
 *     notes         TEXT,
 *     status        TEXT NOT NULL DEFAULT 'open'
 *                   CHECK (status IN ('open','closed')),
 *     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  getColombiaDate,
  getColombiaDateUTCRange,
  formatColombiaTime,
} from '@/lib/colombia-time'

// ─── PIN de administrador ─────────────────────────────────────────────────────
// PIN universal para todas las acciones de administrador.
const ADMIN_PIN = '0915'

// ─── Modal: PIN de administrador ─────────────────────────────────────────────

function PinModal({
  title = 'Acción restringida',
  onSuccess,
  onClose,
}: {
  title?: string
  onSuccess: () => void
  onClose: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleVerify() {
    if (pin === ADMIN_PIN) {
      onSuccess()
    } else {
      setError('PIN incorrecto')
      setPin('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs">
        <div className="px-6 py-5 border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-800">🔐 {title}</h2>
          <p className="text-stone-500 text-sm mt-1">Solo el administrador puede continuar.</p>
        </div>
        <div className="p-6 space-y-4">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            placeholder="Ingresa el PIN"
            autoFocus
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-center text-2xl font-bold tracking-widest text-stone-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {error && (
            <p className="text-red-600 text-sm text-center font-medium">{error}</p>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleVerify}
            className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Detalle por método de pago ───────────────────────────────────────

type MethodKey = 'cash' | 'nequi' | 'transfer' | 'card'

const METHOD_INFO: Record<MethodKey, { label: string; icon: string; methods: string[] }> = {
  cash:     { label: 'Efectivo',                    icon: '💵', methods: ['cash'] },
  nequi:    { label: 'Nequi / Daviplata',           icon: '📱', methods: ['nequi', 'daviplata'] },
  transfer: { label: 'Bancolombia / Transferencia', icon: '🏦', methods: ['transfer', 'bancolombia'] },
  card:     { label: 'Tarjeta',                     icon: '💳', methods: ['card', 'card_debit', 'card_credit'] },
}

// ─── Sub-modal: Editar compra ─────────────────────────────────────────────────
interface CompraRow { id: string; supplier_name?: string; created_at: string; total: number; notes?: string; payment_method?: string }

function EditCompraModal({ compra, onSave, onClose }: {
  compra: CompraRow
  onSave: (updated: CompraRow) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    supplier_name: compra.supplier_name ?? '',
    total:         String(compra.total),
    payment_method: compra.payment_method ?? 'cash',
    notes:         compra.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const PM_OPTIONS = [
    { value: 'cash',       label: '💵 Efectivo' },
    { value: 'nequi',      label: '📱 Nequi' },
    { value: 'daviplata',  label: '📱 Daviplata' },
    { value: 'transfer',   label: '🏦 Transferencia' },
    { value: 'bancolombia',label: '🏦 Bancolombia' },
    { value: 'card',       label: '💳 Tarjeta' },
  ]

  async function handleSave() {
    const totalNum = parseFloat(form.total.replace(/[^0-9.]/g, ''))
    if (isNaN(totalNum) || totalNum <= 0) { setError('El total debe ser un número mayor a 0'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase
      .from('purchases')
      .update({
        supplier_name:  form.supplier_name || null,
        total:          totalNum,
        payment_method: form.payment_method,
        notes:          form.notes || null,
      })
      .eq('id', compra.id)
    setSaving(false)
    if (err) { setError('Error al guardar: ' + err.message); return }
    onSave({ ...compra, supplier_name: form.supplier_name || undefined, total: totalNum,
             payment_method: form.payment_method, notes: form.notes || undefined })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-800">✏️ Editar compra</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Proveedor</label>
            <input
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.supplier_name}
              onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
              placeholder="Nombre del proveedor"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Total ($)</label>
            <input
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.total}
              onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
              placeholder="0"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Método de pago</label>
            <select
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.payment_method}
              onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
            >
              {PM_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Notas</label>
            <input
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Descripción opcional"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-5 pb-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-stone-200 text-sm text-stone-600 hover:bg-stone-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetalleMetodoModal({ methodKey, onClose }: { methodKey: MethodKey; onClose: () => void }) {
  const supabase = createClient()
  const info = METHOD_INFO[methodKey]
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'ventas' | 'compras' | 'gastos'>('ventas')
  const [ventas,  setVentas]  = useState<{ id: string; sale_number: string; created_at: string; amount: number }[]>([])
  const [compras, setCompras] = useState<CompraRow[]>([])
  const [gastos,  setGastos]  = useState<{ id: string; description: string; date: string; amount: number; category: string }[]>([])
  const [editCompra, setEditCompra] = useState<CompraRow | null>(null)

  async function loadData() {
    setLoading(true)

    // Ventas — filtro directo (sale_payments.payment_method es confiable)
    const { data: payments } = await supabase
      .from('sale_payments')
      .select('amount, sales!inner(id, sale_number, created_at, status)')
      .in('payment_method', info.methods)
      .eq('sales.status', 'completed')

    setVentas(
      (payments ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => ({ id: p.sales.id, sale_number: p.sales.sale_number, created_at: p.sales.created_at, amount: p.amount }))
        .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))
    )

    // Compras — traemos TODAS y filtramos en JS (igual que la vista acumulada)
    // para garantizar que el resultado coincide con el total acumulado
    const { data: allPurch } = await supabase
      .from('purchases')
      .select('id, supplier_name, created_at, total, notes, payment_method, status')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    const filtered = (allPurch ?? []).filter(p =>
      info.methods.map(m => m.toLowerCase()).includes((p.payment_method ?? '').toLowerCase())
    )
    setCompras(filtered)

    // Gastos — igual, traer todo y filtrar en JS
    const { data: allExp } = await supabase
      .from('expenses')
      .select('id, description, date, amount, category, payment_method')
      .order('date', { ascending: false })

    const filteredExp = (allExp ?? []).filter(e =>
      info.methods.map(m => m.toLowerCase()).includes((e.payment_method ?? '').toLowerCase())
    )
    setGastos(filteredExp)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [methodKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalVentas  = ventas.reduce((s, v) => s + (Number(v.amount)  || 0), 0)
  const totalCompras = compras.reduce((s, c) => s + (Number(c.total)  || 0), 0)
  const totalGastos  = gastos.reduce((s, g) => s + (Number(g.amount) || 0), 0)
  const neto = totalVentas - totalCompras - totalGastos

  const tabs = [
    { key: 'ventas'  as const, label: `Ventas (${ventas.length})` },
    { key: 'compras' as const, label: `Compras (${compras.length})` },
    { key: 'gastos'  as const, label: `Gastos (${gastos.length})` },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-stone-800">{info.icon} {info.label}</h2>
            <p className="text-xs text-stone-400 mt-0.5">Todas las transacciones acumuladas</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">×</button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 border-b border-stone-100 flex-shrink-0">
          <div className="text-center px-3 py-3">
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Ventas</p>
            <p className="text-sm font-bold text-emerald-700 mt-0.5">+{formatCurrency(totalVentas)}</p>
          </div>
          <div className="text-center px-3 py-3 border-x border-stone-100">
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Egresos</p>
            <p className="text-sm font-bold text-red-600 mt-0.5">−{formatCurrency(totalCompras + totalGastos)}</p>
          </div>
          <div className="text-center px-3 py-3">
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Neto</p>
            <p className={`text-sm font-bold mt-0.5 ${neto >= 0 ? 'text-stone-800' : 'text-red-600'}`}>{formatCurrency(neto)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100 flex-shrink-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                tab === t.key ? 'border-b-2 border-amber-700 text-amber-700' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-4 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Tab Ventas ── */}
              {tab === 'ventas' && (
                <div className="divide-y divide-stone-50">
                  {ventas.length === 0
                    ? <p className="text-stone-400 text-sm text-center py-8">Sin ventas por este método</p>
                    : ventas.map((v, i) => (
                        <div key={`${v.id}-${i}`} className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                          <div>
                            <p className="text-sm font-mono font-medium text-stone-800">{v.sale_number}</p>
                            <p className="text-xs text-stone-400">{formatColombiaTime(v.created_at)}</p>
                          </div>
                          <p className="text-sm font-bold text-emerald-700">+{formatCurrency(v.amount)}</p>
                        </div>
                      ))
                  }
                  {ventas.length > 0 && (
                    <div className="flex justify-between px-5 py-3 bg-emerald-50 font-bold text-sm">
                      <span className="text-stone-700">Total</span>
                      <span className="text-emerald-700">+{formatCurrency(totalVentas)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab Compras ── */}
              {tab === 'compras' && (
                <div className="divide-y divide-stone-50">
                  {compras.length === 0
                    ? <p className="text-stone-400 text-sm text-center py-8">Sin compras por este método</p>
                    : compras.map(c => (
                        <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-stone-800">{c.supplier_name ?? 'Sin proveedor'}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-mono">
                                {c.payment_method ?? 'sin método'}
                              </span>
                              <span className="text-xs text-stone-400">{formatColombiaTime(c.created_at)}{c.notes ? ` · ${c.notes}` : ''}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <p className="text-sm font-bold text-red-600">−{formatCurrency(Number(c.total) || 0)}</p>
                            <button
                              onClick={() => setEditCompra(c)}
                              className="text-stone-300 hover:text-amber-600 transition-colors p-1 rounded"
                              title="Editar"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>
                      ))
                  }
                  {compras.length > 0 && (
                    <div className="flex justify-between px-5 py-3 bg-red-50 font-bold text-sm">
                      <span className="text-stone-700">Total</span>
                      <span className="text-red-600">−{formatCurrency(totalCompras)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab Gastos ── */}
              {tab === 'gastos' && (
                <div className="divide-y divide-stone-50">
                  {gastos.length === 0
                    ? <p className="text-stone-400 text-sm text-center py-8">Sin gastos por este método</p>
                    : gastos.map(g => (
                        <div key={g.id} className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                          <div>
                            <p className="text-sm font-medium text-stone-800">{g.description}</p>
                            <p className="text-xs text-stone-400">{g.date} · {g.category}</p>
                          </div>
                          <p className="text-sm font-bold text-red-600">−{formatCurrency(g.amount)}</p>
                        </div>
                      ))
                  }
                  {gastos.length > 0 && (
                    <div className="flex justify-between px-5 py-3 bg-red-50 font-bold text-sm">
                      <span className="text-stone-700">Total</span>
                      <span className="text-red-600">−{formatCurrency(totalGastos)}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sub-modal de edición */}
      {editCompra && (
        <EditCompraModal
          compra={editCompra}
          onClose={() => setEditCompra(null)}
          onSave={(updated) => {
            setCompras(prev => prev.map(c => c.id === updated.id ? updated : c))
            setEditCompra(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CashSession {
  id: string
  date: string
  opened_at: string
  closed_at: string | null
  opening_amount: number
  closing_amount: number | null
  expected_cash: number | null
  difference: number | null
  notes: string | null
  status: 'open' | 'closed'
}

interface DailySummary {
  total_sales: number
  cash_sales: number
  nequi_sales: number
  transfer_sales: number
  card_sales: number
  other_sales: number
  sale_count: number
  sales: {
    id: string
    sale_number: string
    total: number
    created_at: string
    payments: { payment_method: string; amount: number }[]
  }[]
}

interface DailyEgresos {
  cash_purchases: number
  nequi_purchases: number
  transfer_purchases: number
  card_purchases: number
  cash_expenses: number
  nequi_expenses: number
  transfer_expenses: number
  card_expenses: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card_debit: 'Débito',
  card_credit: 'Crédito',
  transfer: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bancolombia: 'Bancolombia',
  other: 'Otro',
}

// ─── Modal: Abrir Caja ────────────────────────────────────────────────────────

function AbrirCajaModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (amount: number) => Promise<void>
  onClose: () => void
}) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const today = getColombiaDate()

  async function handleSubmit() {
    setLoading(true)
    await onConfirm(parseFloat(amount) || 0)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-5 border-b border-stone-100">
          <h2 className="text-xl font-bold text-stone-800">🔓 Abrir Caja</h2>
          <p className="text-stone-500 text-sm mt-1">
            {new Date(today).toLocaleDateString('es-CO', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Efectivo inicial en caja
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="0"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-right text-xl font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
            <p className="text-xs text-stone-400 mt-1">
              Ingresa el dinero que hay físicamente en la caja al inicio del día.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:bg-stone-300 transition-colors shadow-lg shadow-emerald-600/25"
          >
            {loading ? '...' : '✓ Abrir Caja'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Cierre y Arqueo ───────────────────────────────────────────────────

function CerrarCajaModal({
  session,
  summary,
  onConfirm,
  onClose,
}: {
  session: CashSession
  summary: DailySummary
  onConfirm: (closingAmount: number, notes: string) => Promise<void>
  onClose: () => void
}) {
  const expectedCash = session.opening_amount + summary.cash_sales
  const [closingAmount, setClosingAmount] = useState(String(expectedCash))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const actual = parseFloat(closingAmount) || 0
  const difference = actual - expectedCash

  async function handleSubmit() {
    setLoading(true)
    await onConfirm(actual, notes)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-4">
        <div className="px-6 py-5 border-b border-stone-100">
          <h2 className="text-xl font-bold text-stone-800">🔒 Cierre de Caja</h2>
          <p className="text-stone-500 text-sm mt-1">Arqueo y resumen del día</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Resumen del día */}
          <div className="bg-stone-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
              Resumen de ventas del día
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Total ventas ({summary.sale_count})</span>
              <span className="font-bold text-stone-800">{formatCurrency(summary.total_sales)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">💵 Efectivo recibido</span>
              <span className="font-medium text-emerald-700">{formatCurrency(summary.cash_sales)}</span>
            </div>
            {summary.nequi_sales > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">📱 Nequi / Daviplata</span>
                <span className="font-medium text-stone-700">{formatCurrency(summary.nequi_sales)}</span>
              </div>
            )}
            {summary.transfer_sales > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">🏦 Transferencias</span>
                <span className="font-medium text-stone-700">{formatCurrency(summary.transfer_sales)}</span>
              </div>
            )}
            {summary.card_sales > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-stone-600">💳 Tarjeta</span>
                <span className="font-medium text-stone-700">{formatCurrency(summary.card_sales)}</span>
              </div>
            )}
          </div>

          {/* Arqueo */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
              Arqueo de efectivo
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Efectivo inicial</span>
              <span className="font-medium">{formatCurrency(session.opening_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">+ Ventas en efectivo</span>
              <span className="font-medium">{formatCurrency(summary.cash_sales)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-amber-200 pt-2 mt-2">
              <span className="text-stone-700">= Efectivo esperado</span>
              <span className="text-amber-700">{formatCurrency(expectedCash)}</span>
            </div>
          </div>

          {/* Efectivo contado */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Efectivo contado físicamente
            </label>
            <input
              type="number"
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-right text-xl font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>

          {/* Diferencia */}
          {closingAmount && (
            <div className={`rounded-xl p-3 text-center ${
              Math.abs(difference) < 1
                ? 'bg-emerald-50 border border-emerald-200'
                : difference > 0
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <p className="text-xs text-stone-500 mb-1">Diferencia (sobrante/faltante)</p>
              <p className={`text-2xl font-bold ${
                Math.abs(difference) < 1
                  ? 'text-emerald-600'
                  : difference > 0
                  ? 'text-blue-600'
                  : 'text-red-600'
              }`}>
                {difference > 0 ? '+' : ''}{formatCurrency(difference)}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                {Math.abs(difference) < 1
                  ? '✓ Cuadra perfectamente'
                  : difference > 0
                  ? 'Hay más dinero del esperado'
                  : 'Hay menos dinero del esperado'}
              </p>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Observaciones (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej: Falta de cambio, gastos menores..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !closingAmount}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:bg-stone-300 transition-colors"
          >
            {loading ? '...' : '🔒 Cerrar Caja'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CajaPage() {
  const supabase = createClient()

  const [session, setSession] = useState<CashSession | null>(null)
  const [summary, setSummary] = useState<DailySummary>({
    total_sales: 0, cash_sales: 0, nequi_sales: 0,
    transfer_sales: 0, card_sales: 0, other_sales: 0,
    sale_count: 0, sales: [],
  })
  const [egresos, setEgresos] = useState<DailyEgresos>({
    cash_purchases: 0, nequi_purchases: 0, transfer_purchases: 0, card_purchases: 0,
    cash_expenses: 0, nequi_expenses: 0, transfer_expenses: 0, card_expenses: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showAbrir, setShowAbrir] = useState(false)
  const [showCerrar, setShowCerrar] = useState(false)
  const [error, setError] = useState('')
  const [cumulative, setCumulative] = useState({
    cash: 0, nequi: 0, transfer: 0, card: 0,
    cash_out: 0, nequi_out: 0, transfer_out: 0, card_out: 0,
    cash_purchases: 0, cash_expenses: 0,
  })
  const [showCumulativeBalance, setShowCumulativeBalance] = useState(false)
  const [showPinBalance, setShowPinBalance] = useState(false)
  const [showDetailMethod, setShowDetailMethod] = useState<MethodKey | null>(null)
  const [allSessions, setAllSessions] = useState<CashSession[]>([])

  const colombiaToday = getColombiaDate()
  const { from: todayFrom, to: todayTo } = getColombiaDateUTCRange(colombiaToday)

  // ── Cargar sesión del día y ventas ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      // Buscar sesión de hoy
      const { data: sessionData, error: sessionError } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('date', colombiaToday)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionError && sessionError.code !== 'PGRST116') {
        // Tabla no existe aún
        if (sessionError.code === '42P01') {
          setError('tabla_no_existe')
          setLoading(false)
          return
        }
        throw sessionError
      }

      setSession(sessionData ?? null)

      // Cargar ventas de hoy (con zona horaria Colombia)
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          id, sale_number, total, created_at,
          sale_payments(payment_method, amount)
        `)
        .gte('created_at', todayFrom)
        .lt('created_at', todayTo)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      const sales = salesData ?? []

      // Calcular totales por método de pago
      let cash = 0, nequi = 0, transfer = 0, card = 0, other = 0, total = 0

      for (const sale of sales) {
        total += sale.total
        for (const p of (sale.sale_payments ?? [])) {
          if (p.payment_method === 'cash') cash += p.amount
          else if (['nequi', 'daviplata'].includes(p.payment_method)) nequi += p.amount
          else if (['transfer', 'bancolombia'].includes(p.payment_method)) transfer += p.amount
          else if (['card_debit', 'card_credit'].includes(p.payment_method)) card += p.amount
          else other += p.amount
        }
      }

      setSummary({
        total_sales: total,
        cash_sales: cash,
        nequi_sales: nequi,
        transfer_sales: transfer,
        card_sales: card,
        other_sales: other,
        sale_count: sales.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sales: (sales as any[]).map(s => ({ ...s, payments: s.sale_payments ?? [] })) as DailySummary['sales'],
      })

      // ── Egresos del día: compras y gastos pagados en efectivo/Nequi ──────────
      const egresosResult: DailyEgresos = {
        cash_purchases: 0, nequi_purchases: 0, transfer_purchases: 0, card_purchases: 0,
        cash_expenses: 0, nequi_expenses: 0, transfer_expenses: 0, card_expenses: 0,
      }

      // Compras de hoy por todos los métodos de pago (excluye canceladas)
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('total, payment_method')
        .gte('created_at', todayFrom)
        .lt('created_at', todayTo)
        .neq('status', 'cancelled')

      for (const p of (purchasesData ?? [])) {
        if (p.payment_method === 'cash') egresosResult.cash_purchases += p.total
        else if (['nequi', 'daviplata'].includes(p.payment_method)) egresosResult.nequi_purchases += p.total
        else if (['transfer', 'bancolombia'].includes(p.payment_method)) egresosResult.transfer_purchases += p.total
        else if (['card_debit', 'card_credit'].includes(p.payment_method)) egresosResult.card_purchases += p.total
      }

      // Gastos de hoy por todos los métodos de pago
      // (expenses usa 'card' para tarjeta, no 'card_debit'/'card_credit')
      const { data: expData } = await supabase
        .from('expenses')
        .select('amount, payment_method')
        .eq('date', colombiaToday)

      for (const e of (expData ?? [])) {
        if (e.payment_method === 'cash') egresosResult.cash_expenses += e.amount
        else if (['nequi', 'daviplata'].includes(e.payment_method)) egresosResult.nequi_expenses += e.amount
        else if (['transfer', 'bancolombia'].includes(e.payment_method)) egresosResult.transfer_expenses += e.amount
        else if (['card', 'card_debit', 'card_credit'].includes(e.payment_method)) egresosResult.card_expenses += e.amount
      }

      setEgresos(egresosResult)

      // ── Balance acumulado histórico (desde el inicio) ─────────────────────
      // Ventas históricas por método de pago
      const { data: allPayments } = await supabase
        .from('sale_payments')
        .select('payment_method, amount, sales!inner(status)')
        .eq('sales.status', 'completed')

      let cumCash = 0, cumNequi = 0, cumTransfer = 0, cumCard = 0
      for (const p of (allPayments ?? [])) {
        const pm  = (p.payment_method ?? '').toLowerCase()
        const amt = Number(p.amount) || 0
        if (pm === 'cash') cumCash += amt
        else if (['nequi', 'daviplata'].includes(pm)) cumNequi += amt
        else if (['transfer', 'bancolombia'].includes(pm)) cumTransfer += amt
        else if (['card', 'card_debit', 'card_credit'].includes(pm)) cumCard += amt
      }

      // Compras históricas — sin filtro de status para capturar TODAS las
      // compras pagadas, independientemente de si llegaron o no.
      // Solo excluimos las canceladas (si tienen ese campo).
      const { data: allPurchases } = await supabase
        .from('purchases')
        .select('payment_method, total, status')
        .neq('status', 'cancelled')

      let cumCashOut = 0, cumNequiOut = 0, cumTransferOut = 0, cumCardOut = 0
      let cumCashPurchases = 0 // para desglose en UI
      for (const p of (allPurchases ?? [])) {
        const pm = (p.payment_method ?? '').toLowerCase()
        const amt = Number(p.total) || 0
        if (pm === 'cash') { cumCashOut += amt; cumCashPurchases += amt }
        else if (['nequi', 'daviplata'].includes(pm)) cumNequiOut += amt
        else if (['transfer', 'bancolombia'].includes(pm)) cumTransferOut += amt
        else if (['card', 'card_debit', 'card_credit'].includes(pm)) cumCardOut += amt
      }

      // Gastos históricos — manejamos el error explícitamente
      const { data: allExpenses, error: expErr } = await supabase
        .from('expenses')
        .select('payment_method, amount')

      let cumCashExpenses = 0 // para desglose en UI
      if (!expErr) {
        for (const e of (allExpenses ?? [])) {
          const pm = (e.payment_method ?? '').toLowerCase()
          const amt = Number(e.amount) || 0
          if (pm === 'cash') { cumCashOut += amt; cumCashExpenses += amt }
          else if (['nequi', 'daviplata'].includes(pm)) cumNequiOut += amt
          else if (['transfer', 'bancolombia'].includes(pm)) cumTransferOut += amt
          else if (['card', 'card_debit', 'card_credit'].includes(pm)) cumCardOut += amt
        }
      }

      setCumulative({
        cash: cumCash, nequi: cumNequi, transfer: cumTransfer, card: cumCard,
        cash_out: cumCashOut, nequi_out: cumNequiOut,
        transfer_out: cumTransferOut, card_out: cumCardOut,
        cash_purchases: cumCashPurchases,
        cash_expenses: cumCashExpenses,
      })

      // ── Historial de sesiones de caja ──────────────────────────────────────
      const { data: sessionsHistory } = await supabase
        .from('cash_sessions')
        .select('*')
        .order('date', { ascending: false })
        .limit(60) // últimos 2 meses aprox.

      setAllSessions(sessionsHistory ?? [])

    } catch (err) {
      console.error(err)
      setError('No se pudo cargar la información de caja.')
    }

    setLoading(false)
  }, [colombiaToday, todayFrom, todayTo])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Abrir caja ─────────────────────────────────────────────────────────────
  async function handleAbrirCaja(openingAmount: number) {
    const { data, error } = await supabase
      .from('cash_sessions')
      .insert({
        date: colombiaToday,
        opening_amount: openingAmount,
        status: 'open',
      })
      .select()
      .single()

    if (error) {
      alert('Error al abrir la caja: ' + error.message)
      return
    }

    setSession(data)
    setShowAbrir(false)
  }

  // ── Corregir monto de apertura (protegido por PIN de admin) ───────────────
  async function handleEditApertura() {
    if (!session) return
    // Verificar PIN de administrador
    const pin = prompt('🔐 Ingresa el PIN de administrador para continuar:')
    if (pin === null) return // Canceló
    if (pin.trim() !== ADMIN_PIN) {
      alert('❌ PIN incorrecto. Solo los administradores pueden corregir la apertura.')
      return
    }
    // PIN correcto → pedir el monto nuevo
    const input = prompt(
      `✏️ Corregir apertura\n\nMonto actual: $${session.opening_amount.toLocaleString('es-CO')}\n\nIngresa el monto correcto:`,
      String(session.opening_amount)
    )
    if (input === null) return
    const nuevo = parseFloat(input)
    if (isNaN(nuevo) || nuevo < 0) { alert('Monto inválido'); return }
    const { error } = await supabase
      .from('cash_sessions')
      .update({ opening_amount: nuevo })
      .eq('id', session.id)
    if (error) { alert('Error al actualizar: ' + error.message); return }
    await loadData()
  }

  // ── Cerrar caja ────────────────────────────────────────────────────────────
  async function handleCerrarCaja(closingAmount: number, notes: string) {
    if (!session) return
    const expectedCash =
      session.opening_amount + summary.cash_sales
      - egresos.cash_purchases - egresos.cash_expenses
    const difference = closingAmount - expectedCash

    const { error } = await supabase
      .from('cash_sessions')
      .update({
        closed_at: new Date().toISOString(),
        closing_amount: closingAmount,
        expected_cash: expectedCash,
        difference,
        notes: notes || null,
        status: 'closed',
      })
      .eq('id', session.id)

    if (error) {
      alert('Error al cerrar la caja: ' + error.message)
      return
    }

    setShowCerrar(false)
    await loadData()
  }

  // ── Renderizado ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />
      </div>
    )
  }

  // Si la tabla no existe
  if (error === 'tabla_no_existe') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-amber-800 mb-2">⚙️ Configuración requerida</h2>
          <p className="text-amber-700 text-sm mb-4">
            Para usar la caja necesitas crear la tabla <code className="bg-amber-100 px-1 rounded">cash_sessions</code> en Supabase.
          </p>
          <p className="text-amber-700 text-sm font-medium mb-2">Ejecuta este SQL en Supabase → SQL Editor:</p>
          <pre className="bg-white border border-amber-200 rounded-xl p-4 text-xs text-stone-700 overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS cash_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL,
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at      TIMESTAMPTZ,
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(12,2),
  expected_cash  NUMERIC(12,2),
  difference     NUMERIC(12,2),
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','closed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage cash_sessions"
  ON cash_sessions FOR ALL TO authenticated USING (true);`}
          </pre>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-amber-700 text-white rounded-xl text-sm font-medium hover:bg-amber-800 transition-colors"
          >
            🔄 Reintentar
          </button>
        </div>
      </div>
    )
  }

  const fechaDisplay = new Date(colombiaToday + 'T12:00:00Z').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">💰 Caja</h1>
          <p className="text-stone-500 text-sm capitalize">{fechaDisplay}</p>
        </div>

        {/* Estado de la caja */}
        {session?.status === 'open' ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Abierta
          </span>
        ) : session?.status === 'closed' ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
            🔒 Cerrada
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-500 text-sm font-semibold rounded-full">
            Sin abrir
          </span>
        )}
      </div>

      {/* ── Alerta si no hay sesión ──────────────────────────────────────────── */}
      {!session && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
          <p className="text-2xl mb-2">🔓</p>
          <p className="font-semibold text-amber-800">La caja no ha sido abierta hoy</p>
          <p className="text-amber-600 text-sm mt-1 mb-4">
            Registra el efectivo inicial antes de empezar a vender.
          </p>
          <button
            onClick={() => setShowAbrir(true)}
            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/25"
          >
            🔓 Abrir Caja
          </button>
        </div>
      )}

      {/* ── Sesión abierta ───────────────────────────────────────────────────── */}
      {session && (
        <>
          {/* Info apertura */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide">Apertura</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-lg font-bold text-stone-800">
                  {formatCurrency(session.opening_amount)}
                </p>
                {session.status === 'open' && (
                  <button
                    onClick={handleEditApertura}
                    className="text-xs text-stone-400 hover:text-amber-700 transition-colors px-1.5 py-0.5 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200"
                    title="Corregir monto de apertura (requiere PIN de administrador)"
                  >
                    ✏️ corregir
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500">
                {formatColombiaTime(session.opened_at)}
              </p>
            </div>
            {session.status === 'closed' && session.closed_at && (
              <div className="text-right">
                <p className="text-xs text-stone-400 uppercase tracking-wide">Cierre</p>
                <p className="text-lg font-bold text-stone-800">
                  {formatCurrency(session.closing_amount ?? 0)}
                </p>
                <p className="text-xs text-stone-500">
                  {formatColombiaTime(session.closed_at)}
                </p>
              </div>
            )}
          </div>

          {/* ── Balance acumulado total (protegido por PIN) ───────────────── */}
          {!showCumulativeBalance ? (
            <div className="flex justify-end">
              <button
                onClick={() => setShowPinBalance(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-700 text-sm font-medium transition-colors border border-stone-200"
              >
                🔐 Ver balance total acumulado
              </button>
            </div>
          ) : (
            (() => {
              // Todas las ventas en efectivo desde el inicio
              // menos todos los gastos y compras pagados en efectivo
              const efectivoTotal = cumulative.cash - cumulative.cash_out
              const nequiTotal    = cumulative.nequi - cumulative.nequi_out
              const transferTotal = cumulative.transfer - cumulative.transfer_out
              const cardTotal     = cumulative.card - cumulative.card_out

              const rows: { icon: string; label: string; value: number; sub: string; methodKey: MethodKey }[] = [
                { icon: '💵', label: 'Efectivo', value: efectivoTotal, methodKey: 'cash',
                  sub: [
                    `+${formatCurrency(cumulative.cash)} ventas`,
                    cumulative.cash_purchases > 0 ? `−${formatCurrency(cumulative.cash_purchases)} compras` : '',
                    cumulative.cash_expenses  > 0 ? `−${formatCurrency(cumulative.cash_expenses)} gastos`   : '',
                  ].filter(Boolean).join(' · ')
                },
                ...(cumulative.nequi > 0 || nequiTotal !== 0 ? [{ icon: '📱', label: 'Nequi / Daviplata', value: nequiTotal, methodKey: 'nequi' as MethodKey, sub: `${formatCurrency(cumulative.nequi)} ventas · −${formatCurrency(cumulative.nequi_out)} egresos` }] : []),
                ...(cumulative.transfer > 0 || transferTotal !== 0 ? [{ icon: '🏦', label: 'Bancolombia / Transferencia', value: transferTotal, methodKey: 'transfer' as MethodKey, sub: `${formatCurrency(cumulative.transfer)} ventas · −${formatCurrency(cumulative.transfer_out)} egresos` }] : []),
                ...(cumulative.card > 0 || cardTotal !== 0 ? [{ icon: '💳', label: 'Tarjeta (en banco)', value: cardTotal, methodKey: 'card' as MethodKey, sub: `${formatCurrency(cumulative.card)} ventas` }] : []),
              ]

              return (
                <div className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide">
                      💰 Dinero acumulado total — desde el inicio
                    </p>
                    <button
                      onClick={() => setShowCumulativeBalance(false)}
                      className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                    >
                      Ocultar ✕
                    </button>
                  </div>
                  <div className="space-y-3">
                    {rows.map((row, i) => (
                      <div key={i} className={`${i > 0 ? 'border-t border-stone-700 pt-3' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{row.icon} {row.label}</p>
                            <p className="text-[11px] text-stone-400 mt-0.5">{row.sub}</p>
                          </div>
                          <p className={`text-xl font-bold flex-shrink-0 ml-4 ${row.value < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {formatCurrency(row.value)}
                          </p>
                        </div>
                        <button
                          onClick={() => setShowDetailMethod(row.methodKey)}
                          className="mt-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-2"
                        >
                          Ver detalle →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()
          )}

          {/* KPIs del día */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wide">Ventas</p>
              <p className="text-xl font-bold text-stone-800">{summary.sale_count}</p>
              <p className="text-xs text-stone-500">transacciones</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.total_sales)}</p>
              <p className="text-xs text-stone-500">todos los métodos</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wide">💵 Efectivo</p>
              <p className="text-xl font-bold text-emerald-700">{formatCurrency(summary.cash_sales)}</p>
              <p className="text-xs text-stone-500">en ventas</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <p className="text-xs text-stone-400 uppercase tracking-wide">📱 Digital</p>
              <p className="text-xl font-bold text-blue-700">
                {formatCurrency(summary.nequi_sales + summary.transfer_sales + summary.card_sales)}
              </p>
              <p className="text-xs text-stone-500">Nequi / Tarjeta / Transf.</p>
            </div>
          </div>

          {/* ── Balance por método de pago ──────────────────────────── */}
          {session.status === 'open' && (() => {
            const efectivoBal = session.opening_amount + summary.cash_sales
              - egresos.cash_purchases - egresos.cash_expenses
            const nequiBal = summary.nequi_sales
              - egresos.nequi_purchases - egresos.nequi_expenses
            const transferBal = summary.transfer_sales
              - egresos.transfer_purchases - egresos.transfer_expenses
            // card_sales incluye card_debit+card_credit; card_expenses usa 'card'
            const cardBal = summary.card_sales - egresos.card_purchases - egresos.card_expenses

            const rows = [
              { icon: '💵', label: 'Efectivo en caja', balance: efectivoBal, detail: `${formatCurrency(session.opening_amount)} apertura + ${formatCurrency(summary.cash_sales)} ventas${(egresos.cash_purchases + egresos.cash_expenses) > 0 ? ` − ${formatCurrency(egresos.cash_purchases + egresos.cash_expenses)} egresos` : ''}` },
              ...(summary.nequi_sales > 0 || nequiBal !== 0 ? [{ icon: '📱', label: 'Nequi / Daviplata', balance: nequiBal, detail: `${formatCurrency(summary.nequi_sales)} ventas${(egresos.nequi_purchases + egresos.nequi_expenses) > 0 ? ` − ${formatCurrency(egresos.nequi_purchases + egresos.nequi_expenses)} egresos` : ''}` }] : []),
              ...(summary.transfer_sales > 0 || transferBal !== 0 ? [{ icon: '🏦', label: 'Bancolombia / Transferencia', balance: transferBal, detail: `${formatCurrency(summary.transfer_sales)} ventas${(egresos.transfer_purchases + egresos.transfer_expenses) > 0 ? ` − ${formatCurrency(egresos.transfer_purchases + egresos.transfer_expenses)} egresos` : ''}` }] : []),
              ...(summary.card_sales > 0 || cardBal !== 0 ? [{ icon: '💳', label: 'Tarjeta (va al banco)', balance: cardBal, detail: `${formatCurrency(summary.card_sales)} ventas` }] : []),
            ]

            return (
              <div className="bg-white border border-stone-200 rounded-2xl p-4">
                <p className="text-xs text-stone-500 font-semibold uppercase tracking-wide mb-3">
                  💼 ¿Cuánto tienes en cada medio?
                </p>
                <div className="space-y-3">
                  {rows.map((row, i) => (
                    <div key={i} className={`flex items-center justify-between ${i > 0 ? 'border-t border-stone-100 pt-3' : ''}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-700">{row.icon} {row.label}</p>
                        <p className="text-xs text-stone-400">{row.detail}</p>
                      </div>
                      <p className={`text-lg font-bold flex-shrink-0 ml-4 ${row.balance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {formatCurrency(row.balance)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Egresos del día */}
          {(egresos.cash_purchases + egresos.nequi_purchases + egresos.cash_expenses + egresos.nequi_expenses
            + egresos.transfer_purchases + egresos.transfer_expenses + egresos.card_purchases + egresos.card_expenses) > 0 && (
            <div className="bg-white border border-stone-200 rounded-2xl p-4">
              <p className="text-xs text-stone-500 font-semibold uppercase tracking-wide mb-3">📤 Egresos del día</p>
              <div className="space-y-2 text-sm">
                {egresos.cash_purchases > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">💵 Compras en efectivo</span>
                    <span className="font-semibold text-red-600">− {formatCurrency(egresos.cash_purchases)}</span>
                  </div>
                )}
                {egresos.nequi_purchases > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">📱 Compras por Nequi</span>
                    <span className="font-semibold text-red-600">− {formatCurrency(egresos.nequi_purchases)}</span>
                  </div>
                )}
                {egresos.cash_expenses > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">💵 Gastos en efectivo</span>
                    <span className="font-semibold text-red-600">− {formatCurrency(egresos.cash_expenses)}</span>
                  </div>
                )}
                {egresos.nequi_expenses > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">📱 Gastos por Nequi/Daviplata</span>
                    <span className="font-semibold text-red-600">− {formatCurrency(egresos.nequi_expenses)}</span>
                  </div>
                )}
                {egresos.transfer_purchases > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">🏦 Compras por transferencia</span>
                    <span className="font-semibold text-red-600">− {formatCurrency(egresos.transfer_purchases)}</span>
                  </div>
                )}
                {egresos.transfer_expenses > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">🏦 Gastos por transferencia</span>
                    <span className="font-semibold text-red-600">− {formatCurrency(egresos.transfer_expenses)}</span>
                  </div>
                )}
                {egresos.card_purchases > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">💳 Compras con tarjeta</span>
                    <span className="font-semibold text-red-600">− {formatCurrency(egresos.card_purchases)}</span>
                  </div>
                )}
                {egresos.card_expenses > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">💳 Gastos con tarjeta</span>
                    <span className="font-semibold text-red-600">− {formatCurrency(egresos.card_expenses)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-stone-100 pt-2 font-bold">
                  <span className="text-stone-700">Total egresos</span>
                  <span className="text-red-600">
                    − {formatCurrency(
                      egresos.cash_purchases + egresos.nequi_purchases +
                      egresos.transfer_purchases + egresos.card_purchases +
                      egresos.cash_expenses + egresos.nequi_expenses +
                      egresos.transfer_expenses + egresos.card_expenses
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Efectivo esperado en caja */}
          {session.status === 'open' && (() => {
            const efectivoEsperado = session.opening_amount + summary.cash_sales - egresos.cash_purchases - egresos.cash_expenses
            return (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">
                    Efectivo esperado en caja ahora
                  </p>
                  <p className="text-3xl font-bold text-emerald-800 mt-1">
                    {formatCurrency(efectivoEsperado)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {formatCurrency(session.opening_amount)} apertura
                    + {formatCurrency(summary.cash_sales)} ventas
                    {(egresos.cash_purchases + egresos.cash_expenses) > 0 && (
                      ` − ${formatCurrency(egresos.cash_purchases + egresos.cash_expenses)} egresos`
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setShowCerrar(true)}
                  className="px-5 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/25 text-sm"
                >
                  🔒 Cerrar<br />Caja
                </button>
              </div>
            )
          })()}

          {/* Arqueo del cierre (si ya está cerrada) */}
          {session.status === 'closed' && session.expected_cash !== null && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5">
              <p className="text-sm font-bold text-stone-700 mb-4">📋 Arqueo del cierre</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Efectivo esperado</span>
                  <span className="font-medium">{formatCurrency(session.expected_cash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Efectivo contado</span>
                  <span className="font-medium">{formatCurrency(session.closing_amount ?? 0)}</span>
                </div>
                <div className={`flex justify-between font-bold border-t border-stone-100 pt-2 mt-2 ${
                  (session.difference ?? 0) < 0 ? 'text-red-600' : (session.difference ?? 0) > 0 ? 'text-blue-600' : 'text-emerald-600'
                }`}>
                  <span>Diferencia</span>
                  <span>
                    {(session.difference ?? 0) > 0 ? '+' : ''}{formatCurrency(session.difference ?? 0)}
                  </span>
                </div>
              </div>
              {session.notes && (
                <p className="text-xs text-stone-400 mt-3 border-t border-stone-100 pt-3">
                  Obs: {session.notes}
                </p>
              )}
            </div>
          )}

          {/* Listado de ventas del día */}
          {summary.sales.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100">
                <p className="font-semibold text-stone-800 text-sm">Ventas del día</p>
              </div>
              <div className="divide-y divide-stone-50 max-h-72 overflow-y-auto">
                {summary.sales.map((sale) => {
                  const cashAmt = sale.payments
                    .filter((p) => p.payment_method === 'cash')
                    .reduce((s, p) => s + p.amount, 0)
                  const methodsSummary = sale.payments
                    .map((p) => `${PAYMENT_LABELS[p.payment_method] ?? p.payment_method}`)
                    .join(' + ')

                  return (
                    <div key={sale.id} className="px-4 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors">
                      <div>
                        <p className="text-sm font-mono font-medium text-stone-800">
                          {sale.sale_number}
                        </p>
                        <p className="text-xs text-stone-400">
                          {formatColombiaTime(sale.created_at)} · {methodsSummary}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-stone-800 text-sm">{formatCurrency(sale.total)}</p>
                        {cashAmt > 0 && (
                          <p className="text-xs text-emerald-600">{formatCurrency(cashAmt)} efvo.</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {summary.sales.length === 0 && session.status === 'open' && (
            <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center">
              <p className="text-3xl mb-2">🛒</p>
              <p className="text-stone-400 text-sm">Aún no hay ventas registradas hoy.</p>
              <a href="/pos" className="text-amber-700 text-sm hover:underline mt-1 inline-block font-medium">
                Ir al Punto de Venta →
              </a>
            </div>
          )}
        </>
      )}

      {/* ── Historial de aperturas y cierres ────────────────────────────────── */}
      {allSessions.length > 1 && (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <p className="font-semibold text-stone-800 text-sm">📋 Historial de caja</p>
            <p className="text-xs text-stone-400">{allSessions.length} sesiones</p>
          </div>
          <div className="divide-y divide-stone-50 max-h-96 overflow-y-auto">
            {allSessions.map((s) => {
              const fecha = new Date(s.date + 'T12:00:00Z').toLocaleDateString('es-CO', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
              })
              const isToday = s.date === colombiaToday
              const diff = s.difference ?? 0

              return (
                <div key={s.id} className={`px-4 py-3 ${isToday ? 'bg-amber-50' : 'hover:bg-stone-50'} transition-colors`}>
                  <div className="flex items-start justify-between gap-3">
                    {/* Fecha y estado */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-stone-800 capitalize">{fecha}</p>
                        {isToday && (
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">HOY</span>
                        )}
                        {s.status === 'open' ? (
                          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            Abierta
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">
                            Cerrada
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 flex-wrap">
                        <span>🔓 Abre: <span className="font-medium text-stone-700">{formatCurrency(s.opening_amount)}</span></span>
                        {s.closing_amount !== null && (
                          <span>🔒 Cierra: <span className="font-medium text-stone-700">{formatCurrency(s.closing_amount)}</span></span>
                        )}
                      </div>
                      {s.notes && (
                        <p className="text-[11px] text-stone-400 mt-1 italic">{s.notes}</p>
                      )}
                    </div>

                    {/* Diferencia */}
                    {s.status === 'closed' && s.difference !== null && (
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${
                          Math.abs(diff) < 1 ? 'text-emerald-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        </p>
                        <p className="text-[10px] text-stone-400">diferencia</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Error general ────────────────────────────────────────────────────── */}
      {error && error !== 'tabla_no_existe' && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* ── Modales ──────────────────────────────────────────────────────────── */}
      {showAbrir && (
        <AbrirCajaModal
          onConfirm={handleAbrirCaja}
          onClose={() => setShowAbrir(false)}
        />
      )}

      {showCerrar && session && (
        <CerrarCajaModal
          session={session}
          summary={summary}
          onConfirm={handleCerrarCaja}
          onClose={() => setShowCerrar(false)}
        />
      )}

      {showPinBalance && (
        <PinModal
          title="Ver balance acumulado"
          onSuccess={() => {
            setShowPinBalance(false)
            setShowCumulativeBalance(true)
          }}
          onClose={() => setShowPinBalance(false)}
        />
      )}

      {showDetailMethod && (
        <DetalleMetodoModal methodKey={showDetailMethod} onClose={() => setShowDetailMethod(null)} />
      )}
    </div>
  )
}
