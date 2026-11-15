'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import type { Product, Customer, CartPayment, PaymentMethod, CartItem } from '@/types/database'

// ─── Datos del recibo ────────────────────────────────────────────────
interface ReceiptData {
  saleNumber: string
  date: Date
  items: {
    product_name: string
    quantity: number
    unit_price: number
    total: number
  }[]
  subtotal: number
  discount: number
  tax: number
  total: number
  cardCommission?: number
  payments: CartPayment[]
  customerName?: string
  notes?: string
}

// ─── Componente: Recibo / Ticket ─────────────────────────────────────
function ReceiptModal({ receipt, onClose }: { receipt: ReceiptData; onClose: () => void }) {
  const cashPayment = receipt.payments.find((p) => p.method === 'cash')
  const change = cashPayment?.received
    ? cashPayment.received - cashPayment.amount
    : 0

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

  function handlePrint() {
    const cashPay   = receipt.payments.find((p) => p.method === 'cash')
    const changeAmt = cashPay?.received ? cashPay.received - cashPay.amount : 0
    const dateStr   = receipt.date.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
    const timeStr   = receipt.date.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })

    const itemsHtml = receipt.items.map(i => {
      const det = i.quantity > 1
        ? `<div class="idet">${i.quantity} x ${formatCurrency(i.unit_price)}<span>${formatCurrency(i.total)}</span></div>`
        : `<div class="idet"><span></span><span>${formatCurrency(i.total)}</span></div>`
      return `<div class="item"><div class="iname">${i.product_name}</div>${det}</div>`
    }).join('')

    const paymentsHtml = receipt.payments.map(p =>
      `<div class="row"><span>${PAYMENT_LABELS[p.method] ?? p.method}</span><span>${formatCurrency(p.amount)}</span></div>`
    ).join('')

    // ─── Estrategia definitiva para térmica ──────────────────────────────
    // 1. Renderizar el ticket en un iframe oculto con body.width = 80mm
    // 2. Medir scrollHeight real del cuerpo
    // 3. Convertir a mm y fijar @page { size: 80mm Xmm }   ← altura EXACTA
    // 4. Imprimir desde el iframe (window.print en iframe funciona con @page)
    // Chrome ignora @page auto en ventana principal; respeta medida fija en iframe.
    // ─────────────────────────────────────────────────────────────────────

    const rcptHtml = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Courier New',Courier,monospace;font-size:11px;width:80mm;padding:2mm 2mm 50mm;color:#000;line-height:1.3}
