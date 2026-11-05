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
  formatColombiaDateTime,
  formatColombiaTime,
} from '@/lib/colombia-time'

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
  cash_expenses: number
  nequi_expenses: number
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
    cash_purchases: 0, nequi_purchases: 0, cash_expenses: 0, nequi_expenses: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showAbrir, setShowAbrir] = useState(false)
  const [showCerrar, setShowCerrar] = useState(false)
  const [error, setError] = useState('')

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
        cash_purchases: 0, nequi_purchases: 0,
        cash_expenses: 0, nequi_expenses: 0,
      }

      // Compras de hoy pagadas en efectivo o Nequi
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('total, payment_method')
        .gte('created_at', todayFrom)
        .lt('created_at', todayTo)
        .eq('status', 'received')
        .in('payment_method', ['cash', 'nequi'])

      for (const p of (purchasesData ?? [])) {
        if (p.payment_method === 'cash') egresosResult.cash_purchases += p.total
        else if (p.payment_method === 'nequi') egresosResult.nequi_purchases += p.total
      }

      // Gastos de hoy pagados en efectivo o Nequi
      await Promise.resolve(
        supabase
          .from('expenses')
          .select('amount, payment_method')
          .eq('date', colombiaToday)
          .in('payment_method', ['cash', 'nequi'])
      ).then(({ data: expData }) => {
        for (const e of (expData ?? [])) {
          if (e.payment_method === 'cash') egresosResult.cash_expenses += e.amount
          else if (e.payment_method === 'nequi') egresosResult.nequi_expenses += e.amount
        }
      }).catch(() => {}) // Si la tabla expenses no existe, ignorar

      setEgresos(egresosResult)
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
              <p className="text-lg font-bold text-stone-800">
                {formatCurrency(session.opening_amount)}
              </p>
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

          {/* Egresos del día */}
          {(egresos.cash_purchases + egresos.nequi_purchases + egresos.cash_expenses + egresos.nequi_expenses) > 0 && (
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
                    <span className="text-stone-500">📱 Gastos por Nequi</span>
                    <span className="font-semibold text-red-600">− {formatCurrency(egresos.nequi_expenses)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-stone-100 pt-2 font-bold">
                  <span className="text-stone-700">Total egresos</span>
                  <span className="text-red-600">
                    − {formatCurrency(
                      egresos.cash_purchases + egresos.nequi_purchases +
                      egresos.cash_expenses + egresos.nequi_expenses
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
    </div>
  )
}
