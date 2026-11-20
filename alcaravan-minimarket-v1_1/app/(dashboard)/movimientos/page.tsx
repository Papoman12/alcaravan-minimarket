'use client'

/**
 * Movimientos de Inventario
 *
 * Vista 1 — Resumen por producto:
 *   Muestra cada producto con su stock (inventario inicial) y el total
 *   de entradas registradas en inventory_movements.
 *
 * Vista 2 — Historial:
 *   Log detallado de todos los movimientos.
 *
 * SQL requerido (Supabase SQL Editor):
 * ─────────────────────────────────────────────────────────────────────────
 *   CREATE TABLE IF NOT EXISTS inventory_movements (
 *     id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
 *     product_name  TEXT NOT NULL DEFAULT '',
 *     movement_type TEXT NOT NULL
 *                   CHECK (movement_type IN ('inicial','compra','ajuste_entrada','ajuste_salida','merma')),
 *     quantity      NUMERIC(12,2) NOT NULL,
 *     notes         TEXT,
 *     reference_id  UUID,
 *     created_by    TEXT,
 *     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *   ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Authenticated users can manage inventory_movements"
 *     ON inventory_movements FOR ALL TO authenticated USING (true);
 *
 *   ALTER TABLE cash_sessions
 *     ADD COLUMN IF NOT EXISTS opened_by TEXT,
 *     ADD COLUMN IF NOT EXISTS closed_by  TEXT;
 * ─────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MovementType = 'inicial' | 'compra' | 'ajuste_entrada' | 'ajuste_salida' | 'merma'

interface Movement {
  id: string
  product_id: string | null
  product_name: string
  movement_type: MovementType
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
  unit: string | null
}

interface ProductSummary {
  product: Product
  totalEntradas: number
  totalSalidas: number
  movements: Movement[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<MovementType, string> = {
  inicial: 'Inventario inicial',
  compra: 'Compra / Recepción',
  ajuste_entrada: 'Ajuste entrada',
  ajuste_salida: 'Ajuste salida',
  merma: 'Merma / Pérdida',
}

const TYPE_COLOR: Record<MovementType, string> = {
  inicial: 'bg-blue-100 text-blue-700',
  compra: 'bg-emerald-100 text-emerald-700',
  ajuste_entrada: 'bg-amber-100 text-amber-700',
  ajuste_salida: 'bg-orange-100 text-orange-700',
  merma: 'bg-red-100 text-red-700',
}

const IS_ENTRY: Record<MovementType, boolean> = {
  inicial: true,
  compra: true,
  ajuste_entrada: true,
  ajuste_salida: false,
  merma: false,
}

type Period = 'today' | '7d' | '30d' | 'all'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'all', label: 'Todo' },
]

function getFromDate(period: Period): string | null {
  if (period === 'all') return null
  const d = new Date()
  if (period === 'today') d.setHours(0, 0, 0, 0)
  else if (period === '7d') d.setDate(d.getDate() - 7)
  else if (period === '30d') d.setDate(d.getDate() - 30)
  return d.toISOString()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

// ─── Modal: Nuevo Movimiento ──────────────────────────────────────────────────

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
  const supabase = createClient()
  const [form, setForm] = useState({
    product_id: defaultProductId ?? '',
    movement_type: 'compra' as MovementType,
    quantity: '',
    notes: '',
    created_by: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.product_id || !form.quantity) {
      setError('Producto y cantidad son obligatorios')
      return
    }
    const qty = parseFloat(form.quantity)
    if (isNaN(qty) || qty <= 0) { setError('Cantidad inválida'); return }

    setSaving(true)
    setError('')

    const product = products.find(p => p.id === form.product_id)

    const { error: err } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: form.product_id,
        product_name: product?.name ?? '',
        movement_type: form.movement_type,
        quantity: qty,
        notes: form.notes.trim() || null,
        created_by: form.created_by.trim() || null,
      })

    if (err) { setError(err.message); setSaving(false); return }

    // Actualizar stock del producto
    const delta = IS_ENTRY[form.movement_type] ? qty : -qty
    const { data: prodData } = await supabase
      .from('products')
      .select('stock')
      .eq('id', form.product_id)
      .single()
    if (prodData) {
      await supabase
        .from('products')
        .update({ stock: Math.max(0, (prodData.stock ?? 0) + delta) })
        .eq('id', form.product_id)
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
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-xl">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Producto *</label>
            <select
              value={form.product_id}
              onChange={e => setForm({ ...form, product_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
            >
              <option value="">Seleccionar producto...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Tipo de movimiento *</label>
            <select
              value={form.movement_type}
              onChange={e => setForm({ ...form, movement_type: e.target.value as MovementType })}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
            >
              <option value="compra">🛒 Compra / Recepción</option>
              <option value="ajuste_entrada">➕ Ajuste de entrada</option>
              <option value="ajuste_salida">➖ Ajuste de salida</option>
              <option value="merma">⚠️ Merma / Pérdida</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Cantidad *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })}
              placeholder="0"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Registrado por</label>
            <input
              type="text"
              value={form.created_by}
              onChange={e => setForm({ ...form, created_by: e.target.value })}
              placeholder="Nombre de quien registra"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Motivo, proveedor, etc."
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300"
          >
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Vista: Resumen por producto ──────────────────────────────────────────────

function ResumenView({
  summaries,
  onAdd,
}: {
  summaries: ProductSummary[]
  onAdd: (productId: string) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (summaries.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
        <p className="text-4xl mb-3">📦</p>
        <p className="text-stone-500">No hay productos activos</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      {/* Encabezado tabla */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-500 uppercase tracking-wide">
        <div className="col-span-4">Producto</div>
        <div className="col-span-2 text-right text-blue-600">Inv. inicial</div>
        <div className="col-span-2 text-right text-emerald-600">+ Entradas</div>
        <div className="col-span-2 text-right text-orange-500">- Salidas</div>
        <div className="col-span-1 text-right">Actual</div>
        <div className="col-span-1"></div>
      </div>

      <div className="divide-y divide-stone-50">
        {summaries.map(({ product, totalEntradas, totalSalidas, movements }) => {
          const isOpen = expanded === product.id
          // Inventario inicial = stock actual + salidas - entradas
          // (reconstruimos cuánto había antes de los movimientos registrados)
          const inventarioInicial = product.stock - totalEntradas + totalSalidas
          const stockBajo = product.min_stock != null && product.stock <= product.min_stock

          return (
            <div key={product.id}>
              {/* Fila del producto */}
              <div
                className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-stone-50 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : product.id)}
              >
                <div className="col-span-4">
                  <p className="font-medium text-stone-800 text-sm">{product.name}</p>
                  {stockBajo && (
                    <span className="text-[10px] text-red-600 font-semibold">⚠️ Stock bajo</span>
                  )}
                </div>
                {/* Inv. inicial = stock actual + salidas acumuladas - entradas acumuladas */}
                <div className="col-span-2 text-right">
                  <span className="text-sm font-semibold text-blue-700">{inventarioInicial.toLocaleString('es-CO')}</span>
                  {product.unit && <span className="text-xs text-stone-400 ml-1">{product.unit}</span>}
                </div>
                <div className="col-span-2 text-right">
                  <span className={`text-sm font-semibold ${totalEntradas > 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                    +{totalEntradas.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className={`text-sm font-semibold ${totalSalidas > 0 ? 'text-orange-600' : 'text-stone-400'}`}>
                    -{totalSalidas.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="col-span-1 text-right">
                  <span className={`text-sm font-bold ${stockBajo ? 'text-red-600' : 'text-stone-800'}`}>
                    {product.stock.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={e => { e.stopPropagation(); onAdd(product.id) }}
                    className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-2 py-1 rounded-lg font-semibold"
                    title="Registrar entrada"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Movimientos expandibles */}
              {isOpen && (
                <div className="bg-stone-50 border-t border-stone-100 px-6 py-3 space-y-1.5">
                  {movements.length === 0 ? (
                    <p className="text-xs text-stone-400 py-2">No hay movimientos registrados para este producto.</p>
                  ) : (
                    movements.map(m => {
                      const typeLabel = TYPE_LABEL[m.movement_type] ?? m.movement_type
                      const typeColor = TYPE_COLOR[m.movement_type] ?? 'bg-stone-100 text-stone-600'
                      const isEntry = IS_ENTRY[m.movement_type] ?? false
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-3 py-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
                              {typeLabel}
                            </span>
                            <span className="text-xs text-stone-500">{formatDate(m.created_at)}</span>
                            {m.created_by && <span className="text-xs text-stone-400">👤 {m.created_by}</span>}
                            {m.notes && <span className="text-xs text-stone-400 italic">"{m.notes}"</span>}
                          </div>
                          <span className={`text-sm font-bold flex-shrink-0 ${isEntry ? 'text-emerald-700' : 'text-red-600'}`}>
                            {isEntry ? '+' : '-'}{m.quantity.toLocaleString('es-CO')}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vista: Historial ─────────────────────────────────────────────────────────

function HistorialView({
  movements,
  products,
}: {
  movements: Movement[]
  products: Product[]
}) {
  if (movements.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-stone-500">No hay movimientos en este período</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <div className="divide-y divide-stone-50">
        {movements.map((m) => {
          const displayName = m.product_name?.trim()
            || products.find(p => p.id === m.product_id)?.name
            || '—'
          const typeLabel = TYPE_LABEL[m.movement_type] ?? m.movement_type ?? 'Movimiento'
          const typeColor = TYPE_COLOR[m.movement_type] ?? 'bg-stone-100 text-stone-600'
          const isEntry = IS_ENTRY[m.movement_type] ?? false
          return (
            <div key={m.id} className="px-4 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-stone-800 text-sm">{displayName}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>
                      {typeLabel}
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
                  <p className="text-xs text-stone-400">unidades</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MovimientosPage() {
  const supabase = createClient()

  const [tab, setTab] = useState<'resumen' | 'historial'>('resumen')
  const [allMovements, setAllMovements] = useState<Movement[]>([])   // todos, sin filtro de fecha
  const [filteredMovements, setFilteredMovements] = useState<Movement[]>([]) // solo para historial
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [period, setPeriod] = useState<Period>('30d')
  const [showModal, setShowModal] = useState(false)
  const [modalProductId, setModalProductId] = useState<string | undefined>()

  // Carga inicial: productos + TODOS los movimientos (para el resumen siempre completo)
  const loadAll = useCallback(async () => {
    setLoading(true)

    const [{ data: prods }, { data: allMovs, error }] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, stock, min_stock, unit')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('inventory_movements')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

    if (error) {
      if (error.code === '42P01') setTableError(true)
      setLoading(false)
      return
    }

    setProducts(prods ?? [])
    setAllMovements(allMovs ?? [])
    setLoading(false)
  }, [])

  // Filtrar movimientos para el historial según el período
  useEffect(() => {
    const from = getFromDate(period)
    if (!from) {
      setFilteredMovements(allMovements)
    } else {
      const fromDate = new Date(from)
      setFilteredMovements(allMovements.filter(m => new Date(m.created_at) >= fromDate))
    }
  }, [period, allMovements])

  useEffect(() => { loadAll() }, [loadAll])

  function openModal(productId?: string) {
    setModalProductId(productId)
    setShowModal(true)
  }

  // Resumen por producto — usa TODOS los movimientos (sin filtro de fecha)
  const summaries: ProductSummary[] = products.map(product => {
    const prodMovements = allMovements.filter(m => m.product_id === product.id)
    const totalEntradas = prodMovements
      .filter(m => IS_ENTRY[m.movement_type])
      .reduce((s, m) => s + m.quantity, 0)
    const totalSalidas = prodMovements
      .filter(m => !IS_ENTRY[m.movement_type])
      .reduce((s, m) => s + m.quantity, 0)
    return { product, totalEntradas, totalSalidas, movements: prodMovements }
  })

  // KPIs — también sobre todos los movimientos
  const totalEntradas = allMovements.filter(m => IS_ENTRY[m.movement_type]).reduce((s, m) => s + m.quantity, 0)
  const totalSalidas  = allMovements.filter(m => !IS_ENTRY[m.movement_type]).reduce((s, m) => s + m.quantity, 0)

  if (tableError) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-stone-800 mb-4">📦 Movimientos de Inventario</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="font-semibold text-amber-800 mb-3">Tabla no encontrada — ejecuta este SQL en Supabase:</p>
          <pre className="bg-amber-100 text-amber-900 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS inventory_movements (
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
CREATE POLICY "Authenticated users can manage inventory_movements"
  ON inventory_movements FOR ALL TO authenticated USING (true);`}</pre>
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
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 transition-colors text-sm"
        >
          + Registrar
        </button>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="text-xs text-stone-400 uppercase tracking-wide">Productos</p>
          <p className="text-2xl font-bold text-stone-800">{products.length}</p>
          <p className="text-xs text-stone-400">activos</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-xs text-emerald-600 uppercase tracking-wide">↑ Entradas</p>
          <p className="text-2xl font-bold text-emerald-700">{totalEntradas.toLocaleString('es-CO')}</p>
          <p className="text-xs text-emerald-500">unidades registradas</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-xs text-red-600 uppercase tracking-wide">↓ Salidas</p>
          <p className="text-2xl font-bold text-red-700">{totalSalidas.toLocaleString('es-CO')}</p>
          <p className="text-xs text-red-500">unidades registradas</p>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-4 w-fit">
        <button
          onClick={() => setTab('resumen')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'resumen' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          📊 Por producto
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'historial' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          📋 Historial
        </button>
      </div>

      {/* ── Filtro período (solo en historial) ──────────────────────────────── */}
      {tab === 'historial' && (
        <div className="flex gap-2 flex-wrap mb-4">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                period === p.key
                  ? 'bg-amber-700 text-white'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Contenido ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'resumen' ? (
        <ResumenView summaries={summaries} onAdd={openModal} />
      ) : (
        <HistorialView movements={filteredMovements} products={products} />
      )}

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <NuevoMovimientoModal
          products={products}
          defaultProductId={modalProductId}
          onSave={loadAll}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
