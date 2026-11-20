'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MovementType = 'inicial' | 'compra' | 'ajuste_entrada' | 'ajuste_salida' | 'merma'

interface Movement {
  id: string
  product_id: string | null
  product_name: string
  movement_type: string
  quantity: number
  notes: string | null
  created_by: string | null
  created_at: string
}

interface Product {
  id: string
  name: string
  stock: number
  min_stock: number | null
}

interface SaleItem {
  product_id: string | null
  quantity: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  inicial:        '📦 Inv. inicial',
  compra:         '🛒 Compra',
  ajuste_entrada: '➕ Ajuste entrada',
  ajuste_salida:  '➖ Ajuste salida',
  merma:          '⚠️ Merma',
}

const TYPE_COLOR: Record<string, string> = {
  inicial:        'bg-blue-100 text-blue-700',
  compra:         'bg-emerald-100 text-emerald-700',
  ajuste_entrada: 'bg-amber-100 text-amber-700',
  ajuste_salida:  'bg-orange-100 text-orange-700',
  merma:          'bg-red-100 text-red-700',
}

const IS_ENTRY: Record<string, boolean> = {
  inicial: true, compra: true, ajuste_entrada: true,
  ajuste_salida: false, merma: false,
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

// ─── Modal nuevo movimiento ───────────────────────────────────────────────────

function NuevoMovimientoModal({
  products,
  defaultProductId,
  onSave,
  onClose,
}: {
  products: Product[]
  defaultProductId?: string
  onSave: () => void
  onClose: () => void
}) {
  const [productId, setProductId] = useState(defaultProductId ?? '')
  const [type, setType]           = useState<MovementType>('compra')
  const [qty, setQty]             = useState('')
  const [by, setBy]               = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function handleSave() {
    if (!productId) { setError('Selecciona un producto'); return }
    const q = parseFloat(qty)
    if (!q || q <= 0) { setError('Cantidad inválida'); return }

    setSaving(true)
    setError('')
    const supabase = createClient()
    const product  = products.find(p => p.id === productId)

    const { error: err } = await supabase.from('inventory_movements').insert({
      product_id:    productId,
      product_name:  product?.name ?? '',
      movement_type: type,
      quantity:      q,
      notes:         notes.trim() || null,
      created_by:    by.trim() || null,
    })

    if (err) { setError(err.message); setSaving(false); return }

    // Actualizar stock
    const delta = IS_ENTRY[type] ? q : -q
    const { data: cur } = await supabase.from('products').select('stock').eq('id', productId).single()
    if (cur != null) {
      await supabase.from('products').update({ stock: Math.max(0, (cur.stock ?? 0) + delta) }).eq('id', productId)
    }

    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-800">Registrar movimiento</h2>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Producto *</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
              <option value="">Seleccionar...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Tipo *</label>
            <select value={type} onChange={e => setType(e.target.value as MovementType)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700">
              <option value="compra">🛒 Compra / Recepción</option>
              <option value="ajuste_entrada">➕ Ajuste entrada</option>
              <option value="ajuste_salida">➖ Ajuste salida</option>
              <option value="merma">⚠️ Merma / Pérdida</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Cantidad *</label>
            <input type="number" min="0.01" step="0.01" value={qty}
              onChange={e => setQty(e.target.value)} placeholder="0" autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Registrado por</label>
            <input type="text" value={by} onChange={e => setBy(e.target.value)} placeholder="Nombre"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notas</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Proveedor, motivo..."
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700" />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300">
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MovimientosPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [movements, setMovements]   = useState<Movement[]>([])
  const [saleItems, setSaleItems]   = useState<SaleItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [tableError, setTableError] = useState(false)

  // Filtros
  const [filterProduct, setFilterProduct] = useState('')
  const [filterType, setFilterType]       = useState('')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')

  // Modal
  const [showModal, setShowModal]       = useState(false)
  const [modalProductId, setModalProductId] = useState<string | undefined>()

  // Tab
  const [tab, setTab] = useState<'resumen' | 'movimientos'>('resumen')
  const [searchProduct, setSearchProduct] = useState('')

  // ── Carga de datos ────────────────────────────────────────────────────────
  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    const [
      { data: prods },
      { data: movs, error },
      { data: items },
    ] = await Promise.all([
      supabase.from('products').select('id, name, stock, min_stock').eq('is_active', true).order('name'),
      supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }),
      // Total de unidades vendidas por producto (ventas completadas)
      supabase
        .from('sale_items')
        .select('product_id, quantity, sales!inner(status)')
        .eq('sales.status', 'completed'),
    ])

    if (error) {
      if (error.code === '42P01') setTableError(true)
      setLoading(false)
      return
    }

    setProducts(prods ?? [])
    setMovements(movs ?? [])
    setSaleItems((items ?? []).map((i: any) => ({ product_id: i.product_id, quantity: i.quantity })))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtered = movements.filter(m => {
    if (filterProduct && m.product_id !== filterProduct) return false
    if (filterType    && m.movement_type !== filterType)   return false
    if (dateFrom) {
      const from = new Date(dateFrom + 'T00:00:00-05:00') // Colombia
      if (new Date(m.created_at) < from) return false
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59-05:00') // Colombia
      if (new Date(m.created_at) > to) return false
    }
    return true
  })

  // ── Resumen por producto (todos los movimientos, sin filtro de fecha) ─────
  const summaries = products.map(product => {
    const movs     = movements.filter(m => m.product_id === product.id)
    const entradas = movs.filter(m =>  IS_ENTRY[m.movement_type]).reduce((s, m) => s + m.quantity, 0)
    const salidas  = movs.filter(m => !IS_ENTRY[m.movement_type]).reduce((s, m) => s + m.quantity, 0)
    // Unidades vendidas en el POS para este producto
    const vendido  = saleItems.filter(i => i.product_id === product.id).reduce((s, i) => s + i.quantity, 0)
    // Inventario inicial = stock actual + todo lo que salió (ventas + ajustes) - todo lo que entró (compras + ajustes)
    const inicial  = product.stock + vendido + salidas - entradas
    return { product, entradas, salidas, vendido, inicial }
  })

  // ── Error: tabla no existe ─────────────────────────────────────────────────
  if (tableError) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-stone-800 mb-4">📦 Movimientos de Inventario</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="font-semibold text-amber-800 mb-2">Tabla no encontrada — ejecuta este SQL en Supabase:</p>
          <pre className="bg-amber-100 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap text-amber-900">{`CREATE TABLE IF NOT EXISTS inventory_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL DEFAULT '',
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('inicial','compra','ajuste_entrada','ajuste_salida','merma')),
  quantity      NUMERIC(12,2) NOT NULL,
  notes         TEXT,
  reference_id  UUID,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON inventory_movements FOR ALL TO authenticated USING (true);`}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">📦 Movimientos de Inventario</h1>
          <p className="text-stone-500 text-sm mt-0.5">Inventario inicial y entradas por producto</p>
        </div>
        <button onClick={() => { setModalProductId(undefined); setShowModal(true) }}
          className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 text-sm">
          + Registrar
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-5 w-fit">
        {([['resumen', '📊 Por producto'], ['movimientos', '📋 Movimientos']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ TAB: Resumen por producto ══════════════════════════════════════════ */}
      {tab === 'resumen' && (
        loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-stone-500">No hay productos activos</p>
          </div>
        ) : (
          <>
            {/* Buscador */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔍</span>
              <input
                type="text"
                value={searchProduct}
                onChange={e => setSearchProduct(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
              {searchProduct && (
                <button onClick={() => setSearchProduct('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-lg leading-none">
                  ×
                </button>
              )}
            </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-stone-500">No hay productos activos</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            {/* Cabecera */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wide">
              <div className="col-span-3">Producto</div>
              <div className="col-span-2 text-right text-blue-600">Inv. inicial</div>
              <div className="col-span-2 text-right text-emerald-600">+ Compras</div>
              <div className="col-span-2 text-right text-red-500">- Vendido</div>
              <div className="col-span-2 text-right text-orange-500">- Ajustes</div>
              <div className="col-span-1 text-right">Actual</div>
            </div>
            {/* Filas */}
            <div className="divide-y divide-stone-50">
              {summaries
                .filter(({ product }) =>
                  !searchProduct || product.name.toLowerCase().includes(searchProduct.toLowerCase())
                )
                .map(({ product, entradas, salidas, vendido, inicial }) => {
                const bajo = product.min_stock != null && product.stock <= product.min_stock
                return (
                  <div key={product.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-stone-50">
                    <div className="col-span-3">
                      <p className="font-medium text-stone-800 text-sm">{product.name}</p>
                      {bajo && <span className="text-[10px] text-red-600 font-semibold">⚠️ Stock bajo</span>}
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-semibold text-blue-700">{inicial.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`text-sm font-semibold ${entradas > 0 ? 'text-emerald-700' : 'text-stone-300'}`}>
                        +{entradas.toLocaleString('es-CO')}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`text-sm font-semibold ${vendido > 0 ? 'text-red-600' : 'text-stone-300'}`}>
                        -{vendido.toLocaleString('es-CO')}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`text-sm font-semibold ${salidas > 0 ? 'text-orange-600' : 'text-stone-300'}`}>
                        -{salidas.toLocaleString('es-CO')}
                      </span>
                    </div>
                    <div className="col-span-1 text-right flex items-center justify-end gap-1">
                      <span className={`text-sm font-bold ${bajo ? 'text-red-600' : 'text-stone-800'}`}>
                        {product.stock.toLocaleString('es-CO')}
                      </span>
                      <button
                        onClick={() => { setModalProductId(product.id); setShowModal(true) }}
                        className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-1.5 py-0.5 rounded-md font-bold ml-1"
                        title="Registrar entrada">
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          </>
        )
      )}

      {/* ══ TAB: Movimientos ══════════════════════════════════════════════════ */}
      {tab === 'movimientos' && (
        <>
          {/* Filtros */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Fecha desde */}
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Desde</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              {/* Fecha hasta */}
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Hasta</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              {/* Producto */}
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Producto</label>
                <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700">
                  <option value="">Todos los productos</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {/* Tipo */}
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Tipo</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700">
                  <option value="">Todos los tipos</option>
                  <option value="inicial">📦 Inv. inicial</option>
                  <option value="compra">🛒 Compra</option>
                  <option value="ajuste_entrada">➕ Ajuste entrada</option>
                  <option value="ajuste_salida">➖ Ajuste salida</option>
                  <option value="merma">⚠️ Merma</option>
                </select>
              </div>
            </div>
            {/* Limpiar filtros */}
            {(filterProduct || filterType || dateFrom || dateTo) && (
              <button onClick={() => { setFilterProduct(''); setFilterType(''); setDateFrom(''); setDateTo('') }}
                className="text-xs text-stone-500 hover:text-stone-700 underline">
                Limpiar filtros
              </button>
            )}
          </div>

          {/* KPIs del filtro */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-3 text-center">
              <p className="text-xs text-stone-400 uppercase tracking-wide">Registros</p>
              <p className="text-xl font-bold text-stone-800">{filtered.length}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
              <p className="text-xs text-emerald-600 uppercase tracking-wide">↑ Entradas</p>
              <p className="text-xl font-bold text-emerald-700">
                {filtered.filter(m => IS_ENTRY[m.movement_type]).reduce((s, m) => s + m.quantity, 0).toLocaleString('es-CO')}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
              <p className="text-xs text-red-600 uppercase tracking-wide">↓ Salidas</p>
              <p className="text-xl font-bold text-red-700">
                {filtered.filter(m => !IS_ENTRY[m.movement_type]).reduce((s, m) => s + m.quantity, 0).toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          {/* Lista de movimientos */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-stone-500">No hay movimientos con estos filtros</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="divide-y divide-stone-50">
                {filtered.map(m => {
                  const nombre = m.product_name?.trim() || products.find(p => p.id === m.product_id)?.name || '—'
                  const isEntry = IS_ENTRY[m.movement_type] ?? false
                  return (
                    <div key={m.id} className="px-4 py-3 hover:bg-stone-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-stone-800 text-sm">{nombre}</p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[m.movement_type] ?? 'bg-stone-100 text-stone-600'}`}>
                              {TYPE_LABEL[m.movement_type] ?? m.movement_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-400 flex-wrap">
                            <span>{formatDate(m.created_at)}</span>
                            {m.created_by && <span>👤 {m.created_by}</span>}
                            {m.notes && <span className="italic">"{m.notes}"</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-lg font-bold ${isEntry ? 'text-emerald-700' : 'text-red-600'}`}>
                            {isEntry ? '+' : '-'}{m.quantity.toLocaleString('es-CO')}
                          </p>
                          <p className="text-xs text-stone-400">uds</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <NuevoMovimientoModal
          products={products}
          defaultProductId={modalProductId}
          onSave={() => { loadData() }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
