'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { CashRegister } from '@/types/database'

export default function CajaPage() {
  const supabase = createClient()
  const [openRegister, setOpenRegister] = useState<CashRegister | null>(null)
  const [history, setHistory] = useState<CashRegister[]>([])
  const [movements, setMovements] = useState<{
    id: string; type: string; amount: number; description: string; created_at: string
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [showMovement, setShowMovement] = useState(false)
  const [openingAmount, setOpeningAmount] = useState(0)
  const [openingNotes, setOpeningNotes] = useState('')
  const [actualCash, setActualCash] = useState(0)
  const [closingNotes, setClosingNotes] = useState('')
  const [movType, setMovType] = useState<'income' | 'expense'>('income')
  const [movAmount, setMovAmount] = useState(0)
  const [movDesc, setMovDesc] = useState('')

  async function loadData() {
    setLoading(true)
    const [{ data: open }, { data: hist }, { data: movs }] = await Promise.all([
      supabase
        .from('cash_registers')
        .select('*, cashier:users(full_name)')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('cash_registers')
        .select('*, cashier:users(full_name)')
        .eq('status', 'closed')
        .order('opened_at', { ascending: false })
        .limit(10),
      supabase
        .from('cash_movements')
        .select('id, type, amount, description, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setOpenRegister(open ?? null)
    setHistory(hist ?? [])
    setMovements(movs ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleOpen() {
    const { error } = await supabase.from('cash_registers').insert({
      opening_amount: openingAmount,
      opening_notes: openingNotes || null,
      status: 'open',
    })
    if (!error) {
      await supabase.from('cash_movements').insert({
        type: 'opening',
        amount: openingAmount,
        payment_method: 'cash',
        description: 'Apertura de caja',
      })
      setShowOpen(false)
      setOpeningAmount(0)
      setOpeningNotes('')
      loadData()
    }
  }

  async function handleClose() {
    if (!openRegister) return
    const diff = actualCash - (openRegister.total_cash + openRegister.opening_amount)

    await supabase.from('cash_registers').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      actual_cash: actualCash,
      expected_cash: openRegister.total_cash + openRegister.opening_amount,
      cash_difference: diff,
      closing_notes: closingNotes || null,
    }).eq('id', openRegister.id)

    setShowClose(false)
    setActualCash(0)
    setClosingNotes('')
    loadData()
  }

  async function handleMovement() {
    if (!openRegister || movAmount <= 0 || !movDesc.trim()) return
    await supabase.from('cash_movements').insert({
      cash_register_id: openRegister.id,
      type: movType,
      amount: movAmount,
      payment_method: 'cash',
      description: movDesc,
    })
    setShowMovement(false)
    setMovAmount(0)
    setMovDesc('')
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-3 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Control de Caja</h1>
      </div>

      {/* Estado de caja */}
      {!openRegister ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-stone-300 p-10 text-center mb-6">
          <p className="text-5xl mb-4">💰</p>
          <h2 className="text-xl font-bold text-stone-800 mb-2">No hay caja abierta</h2>
          <p className="text-stone-500 mb-6">Abre la caja para comenzar a registrar ventas</p>
          <button
            onClick={() => setShowOpen(true)}
            className="px-8 py-3 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl transition-colors shadow-lg shadow-amber-700/30"
          >
            Abrir Caja
          </button>
        </div>
      ) : (
        <>
          {/* Caja abierta — estado */}
          <div className="bg-gradient-to-br from-amber-700 to-amber-900 rounded-2xl p-6 text-white mb-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-amber-200 text-sm font-medium">Caja Abierta</p>
                <p className="text-3xl font-bold mt-1">
                  {formatCurrency(openRegister.opening_amount + openRegister.total_sales - openRegister.total_returns)}
                </p>
                <p className="text-amber-300/80 text-sm mt-1">
                  Desde: {formatDateTime(openRegister.opened_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-amber-200 text-sm">Base inicial</p>
                <p className="text-xl font-bold">{formatCurrency(openRegister.opening_amount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/20">
              <div className="text-center">
                <p className="text-amber-200 text-xs">Efectivo</p>
                <p className="text-lg font-bold">{formatCurrency(openRegister.total_cash)}</p>
              </div>
              <div className="text-center">
                <p className="text-amber-200 text-xs">Tarjetas</p>
                <p className="text-lg font-bold">{formatCurrency(openRegister.total_card)}</p>
              </div>
              <div className="text-center">
                <p className="text-amber-200 text-xs">Transferencias</p>
                <p className="text-lg font-bold">{formatCurrency(openRegister.total_transfer + openRegister.total_nequi + openRegister.total_daviplata)}</p>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => { setMovType('income'); setShowMovement(true) }}
              className="flex flex-col items-center gap-2 py-4 bg-white rounded-xl border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all"
            >
              <span className="text-2xl">➕</span>
              <span className="text-sm font-medium text-stone-700">Ingreso</span>
            </button>
            <button
              onClick={() => { setMovType('expense'); setShowMovement(true) }}
              className="flex flex-col items-center gap-2 py-4 bg-white rounded-xl border border-stone-200 hover:border-red-300 hover:bg-red-50 transition-all"
            >
              <span className="text-2xl">➖</span>
              <span className="text-sm font-medium text-stone-700">Egreso</span>
            </button>
            <button
              onClick={() => { setActualCash(openRegister.total_cash + openRegister.opening_amount); setShowClose(true) }}
              className="flex flex-col items-center gap-2 py-4 bg-stone-800 rounded-xl hover:bg-stone-900 transition-all"
            >
              <span className="text-2xl">🔒</span>
              <span className="text-sm font-medium text-white">Cerrar Caja</span>
            </button>
          </div>

          {/* Movimientos del día */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h3 className="font-semibold text-stone-800">Movimientos del Día</h3>
            </div>
            <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto">
              {movements.length === 0 ? (
                <p className="text-center py-8 text-stone-400 text-sm">Sin movimientos registrados</p>
              ) : movements.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-800">{m.description}</p>
                    <p className="text-xs text-stone-400">{formatDateTime(m.created_at)}</p>
                  </div>
                  <span className={`font-bold text-sm tabular-nums ${
                    ['income', 'sale'].includes(m.type) ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {['income', 'sale'].includes(m.type) ? '+' : '-'}
                    {formatCurrency(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Historial de cajas */}
      {history.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h3 className="font-semibold text-stone-800">Historial de Cajas</h3>
          </div>
          <div className="divide-y divide-stone-100">
            {history.map((reg) => (
              <div key={reg.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-stone-800 text-sm">
                    {formatDateTime(reg.opened_at)} → {reg.closed_at ? formatDateTime(reg.closed_at) : '—'}
                  </p>
                  <p className="text-xs text-stone-400">
                    Base: {formatCurrency(reg.opening_amount)} ·
                    Cajero: {(reg as any).cashier?.full_name ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-stone-800">{formatCurrency(reg.total_sales)}</p>
                  {reg.cash_difference !== null && reg.cash_difference !== undefined && (
                    <p className={`text-xs font-medium ${reg.cash_difference < 0 ? 'text-red-600' : reg.cash_difference > 0 ? 'text-emerald-600' : 'text-stone-400'}`}>
                      Diferencia: {reg.cash_difference >= 0 ? '+' : ''}{formatCurrency(reg.cash_difference ?? 0)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal abrir caja */}
      {showOpen && (
        <Modal title="Abrir Caja" onClose={() => setShowOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Base inicial (efectivo)</label>
              <input
                type="number"
                value={openingAmount || ''}
                onChange={(e) => setOpeningAmount(parseFloat(e.target.value) || 0)}
                min="0"
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-lg font-bold text-right focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Notas de apertura</label>
              <textarea
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowOpen(false)} className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium">
                Cancelar
              </button>
              <button onClick={handleOpen} className="flex-1 py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800">
                Abrir Caja
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal cerrar caja */}
      {showClose && openRegister && (
        <Modal title="Cerrar Caja" onClose={() => setShowClose(false)}>
          <div className="space-y-4">
            <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-600">Ventas del día</span>
                <span className="font-bold">{formatCurrency(openRegister.total_sales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Efectivo esperado</span>
                <span className="font-bold">{formatCurrency(openRegister.opening_amount + openRegister.total_cash)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Efectivo real contado</label>
              <input
                type="number"
                value={actualCash || ''}
                onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
                min="0"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-lg font-bold text-right focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
            {actualCash > 0 && (
              <div className={`rounded-xl p-3 text-sm font-medium text-center ${
                actualCash - (openRegister.opening_amount + openRegister.total_cash) < 0
                  ? 'bg-red-50 text-red-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}>
                Diferencia: {formatCurrency(actualCash - (openRegister.opening_amount + openRegister.total_cash))}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Notas de cierre</label>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowClose(false)} className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium">
                Cancelar
              </button>
              <button onClick={handleClose} className="flex-1 py-3 rounded-xl bg-stone-800 text-white font-bold hover:bg-stone-900">
                Cerrar Caja
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal movimiento */}
      {showMovement && (
        <Modal
          title={movType === 'income' ? '➕ Registrar Ingreso' : '➖ Registrar Egreso'}
          onClose={() => setShowMovement(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Monto</label>
              <input
                type="number"
                value={movAmount || ''}
                onChange={(e) => setMovAmount(parseFloat(e.target.value) || 0)}
                min="0"
                placeholder="0"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-lg font-bold text-right focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Descripción *</label>
              <input
                type="text"
                value={movDesc}
                onChange={(e) => setMovDesc(e.target.value)}
                placeholder="Motivo del movimiento..."
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowMovement(false)} className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium">
                Cancelar
              </button>
              <button
                onClick={handleMovement}
                disabled={movAmount <= 0 || !movDesc.trim()}
                className={`flex-1 py-3 rounded-xl text-white font-bold disabled:bg-stone-300 transition-colors ${
                  movType === 'income' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Registrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-stone-800">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
