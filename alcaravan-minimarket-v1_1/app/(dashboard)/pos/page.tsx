'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import type { Product, Customer, CartPayment, PaymentMethod, CartItem } from '@/types/database'

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
    <div className="flex items-center gap-3 py-3 border-b border-stone-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-stone-800 text-sm truncate">{item.product.name}</p>
        <p className="text-xs text-stone-500">{formatCurrency(item.unit_price)} c/u</p>
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
  onClose,
  onConfirm,
}: {
  total: number
  onClose: () => void
  onConfirm: (payments: CartPayment[]) => void
}) {
  const [payments, setPayments] = useState<CartPayment[]>([{ method: 'cash', amount: total }])
  const [processing, setProcessing] = useState(false)

  const METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
    { key: 'cash', label: 'Efectivo', icon: '💵' },
    { key: 'card_debit', label: 'Débito', icon: '💳' },
    { key: 'card_credit', label: 'Crédito', icon: '💳' },
    { key: 'transfer', label: 'Transferencia', icon: '🏦' },
    { key: 'nequi', label: 'Nequi', icon: '📱' },
    { key: 'daviplata', label: 'Daviplata', icon: '📱' },
    { key: 'bancolombia', label: 'Bancolombia', icon: '🏦' },
    { key: 'other', label: 'Otro', icon: '💰' },
  ]

  const paidTotal = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const remaining = total - paidTotal
  const change = payments.find((p) => p.method === 'cash')?.received
    ? (payments.find((p) => p.method === 'cash')!.received! - payments.find((p) => p.method === 'cash')!.amount)
    : 0

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-stone-100">
          <h3 className="text-xl font-bold text-stone-800">Registrar Pago</h3>
          <p className="text-3xl font-bold text-amber-700 mt-1">{formatCurrency(total)}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Método de pago rápido */}
          <div>
            <p className="text-sm font-medium text-stone-600 mb-2">Método de pago</p>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPayments([{ method: m.key, amount: total }])}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-center ${
                    payments[0]?.method === m.key && payments.length === 1
                      ? 'border-amber-700 bg-amber-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <span className="text-lg">{m.icon}</span>
                  <span className="text-[10px] font-medium text-stone-600 leading-tight">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Monto por método */}
          {payments.map((p, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-stone-600 w-24">
                  {METHODS.find((m) => m.key === p.method)?.label}
                </span>
                <input
                  type="number"
                  value={p.amount || ''}
                  onChange={(e) => {
                    const newP = [...payments]
                    newP[i].amount = parseFloat(e.target.value) || 0
                    setPayments(newP)
                  }}
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-right font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                  placeholder="0"
                />
              </div>
              {p.method === 'cash' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-500 w-24">Recibido</span>
                  <input
                    type="number"
                    value={p.received || ''}
                    onChange={(e) => {
                      const newP = [...payments]
                      newP[i].received = parseFloat(e.target.value) || 0
                      setPayments(newP)
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-right text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-700"
                    placeholder={formatCurrency(total)}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Pago mixto */}
          <button
            onClick={() => setPayments([...payments, { method: 'transfer', amount: remaining > 0 ? remaining : 0 }])}
            className="text-sm text-amber-700 hover:underline font-medium"
          >
            + Agregar otro método de pago
          </button>

          {/* Resumen */}
          <div className="bg-stone-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Total a cobrar</span>
              <span className="font-bold text-stone-800">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Total pagado</span>
              <span className="font-bold text-stone-800">{formatCurrency(paidTotal)}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between text-sm text-red-600 font-medium">
                <span>Faltante</span>
                <span>{formatCurrency(remaining)}</span>
              </div>
            )}
            {change > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-bold border-t border-stone-200 pt-2">
                <span>Cambio a devolver</span>
                <span>{formatCurrency(change)}</span>
              </div>
            )}
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
            onClick={async () => {
              setProcessing(true)
              await onConfirm(payments)
              setProcessing(false)
            }}
            disabled={remaining > 0 || processing}
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
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotal,
    getItemCount,
  } = useCartStore()

  const [showPayment, setShowPayment] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastSaleNumber, setLastSaleNumber] = useState('')
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

  async function handleConfirmSale(payments: CartPayment[]) {
    try {
      setSaleError('')

      // Crear número de venta
      const saleNumber = 'V' + Date.now().toString().slice(-8)

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          sale_number: saleNumber,
          customer_id: customer?.id ?? null,
          subtotal: getSubtotal(),
          discount_amount: getDiscountAmount(),
          tax_amount: getTaxAmount(),
          total: getTotal(),
          status: 'completed',
          notes: notes || null,
        })
        .select()
        .single()

      if (saleError || !sale) throw saleError ?? new Error('Error al crear venta')

      // Insertar ítems
      const saleItems = items.map((i) => ({
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

      setLastSaleNumber(saleNumber)
      setShowPayment(false)
      setShowSuccess(true)
      clearCart()

      setTimeout(() => {
        setShowSuccess(false)
        searchRef.current?.focus()
      }, 3000)
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
              <p className="text-xs font-medium text-amber-700 mb-2">
                🕐 {suspended_carts.length} venta(s) suspendida(s)
              </p>
              <div className="flex flex-wrap gap-2">
                {suspended_carts.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => recoverCart(sc.id)}
                    className="text-xs px-3 py-1.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors"
                  >
                    Recuperar — {sc.items.length} ítem(s)
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Panel derecho: carrito ──────────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col bg-white border-l border-stone-200 shadow-xl">
        {/* Encabezado carrito */}
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div>
            <h3 className="font-bold text-stone-800">Carrito</h3>
            {customer && (
              <p className="text-xs text-emerald-600 font-medium">{customer.full_name}</p>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => suspendCart()}
              disabled={items.length === 0}
              className="p-2 rounded-lg text-stone-500 hover:bg-stone-200 disabled:opacity-30 transition-colors text-sm"
              title="Suspender venta"
            >
              ⏸
            </button>
            <button
              onClick={() => {
                if (items.length > 0 && confirm('¿Vaciar el carrito?')) clearCart()
              }}
              disabled={items.length === 0}
              className="p-2 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors text-sm"
              title="Limpiar carrito"
            >
              🗑
            </button>
          </div>
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
          onClose={() => setShowPayment(false)}
          onConfirm={handleConfirmSale}
        />
      )}

      {/* Toast de éxito */}
      {showSuccess && (
        <div className="fixed bottom-6 right-6 bg-emerald-700 text-white rounded-2xl shadow-2xl px-6 py-4 z-50 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-bold">¡Venta registrada!</p>
              <p className="text-sm opacity-80">{lastSaleNumber}</p>
            </div>
          </div>
        </div>
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
