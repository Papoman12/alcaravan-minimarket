'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

// ─── Tipos ──────────────────────────────────────────────────────────
interface SaleItem {
  id: string
  product_name: string
  product_code?: string
  quantity: number
  unit_price: number
  discount_amount: number
  tax_amount: number
  total: number
}

interface SalePayment {
  id: string
  payment_method: string
  amount: number
  reference?: string
  received_amount?: number
  change_amount: number
  created_at?: string
}

interface Sale {
  id: string
  sale_number: string
  status: 'pending' | 'completed' | 'cancelled' | 'returned' | 'suspended'
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  notes?: string
  created_at: string
  customer_id?: string
  customers?: { id: string; first_name: string; last_name?: string; full_name?: string; phone?: string }
  users?: { full_name?: string }
  sale_items?: SaleItem[]
  sale_payments?: SalePayment[]
  // computed
  paid_amount?: number
  pending_amount?: number
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 Efectivo',
  card_debit: '💳 Débito',
  card_credit: '💳 Crédito',
  transfer: '🏦 Transferencia',
  nequi: '📱 Nequi',
  daviplata: '📱 Daviplata',
  bancolombia: '📱 Bancolombia',
  loyalty_points: '⭐ Puntos',
  credit: '📋 Fiado',
  other: 'Otro',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendiente/Fiado', color: 'bg-orange-100 text-orange-700' },
  completed: { label: 'Completada',      color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelada',       color: 'bg-red-100 text-red-600' },
  returned:  { label: 'Devuelta',        color: 'bg-purple-100 text-purple-700' },
  suspended: { label: 'Suspendida',      color: 'bg-stone-100 text-stone-600' },
}

function getCustomerName(c?: Sale['customers']) {
  if (!c) return 'Sin cliente'
  return c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Sin nombre'
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Modal detalle de venta ──────────────────────────────────────────
function SaleDetailModal({
  sale,
  onClose,
  onAddPayment,
  onEdit,
}: {
  sale: Sale
  onClose: () => void
  onAddPayment: (sale: Sale) => void
  onEdit: (sale: Sale) => void
}) {
  const isPending = sale.status === 'pending'
  const pendingAmount = (sale.pending_amount ?? 0)

  function handlePrint() {
    const w = window.open('', '_blank', 'width=400,height=700')
    if (!w) return
    const items = (sale.sale_items ?? [])
      .map(i => `
        <tr>
          <td style="padding:4px 0;">${i.product_name}</td>
          <td style="text-align:center;padding:4px 4px;">${i.quantity}</td>
          <td style="text-align:right;padding:4px 0;">${formatCurrency(i.unit_price)}</td>
          <td style="text-align:right;padding:4px 0;">${formatCurrency(i.total)}</td>
        </tr>`)
      .join('')
    const payments = (sale.sale_payments ?? [])
      .map(p => `<div style="display:flex;justify-content:space-between;font-size:11px;">
        <span>${PAYMENT_LABELS[p.payment_method] ?? p.payment_method}</span>
        <span>${formatCurrency(p.amount)}</span>
      </div>`)
      .join('')
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <style>
        body{font-family:monospace;font-size:12px;width:80mm;margin:0;padding:8px;}
        h2{text-align:center;margin:4px 0;font-size:16px;}
        .sub{text-align:center;font-size:10px;color:#666;margin-bottom:8px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th{border-bottom:1px dashed #999;padding:4px 0;font-size:10px;text-align:left;}
        th:nth-child(2){text-align:center;}
        th:nth-child(3),th:nth-child(4){text-align:right;}
        hr{border:none;border-top:1px dashed #999;margin:8px 0;}
        .total{font-size:14px;font-weight:bold;display:flex;justify-content:space-between;margin-top:6px;}
      </style>
    </head><body>
      <h2>ALCARAVÁN</h2>
      <div class="sub">Minimarket &amp; Cafetería<br>${formatDate(sale.created_at)}<br><b>${sale.sale_number}</b></div>
      ${sale.customers ? `<div style="font-size:11px;margin-bottom:4px;">Cliente: <b>${getCustomerName(sale.customers)}</b></div>` : ''}
      <table>
        <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Total</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <hr>
      <div style="font-size:11px;">
        <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
        ${sale.discount_amount > 0 ? `<div style="display:flex;justify-content:space-between;color:green;"><span>Descuento</span><span>-${formatCurrency(sale.discount_amount)}</span></div>` : ''}
        ${sale.tax_amount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>IVA</span><span>${formatCurrency(sale.tax_amount)}</span></div>` : ''}
      </div>
      <div class="total"><span>TOTAL</span><span>${formatCurrency(sale.total)}</span></div>
      <hr>
      <div style="font-size:11px;font-weight:bold;margin-bottom:4px;">Pagos:</div>
      ${payments}
      ${isPending ? `<div style="margin-top:8px;padding:6px;border:1px dashed #f90;font-size:11px;color:#c60;text-align:center;"><b>PENDIENTE: ${formatCurrency(pendingAmount)}</b></div>` : ''}
      <div style="text-align:center;margin-top:12px;font-size:10px;color:#999;">¡Gracias por su compra!</div>
    </body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-stone-800 text-lg">{sale.sale_number}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[sale.status]?.color}`}>
                {STATUS_LABELS[sale.status]?.label}
              </span>
            </div>
            <p className="text-stone-500 text-sm mt-0.5">{formatDate(sale.created_at)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500">✕</button>
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Cliente */}
          <div className="flex items-center gap-3 bg-stone-50 rounded-xl p-3">
            <span className="text-2xl">👤</span>
            <div>
              <p className="font-semibold text-stone-800">{getCustomerName(sale.customers)}</p>
              {sale.customers?.phone && <p className="text-xs text-stone-500">📞 {sale.customers.phone}</p>}
            </div>
          </div>

          {/* Monto pendiente (fiado) */}
          {isPending && pendingAmount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-orange-700">Saldo pendiente</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(pendingAmount)}</p>
              </div>
              <button
                onClick={() => onAddPayment(sale)}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                + Registrar pago
              </button>
            </div>
          )}

          {/* Ítems */}
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Productos vendidos</p>
            <div className="space-y-2">
              {(sale.sale_items ?? []).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800 text-sm">{item.product_name}</p>
                    {item.product_code && <p className="text-xs text-stone-400">{item.product_code}</p>}
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-sm text-stone-500">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                    <p className="font-bold text-stone-800">{formatCurrency(item.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="bg-stone-50 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-sm text-stone-600">
              <span>Subtotal</span><span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Descuento</span><span>- {formatCurrency(sale.discount_amount)}</span>
              </div>
            )}
            {sale.tax_amount > 0 && (
              <div className="flex justify-between text-sm text-stone-500">
                <span>IVA</span><span>{formatCurrency(sale.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-stone-800 border-t border-stone-200 pt-2">
              <span>TOTAL</span><span className="text-amber-700">{formatCurrency(sale.total)}</span>
            </div>
          </div>

          {/* Pagos registrados */}
          {(sale.sale_payments ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Pagos registrados</p>
              <div className="space-y-1.5">
                {(sale.sale_payments ?? []).map((p, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-stone-100 last:border-0">
                    <span className="text-sm text-stone-600">{PAYMENT_LABELS[p.payment_method] ?? p.payment_method}</span>
                    <div className="text-right">
                      <span className="font-semibold text-stone-800">{formatCurrency(p.amount)}</span>
                      {p.reference && <p className="text-xs text-stone-400">Ref: {p.reference}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notas */}
          {sale.notes && (
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-xs text-stone-500 font-medium mb-1">Notas</p>
              <p className="text-sm text-stone-700">{sale.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t space-y-2">
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-700 font-medium hover:bg-stone-50 flex items-center justify-center gap-2">
              🖨️ Imprimir
            </button>
            <button onClick={() => onEdit(sale)} className="flex-1 py-2.5 border-2 border-amber-300 rounded-xl text-amber-700 font-semibold hover:bg-amber-50 flex items-center justify-center gap-2">
              ✏️ Editar
            </button>
          </div>
          <button onClick={onClose} className="w-full py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal editar venta ──────────────────────────────────────────────
function EditSaleModal({
  sale,
  onClose,
  onSaved,
}: {
  sale: Sale
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState(sale.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [payments, setPayments] = useState<SalePayment[]>(sale.sale_payments ?? [])
  const [newMethod, setNewMethod] = useState('cash')
  const [newAmount, setNewAmount] = useState('')
  const [newRef, setNewRef] = useState('')
  const [addingPayment, setAddingPayment] = useState(false)

  const METHODS = [
    { key: 'cash',        label: '💵 Efectivo' },
    { key: 'card_debit',  label: '💳 Débito' },
    { key: 'card_credit', label: '💳 Crédito' },
    { key: 'transfer',    label: '🏦 Transferencia' },
    { key: 'nequi',       label: '📱 Nequi' },
    { key: 'daviplata',   label: '📱 Daviplata' },
    { key: 'bancolombia', label: '📱 Bancolombia' },
    { key: 'other',       label: 'Otro' },
  ]

  const totalPagado = payments.reduce((s, p) => s + p.amount, 0)

  async function handleSave() {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('sales')
      .update({ status })
      .eq('id', sale.id)
    if (err) { setError('Error al guardar: ' + err.message); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  async function handleDeletePayment(paymentId: string) {
    const supabase = createClient()
    const { error: err } = await supabase.from('sale_payments').delete().eq('id', paymentId)
    if (!err) setPayments(payments.filter(p => p.id !== paymentId))
    else setError('No se pudo eliminar el pago: ' + err.message)
  }

  async function handleUpdatePaymentMethod(paymentId: string, newMethod: string) {
    const supabase = createClient()
    const { error: err } = await supabase
      .from('sale_payments')
      .update({ payment_method: newMethod })
      .eq('id', paymentId)
    if (!err) setPayments(payments.map(p => p.id === paymentId ? { ...p, payment_method: newMethod } : p))
    else setError('No se pudo actualizar: ' + err.message)
  }

  async function handleAddPayment() {
    const amt = parseFloat(newAmount)
    if (!amt || amt <= 0) return
    setAddingPayment(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('sale_payments')
      .insert({ sale_id: sale.id, payment_method: newMethod, amount: amt, reference: newRef.trim() || null, change_amount: 0 })
      .select()
      .single()
    if (!err && data) {
      setPayments([...payments, data as SalePayment])
      setNewAmount('')
      setNewRef('')
    }
    setAddingPayment(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold text-stone-800 text-lg">Editar venta</h3>
            <p className="text-stone-500 text-sm">{sale.sale_number}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">{error}</div>}

          {/* Estado */}
          <div>
            <p className="text-sm font-semibold text-stone-700 mb-2">Estado de la venta</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'completed', label: '✅ Completada', desc: 'Pago recibido' },
                { key: 'pending',   label: '🕐 Fiado',      desc: 'Pago pendiente' },
                { key: 'cancelled', label: '❌ Cancelada',   desc: 'Anulada' },
                { key: 'returned',  label: '↩️ Devuelta',    desc: 'Devolución' },
              ].map(s => (
                <button key={s.key} onClick={() => setStatus(s.key as Sale['status'])}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${status === s.key ? 'border-amber-700 bg-amber-50' : 'border-stone-200 hover:border-stone-300'}`}>
                  <p className="font-semibold text-sm text-stone-800">{s.label}</p>
                  <p className="text-xs text-stone-500">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Pagos actuales */}
          <div>
            <p className="text-sm font-semibold text-stone-700 mb-2">
              Pagos registrados <span className="font-normal text-stone-400">({formatCurrency(totalPagado)} de {formatCurrency(sale.total)})</span>
            </p>
            {payments.length === 0 ? (
              <p className="text-sm text-stone-400 italic">Sin pagos registrados</p>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="bg-stone-50 rounded-xl px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-800">{formatCurrency(p.amount)}</span>
                      <button onClick={() => handleDeletePayment(p.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
                        🗑️ Eliminar
                      </button>
                    </div>
                    <select
                      value={p.payment_method}
                      onChange={e => handleUpdatePaymentMethod(p.id, e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 bg-white"
                    >
                      {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    {p.reference && <p className="text-xs text-stone-400">Ref: {p.reference}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agregar pago */}
          <div className="bg-stone-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-stone-700">+ Agregar pago</p>
            <div className="grid grid-cols-3 gap-1.5">
              {METHODS.map(m => (
                <button key={m.key} onClick={() => setNewMethod(m.key)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${newMethod === m.key ? 'bg-amber-700 text-white border-amber-700' : 'border-stone-200 text-stone-600 hover:border-amber-300'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)}
                placeholder="Monto" className="flex-1 px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 font-mono" />
              <input type="text" value={newRef} onChange={e => setNewRef(e.target.value)}
                placeholder="Referencia" className="flex-1 px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 text-sm" />
              <button onClick={handleAddPayment} disabled={addingPayment || !newAmount}
                className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300">
                {addingPayment ? '...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300">
            {saving ? 'Guardando...' : '✓ Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal agregar pago a fiado ──────────────────────────────────────
function AddPaymentModal({
  sale,
  onClose,
  onSaved,
}: {
  sale: Sale
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState((sale.pending_amount ?? 0).toString())
  const [method, setMethod] = useState<string>('cash')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const METHODS = [
    { key: 'cash', label: '💵 Efectivo' },
    { key: 'nequi', label: '📱 Nequi' },
    { key: 'daviplata', label: '📱 Daviplata' },
    { key: 'transfer', label: '🏦 Transferencia' },
    { key: 'card_debit', label: '💳 Débito' },
  ]

  async function handleSave() {
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) { setError('Ingresa un monto válido'); return }
    if (amountNum > (sale.pending_amount ?? 0) + 1) { setError(`El monto no puede superar el pendiente de ${formatCurrency(sale.pending_amount ?? 0)}`); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    // Registrar el pago
    const { error: err } = await supabase.from('sale_payments').insert({
      sale_id: sale.id,
      payment_method: method,
      amount: amountNum,
      reference: reference.trim() || null,
      change_amount: 0,
    })
    if (err) { setError('Error al guardar: ' + err.message); setSaving(false); return }

    // Si el pago cubre el total pendiente, marcar venta como completed
    const newPending = (sale.pending_amount ?? 0) - amountNum
    if (newPending <= 0.01) {
      await supabase.from('sales').update({ status: 'completed' }).eq('id', sale.id)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-stone-800 text-lg mb-1">Registrar pago</h3>
        <p className="text-stone-500 text-sm mb-4">
          {sale.sale_number} · Pendiente: <span className="font-semibold text-orange-600">{formatCurrency(sale.pending_amount ?? 0)}</span>
        </p>
        <p className="text-sm font-medium text-stone-700 mb-1">Cliente: <span className="font-semibold">{getCustomerName(sale.customers)}</span></p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm mb-4">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Monto a pagar *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="100" min="100"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700 font-mono text-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Forma de pago</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button key={m.key} onClick={() => setMethod(m.key)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-all ${method === m.key ? 'bg-amber-700 text-white border-amber-700' : 'border-stone-200 text-stone-600 hover:border-amber-300'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {(method === 'transfer' || method === 'nequi' || method === 'daviplata') && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Referencia / Comprobante</label>
              <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="Número de transacción"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300">
            {saving ? 'Guardando...' : '✓ Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────
export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [payingSale, setPayingSale] = useState<Sale | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let q = supabase
      .from('sales')
      .select(`
        id, sale_number, status, subtotal, discount_amount, tax_amount, total,
        notes, created_at, customer_id,
        customers(id, first_name, last_name, full_name, phone),
        users(full_name),
        sale_items(id, product_name, product_code, quantity, unit_price, discount_amount, tax_amount, total),
        sale_payments(id, payment_method, amount, reference, received_amount, change_amount)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')

    const { data } = await q
    const rows: Sale[] = (data ?? []).map((s: any) => {
      const paid = (s.sale_payments ?? []).reduce((acc: number, p: any) => acc + (p.amount ?? 0), 0)
      return { ...s, paid_amount: paid, pending_amount: Math.max(0, s.total - paid) }
    })
    setSales(rows)
    setLoading(false)
  }, [statusFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = sales.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.sale_number.toLowerCase().includes(q) ||
      getCustomerName(s.customers).toLowerCase().includes(q) ||
      (s.customers?.phone ?? '').includes(q)
    )
  })

  const totalFiltered = filtered.reduce((a, s) => a + s.total, 0)
  const pendingTotal  = filtered.filter(s => s.status === 'pending').reduce((a, s) => a + (s.pending_amount ?? 0), 0)

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Ventas</h1>
          <p className="text-stone-500 text-sm mt-0.5">{filtered.length} registros · {formatCurrency(totalFiltered)}</p>
        </div>
        {pendingTotal > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-right">
            <p className="text-xs text-orange-600 font-medium">Fiados pendientes</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(pendingTotal)}</p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4 space-y-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por # venta, cliente o teléfono..."
          className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
        <div className="flex gap-2 flex-wrap">
          {[
            { k: 'all',       l: 'Todas' },
            { k: 'completed', l: '✅ Completadas' },
            { k: 'pending',   l: '🕐 Fiados' },
            { k: 'cancelled', l: '❌ Canceladas' },
          ].map(f => (
            <button key={f.k} onClick={() => setStatusFilter(f.k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${statusFilter === f.k ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              {f.l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-stone-500 mb-1">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-stone-500 mb-1">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700" />
          </div>
          {(dateFrom || dateTo) && (
            <div className="flex items-end">
              <button onClick={() => { setDateFrom(''); setDateTo('') }}
                className="px-3 py-2 rounded-xl text-xs border border-stone-200 text-stone-500 hover:bg-stone-50">
                Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🧾</p>
          <p className="text-stone-500">No hay ventas con estos filtros</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const st = STATUS_LABELS[s.status]
            const isPending = s.status === 'pending'
            return (
              <div key={s.id}
                onClick={() => setSelectedSale(s)}
                className={`bg-white rounded-2xl border p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all ${isPending ? 'border-orange-200' : 'border-stone-200'}`}>
                {/* Icono */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isPending ? 'bg-orange-100' : 'bg-amber-100'}`}>
                  <span className="text-lg">{isPending ? '🕐' : '🧾'}</span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-stone-800 text-sm">{s.sale_number}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st?.color}`}>{st?.label}</span>
                  </div>
                  <p className="text-sm text-stone-600 mt-0.5 truncate">
                    {getCustomerName(s.customers)}
                  </p>
                  <p className="text-xs text-stone-400">{formatDate(s.created_at)}</p>
                </div>
                {/* Monto */}
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-stone-800">{formatCurrency(s.total)}</p>
                  {isPending && (s.pending_amount ?? 0) > 0 && (
                    <p className="text-xs font-semibold text-orange-600">Debe: {formatCurrency(s.pending_amount ?? 0)}</p>
                  )}
                  {!isPending && (
                    <p className="text-xs text-stone-400">{(s.sale_items ?? []).length} ítem(s)</p>
                  )}
                </div>
                {/* Flecha */}
                <span className="text-stone-300 text-lg flex-shrink-0">›</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal detalle */}
      {selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onAddPayment={(sale) => {
            setSelectedSale(null)
            setPayingSale(sale)
          }}
          onEdit={(sale) => {
            setSelectedSale(null)
            setEditingSale(sale)
          }}
        />
      )}

      {/* Modal editar venta */}
      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={() => {
            setEditingSale(null)
            load()
          }}
        />
      )}

      {/* Modal pago fiado */}
      {payingSale && (
        <AddPaymentModal
          sale={payingSale}
          onClose={() => setPayingSale(null)}
          onSaved={() => {
            setPayingSale(null)
            load()
          }}
        />
      )}
    </div>
  )
}