.c{text-align:center}
.store{font-size:17px;font-weight:900;letter-spacing:2px;padding:3px 0 1px}
.sub{font-size:9px;letter-spacing:1px;color:#444}
.sep{border:none;border-top:1px dashed #555;margin:3px 0}
.sep2{border:none;border-top:2px solid #000;margin:3px 0}
.meta{font-size:9px;color:#555}
.item{padding:2px 0}
.iname{font-size:10px;font-weight:bold;word-break:break-word}
.idet{display:flex;justify-content:space-between;font-size:9px;color:#444;padding-left:4px}
.row{display:flex;justify-content:space-between;font-size:10px;padding:1px 0}
.muted{color:#666}
.big{display:flex;justify-content:space-between;font-size:14px;font-weight:900;padding:2px 0}
.cam{display:flex;justify-content:space-between;font-size:12px;font-weight:bold;background:#000;color:#fff;padding:2px 4px;margin:2px 0}
.foot{font-size:9px;color:#666;padding:2px 0}
</style>
</head><body>
<div class="c">
  <div class="store">ALCARAVÁN</div>
  <div class="sub">MINIMARKET &amp; CAFÉ</div>
  <hr class="sep">
  <div class="meta">${dateStr} ${timeStr} &nbsp; <b>${receipt.saleNumber}</b></div>
  ${receipt.customerName ? `<div class="meta">Cliente: <b>${receipt.customerName}</b></div>` : ''}
</div>
<hr class="sep">
${itemsHtml}
<hr class="sep">
${(receipt.subtotal !== receipt.total || receipt.discount > 0 || receipt.tax > 0) ? `<div class="row muted"><span>Subtotal</span><span>${formatCurrency(receipt.subtotal)}</span></div>` : ''}
${receipt.discount > 0 ? `<div class="row muted"><span>Descuento</span><span>-${formatCurrency(receipt.discount)}</span></div>` : ''}
${receipt.tax > 0 ? `<div class="row muted"><span>IVA</span><span>${formatCurrency(receipt.tax)}</span></div>` : ''}
${(receipt.cardCommission && receipt.cardCommission > 0) ? `<div class="row muted"><span>Comisión tarjeta 2.5%</span><span>+${formatCurrency(receipt.cardCommission)}</span></div>` : ''}
<hr class="sep2">
<div class="big"><span>TOTAL</span><span>${formatCurrency(receipt.total + (receipt.cardCommission ?? 0))}</span></div>
<hr class="sep">
${paymentsHtml}
${(cashPay?.received && cashPay.received > 0) ? `<div class="row muted"><span>Recibido</span><span>${formatCurrency(cashPay.received)}</span></div>` : ''}
${changeAmt > 0 ? `<div class="cam"><span>CAMBIO</span><span>${formatCurrency(changeAmt)}</span></div>` : ''}
${receipt.notes ? `<hr class="sep"><div class="c meta">${receipt.notes}</div>` : ''}
<hr class="sep">
<div class="c foot">¡Gracias por su compra! — Alcaraván</div>
</body></html>`

    // Crear iframe EN el viewport pero invisible (off-screen impide el layout en algunos navegadores)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('id', '__thermal_iframe__')
    // opacity:0 lo hace invisible; z-index:-1 lo manda al fondo; sigue en el viewport → el browser sí lo renderiza
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:302px;height:800px;border:none;opacity:0;pointer-events:none;z-index:-1;'
    document.body.appendChild(iframe)

    const iframeDoc = iframe.contentDocument!
    iframeDoc.open()
    iframeDoc.write(rcptHtml)
    iframeDoc.close()

    // 800ms: tiempo suficiente para que Courier New cargue y el layout se calcule
    setTimeout(() => {
      // Usar 297mm fijo (el papel configurado en Windows).
      // La impresora térmica tiene corte automático: corta después del último
      // carácter impreso sin importar que el "papel" tenga 297mm de largo.
      // No calcular altura dinámica — ninguna medición de pantalla es exacta
      // para el motor de impresión de Chrome, y causa cortes en medio del ticket.
      const pgStyle = iframeDoc.createElement('style')
      pgStyle.textContent = `@page { size: 80mm 297mm; margin: 0; }`
      iframeDoc.head.appendChild(pgStyle)

      const iframeWin = iframe.contentWindow!
      iframeWin.focus()
      iframeWin.print()

      const removeIframe = () => {
        const el = document.getElementById('__thermal_iframe__')
        if (el) document.body.removeChild(el)
        try { iframeWin.onafterprint = null } catch(_) {}
      }
      iframeWin.onafterprint = removeIframe
      setTimeout(removeIframe, 5000)
    }, 800)
  }

  return (
    <>
      {/* Estilos de impresión: oculta todo excepto el ticket */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-receipt {
            display: block !important;
            position: fixed !important;
            top: 0; left: 0;
            width: 80mm;
            font-size: 12px;
            font-family: monospace;
            color: #000;
            background: #fff;
            z-index: 9999;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
          {/* Encabezado modal */}
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between no-print">
            <div>
              <h3 className="font-bold text-stone-800 text-lg">✅ Venta registrada</h3>
              <p className="text-stone-500 text-sm">{receipt.saleNumber}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Ticket imprimible — preview */}
          <div className="print-receipt flex-1 overflow-y-auto bg-stone-50">
            {/* Papel del ticket */}
            <div className="mx-auto max-w-[280px] bg-white shadow-sm font-mono text-[11px] leading-relaxed py-4 px-3">

              {/* Cabecera */}
              <div className="text-center pb-3 border-b border-dashed border-stone-300">
                <p className="font-black text-xl tracking-[4px] text-stone-900">ALCARAVÁN</p>
                <p className="text-[10px] text-stone-500 tracking-widest mt-0.5">♦ MINIMARKET &amp; CAFÉ ♦</p>
                <div className="mt-2 text-[10px] text-stone-500 space-y-0.5">
                  <p>
                    {receipt.date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}
                    {receipt.date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="font-bold text-stone-700">{receipt.saleNumber}</p>
                  {receipt.customerName && (
                    <p>Cliente: <span className="font-semibold text-stone-700">{receipt.customerName}</span></p>
                  )}
                </div>
              </div>

              {/* Ítems */}
              <div className="py-2.5 space-y-2 border-b border-dashed border-stone-300">
                {receipt.items.map((item, i) => (
                  <div key={i}>
                    <p className="font-bold text-stone-800 leading-tight">{item.product_name}</p>
                    <div className="flex justify-between text-stone-500 pl-2 text-[10px]">
                      {item.quantity > 1
                        ? <span>{item.quantity} × {formatCurrency(item.unit_price)}</span>
                        : <span />
                      }
                      <span className="font-semibold text-stone-700">{formatCurrency(item.total)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div className="py-2 space-y-1">
                {(receipt.subtotal !== receipt.total || receipt.discount > 0 || receipt.tax > 0) && (
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal</span><span>{formatCurrency(receipt.subtotal)}</span>
                  </div>
                )}
                {receipt.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Descuento</span><span>− {formatCurrency(receipt.discount)}</span>
                  </div>
                )}
                {receipt.tax > 0 && (
                  <div className="flex justify-between text-stone-500">
                    <span>IVA</span><span>{formatCurrency(receipt.tax)}</span>
                  </div>
                )}
                {!!receipt.cardCommission && receipt.cardCommission > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Comisión tarjeta (2.5%)</span>
                    <span>+ {formatCurrency(receipt.cardCommission)}</span>
                  </div>
                )}
              </div>

              {/* TOTAL */}
              <div className="border-t-2 border-stone-800 pt-1.5 pb-2">
                <div className="flex justify-between font-black text-base text-stone-900">
                  <span>TOTAL</span>
                  <span>{formatCurrency(receipt.total + (receipt.cardCommission ?? 0))}</span>
                </div>
              </div>

              {/* Pagos */}
              <div className="border-t border-dashed border-stone-300 pt-2 pb-1 space-y-1">
                {receipt.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-stone-600">
                    <span>{PAYMENT_LABELS[p.method] ?? p.method}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
                {cashPayment?.received && cashPayment.received > 0 && (
                  <div className="flex justify-between text-stone-500">
                    <span>Recibido</span><span>{formatCurrency(cashPayment.received)}</span>
                  </div>
                )}
                {change > 0 && (
                  <div className="flex justify-between font-bold text-white bg-stone-800 px-2 py-1 mt-1 rounded">
                    <span>✓ CAMBIO</span><span>{formatCurrency(change)}</span>
                  </div>
                )}
              </div>

              {/* Notas */}
              {receipt.notes && (
                <div className="border-t border-dashed border-stone-300 pt-2 mt-1">
                  <p className="text-[10px] text-stone-400 text-center">{receipt.notes}</p>
                </div>
              )}

              {/* Pie */}
              <div className="border-t border-dashed border-stone-300 mt-2 pt-2 text-center space-y-0.5">
                <p className="text-xs font-semibold text-stone-700">★ ¡Gracias por su compra! ★</p>
                <p className="text-[10px] text-stone-400">Vuelva pronto — Alcaraván</p>
              </div>

            </div>
          </div>

          {/* Botones */}
          <div className="px-4 pb-4 pt-2 flex gap-3 no-print">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-medium transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 transition-colors shadow-lg shadow-amber-700/25"
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Componente: Buscador de cliente ────────────────────────────────
function CustomerSearch({
  onSelect,
  onClose,
}: {
  onSelect: (c: Customer) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('customers')
        .select('id, first_name, last_name, full_name, phone, document_number, loyalty_points')
        .eq('is_active', true)
        .or(`full_name.ilike.%${query}%,first_name.ilike.%${query}%,phone.ilike.%${query}%,document_number.ilike.%${query}%`)
        .order('first_name')
        .limit(10)
      setResults((data ?? []).map((c: any) => ({
        ...c,
        name: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' '),
      })))
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-sm shadow-2xl">
        <div className="px-4 py-3 border-b flex items-center gap-3">
          <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Nombre, teléfono o documento..."
            className="flex-1 outline-none text-stone-800 placeholder:text-stone-400 text-sm" />
          {loading && <span className="w-4 h-4 border-2 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />}
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-lg">✕</button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {results.length === 0 && query.length >= 2 && !loading && (
            <p className="text-center text-stone-400 text-sm py-8">No se encontraron clientes</p>
          )}
          {results.map(c => (
            <button key={c.id} onClick={() => { onSelect(c); onClose() }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors text-left border-b border-stone-50 last:border-0">
              <div>
                <p className="font-medium text-stone-800 text-sm">{(c as any).name}</p>
                {c.phone && <p className="text-xs text-stone-400">📞 {c.phone}</p>}
              </div>
              {(c.loyalty_points ?? 0) > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⭐ {c.loyalty_points}</span>
              )}
            </button>
          ))}
        </div>
        <div className="p-3 border-t">
          <p className="text-xs text-stone-400 text-center">Escribe para buscar clientes</p>
        </div>
      </div>
    </div>
  )
}

// ─── Componente: Buscador de productos ──────────────────────────────
function ProductSearch({
  onSelect,
  inputRef,
}: {
  onSelect: (product: Product) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    // Detectar si es un código de barras (solo números, > 6 dígitos): buscar inmediatamente
    const isBarcode = /^\d{6,}$/.test(query.trim())
    const delay = isBarcode ? 0 : 250

    const timer = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(name), unit:units_of_measure(abbreviation)')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,barcode.eq.${query},code.ilike.%${query}%`)
        .order('name')
        .limit(12)

      const results = data ?? []
      setResults(results)
      setLoading(false)

      // Si es código de barras y hay exactamente un resultado: agregar automáticamente
      if (isBarcode && results.length === 1) {
        onSelect(results[0])
        setQuery('')
        setResults([])
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white rounded-2xl border-2 border-amber-700 px-4 py-3 shadow-sm">
        <span className="text-stone-400 text-lg">🔍</span>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) {
              onSelect(results[0])
              setQuery('')
              setResults([])
            }
          }}
          placeholder="Buscar producto o escanear código de barras..."
          className="flex-1 outline-none text-stone-800 placeholder:text-stone-400 text-sm"
          autoFocus
        />
        {loading && <span className="w-4 h-4 border-2 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />}
        {query && (
          <button onClick={() => setQuery('')} className="text-stone-400 hover:text-stone-600">✕</button>
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-stone-200 shadow-xl z-20 max-h-64 overflow-y-auto">
          {results.map((product) => (
            <button
              key={product.id}
              onClick={() => {
                onSelect(product)
                setQuery('')
                setResults([])
              }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors text-left border-b border-stone-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800 text-sm truncate">{product.name}</p>
                <p className="text-xs text-stone-400">
                  {product.code ?? product.barcode ?? 'Sin código'} ·{' '}
                  {(product as any).category?.name ?? 'Sin categoría'}
                </p>
              </div>
              <div className="text-right ml-3 flex-shrink-0">
                <p className="font-bold text-amber-700">{formatCurrency(product.sale_price)}</p>
                <p className={`text-[10px] ${product.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  Stock: {product.stock}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Componente: ítem del carrito ────────────────────────────────────
function CartItemRow({
  item,
  onQuantityChange,
  onRemove,
  onDiscountChange,
}: {
  item: CartItem
  onQuantityChange: (qty: number) => void
  onRemove: () => void
  onDiscountChange: (d: number) => void
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-stone-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-stone-800 text-sm leading-snug">{item.product.name}</p>
        <p className="text-xs text-stone-500 mt-0.5">{formatCurrency(item.unit_price)} c/u</p>
      </div>

      {/* Controles de cantidad */}
      <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
        <button
          onClick={() => onQuantityChange(item.quantity - 1)}
          className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600 font-bold hover:bg-stone-50 active:scale-95 transition-all"
        >
          −
        </button>
        <span className="w-8 text-center font-bold text-stone-800 text-sm tabular-nums">
          {item.quantity}
        </span>
        <button
          onClick={() => onQuantityChange(item.quantity + 1)}
          className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600 font-bold hover:bg-stone-50 active:scale-95 transition-all"
        >
          +
        </button>
      </div>

      <div className="text-right min-w-[72px]">
        <p className="font-bold text-stone-800 text-sm">{formatCurrency(item.total)}</p>
      </div>

      <button
        onClick={onRemove}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}

// ─── Modal de pago ───────────────────────────────────────────────────
function PaymentModal({
  total,
  hasCustomer,
  onClose,
  onConfirm,
  onConfirmFiado,
}: {
  total: number
  hasCustomer: boolean
  onClose: () => void
  onConfirm: (payments: CartPayment[], cardCommission: number) => void
  onConfirmFiado: () => void
}) {
  const [payments, setPayments] = useState<CartPayment[]>([])
  const [processing, setProcessing] = useState(false)

  const CARD_METHODS: PaymentMethod[] = ['card_debit', 'card_credit']
  const CARD_COMMISSION_RATE = 0.025

  const METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
    { key: 'cash',        label: 'Efectivo',       icon: '💵' },
    { key: 'card_debit',  label: 'Débito',          icon: '💳' },
    { key: 'card_credit', label: 'Crédito',         icon: '💳' },
    { key: 'transfer',    label: 'Transferencia',   icon: '🏦' },
    { key: 'nequi',       label: 'Nequi',           icon: '📱' },
    { key: 'daviplata',   label: 'Daviplata',       icon: '📱' },
    { key: 'bancolombia', label: 'Bancolombia',     icon: '🏦' },
    { key: 'other',       label: 'Otro',            icon: '💰' },
  ]

  // ─── Cálculos ───────────────────────────────────────────────────────
  // Los inputs representan la PORCIÓN DEL PRODUCTO (sin comisión).
  // La comisión se calcula sobre esa porción y se cobra APARTE al cliente.
  const paidTotal   = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const remaining   = total - paidTotal                           // faltante en valor producto
  const cardProductTotal = payments
    .filter(p => CARD_METHODS.includes(p.method))
    .reduce((s, p) => s + (p.amount || 0), 0)
  const cardCommission   = Math.round(cardProductTotal * CARD_COMMISSION_RATE)
  const effectiveTotal   = total + cardCommission                 // lo que el cliente paga en total
  const cashPay = payments.find(p => p.method === 'cash')
  const change  = cashPay?.received && cashPay.received > cashPay.amount
    ? cashPay.received - cashPay.amount
    : 0

  // ─── Acciones ───────────────────────────────────────────────────────
  function toggleMethod(key: PaymentMethod) {
    const idx = payments.findIndex(p => p.method === key)
    if (idx >= 0) {
      // Quitar: solo si hay más de uno
      if (payments.length === 1) return
      setPayments(payments.filter((_, i) => i !== idx))
    } else {
      // Agregar: si es el primero llena con el total, si no con lo que falta
      const fill = payments.length === 0 ? total : Math.max(0, remaining)
      setPayments([...payments, { method: key, amount: fill }])
    }
  }

  function updateAmount(idx: number, value: number) {
    setPayments(payments.map((p, i) => i === idx ? { ...p, amount: value } : p))
  }

  function updateReceived(idx: number, value: number) {
    setPayments(payments.map((p, i) => i === idx ? { ...p, received: value } : p))
  }

  const isActive = (key: PaymentMethod) => payments.some(p => p.method === key)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

        {/* Encabezado */}
        <div className="px-6 py-5 border-b border-stone-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-stone-800">Registrar Pago</h3>
              <p className="text-3xl font-bold text-amber-700 mt-0.5">{formatCurrency(effectiveTotal)}</p>
              {cardCommission > 0 && (
                <p className="text-xs text-orange-500 mt-0.5">
                  Productos {formatCurrency(total)} + comisión tarjeta {formatCurrency(cardCommission)}
                </p>
              )}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 mt-1">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Sin método seleccionado: aviso ── */}
          {payments.length === 0 && (
            <p className="text-center text-sm text-stone-400 py-1">Selecciona un método de pago</p>
          )}

          {/* ── Métodos activos con sus montos ── */}
          <div className="space-y-3">
            {payments.map((p, i) => {
              const meta = METHODS.find(m => m.key === p.method)!
              const isCard = CARD_METHODS.includes(p.method)
              const terminalAmount = isCard ? Math.round(p.amount * (1 + CARD_COMMISSION_RATE)) : 0
              return (
                <div key={p.method} className="rounded-xl border border-stone-200 p-3 space-y-2 bg-stone-50">
                  {/* Fila título + quitar */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
                      <span>{meta.icon}</span> {meta.label}
                      {isCard && <span className="text-[10px] text-orange-500 font-medium bg-orange-50 px-1.5 py-0.5 rounded-full">+2.5%</span>}
                    </span>
                    {payments.length > 1 && (
                      <button
                        onClick={() => toggleMethod(p.method)}
                        className="text-xs text-stone-400 hover:text-red-500 transition-colors px-1"
                      >✕ quitar</button>
                    )}
                  </div>

                  {/* Monto */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500 w-20">{isCard ? 'Porción producto' : 'Monto'}</span>
                    <input
                      type="number"
                      value={p.amount || ''}
                      onChange={(e) => updateAmount(i, parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-right font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700 bg-white"
                      placeholder="0"
                    />
                  </div>

                  {/* Info terminal para tarjeta */}
                  {isCard && p.amount > 0 && (
                    <p className="text-xs text-orange-600 text-right">
                      💳 Cobrar en datáfono: <strong>{formatCurrency(terminalAmount)}</strong>
                      <span className="text-stone-400"> (incluye comisión {formatCurrency(terminalAmount - p.amount)})</span>
                    </p>
                  )}

                  {/* Recibido + cambio para efectivo */}
                  {p.method === 'cash' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-500 w-20">Recibido</span>
                      <input
                        type="number"
                        value={p.received || ''}
                        onChange={(e) => updateReceived(i, parseFloat(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-right text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700 bg-white"
                        placeholder={formatCurrency(p.amount || total)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Selección de método ── */}
          {payments.length < METHODS.length && (
            <div>
              <p className="text-xs font-medium text-stone-500 mb-2">
                {payments.length === 0 ? 'Método de pago' : '+ Agregar otro método'}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {METHODS.filter(m => !isActive(m.key)).map(m => (
                  <button
                    key={m.key}
                    onClick={() => toggleMethod(m.key)}
                    className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border-2 transition-all text-center ${
                      payments.length === 0
                        ? 'border-stone-300 hover:border-amber-600 hover:bg-amber-50 bg-white shadow-sm'
                        : 'border-dashed border-stone-200 hover:border-amber-500 hover:bg-amber-50'
                    }`}
                  >
                    <span className="text-base">{m.icon}</span>
                    <span className="text-[10px] font-medium text-stone-600 leading-tight">{m.label}</span>
                    {CARD_METHODS.includes(m.key) && (
                      <span className="text-[9px] text-orange-400 leading-tight">+2.5%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Resumen ── */}
          <div className="bg-stone-50 rounded-xl p-4 space-y-1.5 text-sm border border-stone-100">
            <div className="flex justify-between text-stone-600">
              <span>Valor productos</span>
              <span className="font-bold text-stone-800">{formatCurrency(total)}</span>
            </div>
            {cardCommission > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Comisión tarjeta (2.5%)</span>
                <span>+ {formatCurrency(cardCommission)}</span>
              </div>
            )}
            {cardCommission > 0 && (
              <div className="flex justify-between font-bold text-stone-800 border-t border-stone-200 pt-1.5">
                <span>Total a cobrar</span>
                <span>{formatCurrency(effectiveTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-600 border-t border-stone-100 pt-1.5">
              <span>Total ingresado</span>
              <span className="font-bold text-stone-800">{formatCurrency(paidTotal)}</span>
            </div>
            {remaining > 0.5 && (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Faltante</span>
                <span>{formatCurrency(remaining)}</span>
              </div>
            )}
            {change > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold border-t border-stone-200 pt-1.5">
                <span>Cambio a devolver</span>
                <span>{formatCurrency(change)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 space-y-2">
          {/* Botón Fiado */}
          {hasCustomer && (
            <button
              onClick={async () => { setProcessing(true); await onConfirmFiado(); setProcessing(false) }}
              disabled={processing}
              className="w-full py-2.5 rounded-xl border-2 border-orange-400 text-orange-600 font-semibold hover:bg-orange-50 transition-colors text-sm"
            >
              📋 Registrar como Fiado (pago pendiente)
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                setProcessing(true)
                await onConfirm(payments, cardCommission)
                setProcessing(false)
              }}
              disabled={payments.length === 0 || remaining > 0.5 || processing}
              className="flex-1 py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors shadow-lg shadow-amber-700/30"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Procesando...
                </span>
              ) : (
                '✓ Confirmar Venta'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── POS PRINCIPAL ───────────────────────────────────────────────────
export default function POSPage() {
  const supabase = createClient()
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    items,
    customer,
    notes,
    suspended_carts,
    addItem,
    removeItem,
    updateQuantity,
    setCustomer,
    setNotes,
    clearCart,
    suspendCart,
    recoverCart,
    deleteCart,
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotal,
    getItemCount,
  } = useCartStore()

  const [showPayment, setShowPayment] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [saleReceipt, setSaleReceipt] = useState<ReceiptData | null>(null)
  const [saleError, setSaleError] = useState('')

  // Foco automático en el buscador
  useEffect(() => {
    searchRef.current?.focus()
  }, [showPayment])

  // Atajos de teclado
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F10') { e.preventDefault(); if (items.length > 0) setShowPayment(true) }
      if (e.key === 'Escape') { setShowPayment(false) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [items])

  async function handleConfirmFiado() {
    if (!customer) return
    await handleConfirmSale([], 0, true)
  }

  async function handleConfirmSale(payments: CartPayment[], cardCommission = 0, isFiado = false) {
    try {
      setSaleError('')

      // Capturar los datos del carrito ANTES de limpiar
      const cartItems = [...items]
      const cartSubtotal = getSubtotal()
      const cartDiscount = getDiscountAmount()
      const cartTax = getTaxAmount()
      const cartTotal = getTotal()
      const cartCustomer = customer
      const cartNotes = notes

      // Crear número de venta
      const saleNumber = 'V' + Date.now().toString().slice(-8)

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          sale_number: saleNumber,
          customer_id: cartCustomer?.id ?? null,
          subtotal: cartSubtotal,
          discount_amount: cartDiscount,
          tax_amount: cartTax,
          total: cartTotal,
          status: isFiado ? 'pending' : 'completed',
          notes: cartNotes || null,
        })
        .select()
        .single()

      if (saleError || !sale) throw saleError ?? new Error('Error al crear venta')

      // Insertar ítems
      const saleItems = cartItems.map((i) => ({
        sale_id: sale.id,
        product_id: i.product.id,
        product_name: i.product.name,
        product_code: i.product.code,
        quantity: i.quantity,
        unit_price: i.unit_price,
        purchase_price: i.product.purchase_price,
        discount_percentage: i.discount_percentage,
        discount_amount: i.discount_amount,
        tax_rate: i.product.iva_rate,
        tax_amount: (i.total * i.product.iva_rate) / 100,
        subtotal: i.subtotal,
        total: i.total,
        notes: i.notes ?? null,
      }))

      await supabase.from('sale_items').insert(saleItems)

      // Insertar pagos
      const salePayments = payments.map((p) => ({
        sale_id: sale.id,
        payment_method: p.method,
        amount: p.amount,
        reference: p.reference ?? null,
        received_amount: p.received ?? null,
        change_amount: p.change ?? 0,
      }))

      await supabase.from('sale_payments').insert(salePayments)

      // Limpiar carrito
      clearCart()
      setShowPayment(false)

      // Preparar y mostrar recibo
      setSaleReceipt({
        saleNumber,
        date: new Date(),
        items: cartItems.map((i) => ({
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
        })),
        subtotal: cartSubtotal,
        discount: cartDiscount,
        tax: cartTax,
        total: cartTotal,
        cardCommission: cardCommission > 0 ? cardCommission : undefined,
        payments,
        customerName: cartCustomer
          ? (cartCustomer.full_name || [cartCustomer.first_name, cartCustomer.last_name].filter(Boolean).join(' '))
          : undefined,
        notes: cartNotes,
      })
    } catch (err) {
      console.error(err)
      setSaleError('Error al registrar la venta. Intenta de nuevo.')
    }
  }

  const subtotal = getSubtotal()
  const discount = getDiscountAmount()
  const tax = getTaxAmount()
  const total = getTotal()
  const itemCount = getItemCount()

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-stone-100">
      {/* ─── Panel izquierdo: productos ─────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Buscador */}
        <div className="p-3 bg-white border-b border-stone-200">
          <ProductSearch onSelect={addItem} inputRef={searchRef} />
          <p className="text-[10px] text-stone-400 mt-1.5 pl-1">
            F2: enfocar búsqueda · F10: cobrar · Esc: cancelar pago
          </p>
        </div>

        {/* Grilla de productos destacados */}
        <div className="flex-1 overflow-y-auto p-3">
          <FeaturedProducts onSelect={addItem} />
        </div>

        {/* Ventas suspendidas */}
        {suspended_carts.length > 0 && (
          <div className="px-3 pb-3">
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 mb-2">
                🕐 {suspended_carts.length} venta(s) en espera
              </p>
              <div className="space-y-2">
                {suspended_carts.map((sc) => {
                  const clienteNombre = sc.customer
                    ? ((sc.customer as any).full_name || (sc.customer as any).first_name || 'Cliente') as string
                    : null
                  const hora = new Date(sc.suspended_at).toLocaleTimeString('es-CO', {
                    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit',
                  })
                  const totalSuspendido = sc.items.reduce((s, i) => s + i.total, 0)
                  return (
                    <div key={sc.id} className="flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-2 py-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-stone-700 leading-tight">
                          {sc.label || (clienteNombre ? `👤 ${clienteNombre}` : `${sc.items.length} ítem(s)`)}
                        </p>
                        <p className="text-xs text-stone-400">
                          {hora} · {formatCurrency(totalSuspendido)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => recoverCart(sc.id)}
                          className="text-xs px-2 py-1 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors whitespace-nowrap font-medium"
                        >
                          ▶ Retomar
                        </button>
                        <button
                          onClick={() => deleteCart(sc.id)}
                          className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors whitespace-nowrap font-medium"
                          title="Eliminar venta suspendida"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Panel derecho: carrito ──────────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col bg-white border-l border-stone-200 shadow-xl">
        {/* Encabezado carrito */}
        <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-800">Carrito</h3>
            {items.length > 0 && (
              <button
                onClick={() => suspendCart()}
                className="text-xs px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
              >
                ⏸ Suspender
              </button>
            )}
          </div>
          {/* Selector de cliente */}
          {customer ? (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <span className="text-sm">👤</span>
              <p className="flex-1 text-xs font-medium text-amber-800 truncate">
                {customer.full_name || [customer.first_name, customer.last_name].filter(Boolean).join(' ')}
              </p>
              <button onClick={() => setCustomer(null)} className="text-amber-400 hover:text-amber-700 text-sm">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomerSearch(true)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-dashed border-stone-300 text-stone-500 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50 transition-all"
            >
              👤 Agregar cliente (opcional)
            </button>
          )}
        </div>

        {/* Ítems */}
        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <span className="text-5xl mb-3">🛒</span>
              <p className="text-stone-400 font-medium">Carrito vacío</p>
              <p className="text-stone-300 text-sm mt-1">Busca o escanea un producto</p>
            </div>
          ) : (
            <div>
              {items.map((item) => (
                <CartItemRow
                  key={item.product.id}
                  item={item}
                  onQuantityChange={(q) => updateQuantity(item.product.id, q)}
                  onRemove={() => removeItem(item.product.id)}
                  onDiscountChange={(d) => useCartStore.getState().updateItemDiscount(item.product.id, d)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Totales */}
        <div className="border-t border-stone-200 px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-sm text-stone-600">
            <span>Subtotal ({itemCount} ítem{itemCount !== 1 ? 's' : ''})</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Descuento</span>
              <span>- {formatCurrency(discount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-sm text-stone-500">
              <span>IVA</span>
              <span>{formatCurrency(tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-stone-800 border-t border-stone-200 pt-2 mt-2">
            <span>TOTAL</span>
            <span className="text-amber-700">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Error */}
        {saleError && (
          <div className="mx-4 mb-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">
            {saleError}
          </div>
        )}

        {/* Botón cobrar */}
        <div className="px-4 pb-4 pt-2">
          <button
            onClick={() => setShowPayment(true)}
            disabled={items.length === 0}
            className="w-full py-4 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-amber-700/30 active:scale-[0.98]"
          >
            💳 COBRAR {items.length > 0 ? formatCurrency(total) : ''}
            <span className="block text-xs font-normal opacity-70">F10</span>
          </button>
        </div>
      </div>

      {/* Modal de pago */}
      {showPayment && (
        <PaymentModal
          total={total}
          hasCustomer={!!customer}
          onClose={() => setShowPayment(false)}
          onConfirm={(payments, commission) => handleConfirmSale(payments, commission)}
          onConfirmFiado={handleConfirmFiado}
        />
      )}

      {/* Buscador de cliente */}
      {showCustomerSearch && (
        <CustomerSearch
          onSelect={setCustomer}
          onClose={() => setShowCustomerSearch(false)}
        />
      )}

      {/* Modal de recibo / ticket */}
      {saleReceipt && (
        <ReceiptModal
          receipt={saleReceipt}
          onClose={() => {
            setSaleReceipt(null)
            searchRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}

// ─── Grilla de productos destacados ─────────────────────────────────
function FeaturedProducts({ onSelect }: { onSelect: (p: Product) => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string }[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, icon')
        .eq('is_active', true)
        .order('sort_order')
        .limit(10)
      setCategories(cats ?? [])

      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .limit(40)
      setProducts(prods ?? [])
    }
    load()
  }, [])

  const filtered = activeCategory
    ? products.filter((p) => p.category_id === activeCategory)
    : products.filter((p) => p.is_featured)

  return (
    <div>
      {/* Filtros de categoría */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
        <button
          onClick={() => setActiveCategory(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            !activeCategory
              ? 'bg-amber-700 text-white shadow-sm'
              : 'bg-white text-stone-600 border border-stone-200 hover:border-amber-300'
          }`}
        >
          ⭐ Destacados
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-amber-700 text-white shadow-sm'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-amber-300'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">📦</p>
          <p className="text-stone-400 text-sm">
            {activeCategory ? 'Sin productos en esta categoría' : 'Marca productos como destacados para verlos aquí'}
          </p>
          <a href="/productos/nuevo" className="text-amber-700 text-sm hover:underline mt-2 inline-block">
            + Agregar producto
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => onSelect(product)}
              disabled={product.stock <= 0}
              className={`pos-grid-product bg-white rounded-xl border p-3 text-left hover:shadow-md transition-all active:scale-95 ${
                product.stock <= 0
                  ? 'border-red-200 opacity-50 cursor-not-allowed'
                  : 'border-stone-200 hover:border-amber-300'
              }`}
            >
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-16 object-cover rounded-lg mb-2" />
              ) : (
                <div className="w-full h-16 bg-stone-100 rounded-lg mb-2 flex items-center justify-center">
                  <span className="text-2xl">📦</span>
                </div>
              )}
              <p className="text-xs font-semibold text-stone-800 leading-tight line-clamp-2">{product.name}</p>
              <p className="text-sm font-bold text-amber-700 mt-1">{formatCurrency(product.sale_price)}</p>
              {product.stock <= 0 && (
                <span className="text-[10px] text-red-500 font-medium">Agotado</span>
              )}
              {product.stock > 0 && product.stock <= product.min_stock && (
                <span className="text-[10px] text-orange-500 font-medium">Stock bajo</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
