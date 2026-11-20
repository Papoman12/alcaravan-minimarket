'use client'

/**
 * Movimientos de Inventario — solo consulta
 *
 * Tab "Por producto": muestra inventario inicial (el que se digitó al crear
 * el producto), compras recibidas, unidades vendidas y stock actual.
 *
 * Tab "Compras recibidas": historial de purchase_items por fecha/producto.
 *
 * Esta página NO permite registrar movimientos manuales.
 * Las compras se ingresan desde el módulo /compras.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  stock: number
  initial_stock: number | null   // columna opcional; si no existe usamos la fórmula
  min_stock: number | null
}

interface PurchaseItem {
  id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  unit_cost: number | null
  purchase_id: string
  created_at?: string
  purchases?: { date: string; supplier_name?: string | null } | null
}

interface SaleItem {
  product_id: string | null
  quantity: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'America/Bogota',
  })
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function MovimientosPage() {
  const [products, setProducts]         = useState<Product[]>([])
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [saleItems, setSaleItems]       = useState<SaleItem[]>([])
  const [loading, setLoading]           = useState(true)

  const [tab, setTab]                   = useState<'resumen' | 'compras'>('resumen')
  const [searchProduct, setSearchProduct] = useState('')

  // Filtros tab compras
  const [filterProdCompra, setFilterProdCompra] = useState('')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')

  // ── Carga ─────────────────────────────────────────────────────────────────
  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    const [
      { data: prods },
      { data: pitems },
      { data: sitems },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, stock, initial_stock, min_stock')
        .eq('is_active', true)
        .order('name'),

      // Compras recibidas: purchase_items con la fecha de la compra
      supabase
        .from('purchase_items')
        .select('id, product_id, product_name, quantity, unit_cost, purchase_id, purchases(date, supplier_name)')
        .order('purchase_id', { ascending: false }),

      // Ventas completadas
      supabase
        .from('sale_items')
        .select('product_id, quantity, sales!inner(status)')
        .eq('sales.status', 'completed'),
    ])

    setProducts((prods ?? []).map((p: any) => ({
      id:            p.id,
      name:          p.name,
      stock:         p.stock ?? 0,
      initial_stock: p.initial_stock ?? null,
      min_stock:     p.min_stock ?? null,
    })))

    setPurchaseItems((pitems ?? []).map((i: any) => ({
      id:           i.id,
      product_id:   i.product_id,
      product_name: i.product_name,
      quantity:     i.quantity ?? 0,
      unit_cost:    i.unit_cost ?? null,
      purchase_id:  i.purchase_id,
      purchases:    i.purchases ?? null,
    })))

    setSaleItems((sitems ?? []).map((i: any) => ({
      product_id: i.product_id,
      quantity:   i.quantity ?? 0,
    })))

    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ── Resumen por producto ──────────────────────────────────────────────────
  const summaries = products
    .filter(p => !searchProduct || p.name.toLowerCase().includes(searchProduct.toLowerCase()))
    .map(product => {
      const comprado = purchaseItems
        .filter(i => i.product_id === product.id)
        .reduce((s, i) => s + i.quantity, 0)

      const vendido = saleItems
        .filter(i => i.product_id === product.id)
        .reduce((s, i) => s + i.quantity, 0)

      // Inv. inicial: si hay columna initial_stock la usamos directo;
      // si no, lo reconstruimos: actual + vendido - comprado
      const inicial = product.initial_stock != null
        ? product.initial_stock
        : product.stock + vendido - comprado

      return { product, comprado, vendido, inicial }
    })

  // ── Filtrado tab compras ──────────────────────────────────────────────────
  const filteredCompras = purchaseItems.filter(i => {
    if (filterProdCompra && i.product_id !== filterProdCompra) return false
    const fechaCompra = i.purchases?.date
    if (dateFrom && fechaCompra && fechaCompra < dateFrom) return false
    if (dateTo   && fechaCompra && fechaCompra > dateTo)   return false
    return true
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-5xl mx-auto">

      {/* Encabezado */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-stone-800">📦 Movimientos de Inventario</h1>
        <p className="text-stone-500 text-sm mt-0.5">Consulta de inventario inicial, compras y ventas por producto</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-5 w-fit">
        {([['resumen', '📊 Por producto'], ['compras', '🛒 Compras recibidas']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ══ TAB: Por producto ════════════════════════════════════════════════ */}
      {!loading && tab === 'resumen' && (
        <>
          {/* Buscador */}
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">🔍</span>
            <input
              type="text"
              value={searchProduct}
              onChange={e => setSearchProduct(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
            {searchProduct && (
              <button onClick={() => setSearchProduct('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xl leading-none">
                ×
              </button>
            )}
          </div>

          {summaries.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
              <p className="text-stone-500">No se encontraron productos</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              {/* Cabecera */}
              <div className="grid grid-cols-12 gap-1 px-4 py-2.5 bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                <div className="col-span-4">Producto</div>
                <div className="col-span-2 text-right text-blue-600">Inv. inicial</div>
                <div className="col-span-2 text-right text-emerald-600">+ Compras</div>
                <div className="col-span-2 text-right text-red-500">- Vendido</div>
                <div className="col-span-2 text-right">= Actual</div>
              </div>

              <div className="divide-y divide-stone-50">
                {summaries.map(({ product, comprado, vendido, inicial }) => {
                  const bajo = product.min_stock != null && product.stock <= product.min_stock
                  // Verificación: inicial + comprado - vendido debería ser igual a actual
                  const calculado = inicial + comprado - vendido
                  const diff = Math.abs(calculado - product.stock)
                  const hayDiff = diff > 0.01

                  return (
                    <div key={product.id} className="grid grid-cols-12 gap-1 px-4 py-3 items-center hover:bg-stone-50">
                      <div className="col-span-4">
                        <p className="font-medium text-stone-800 text-sm">{product.name}</p>
                        {bajo && <span className="text-[10px] text-red-600 font-semibold">⚠️ Stock bajo</span>}
                        {hayDiff && (
                          <span className="text-[10px] text-orange-500" title="Puede haber ajustes manuales de stock">
                            ⚡ Ajuste: {(product.stock - calculado).toLocaleString('es-CO')}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm font-semibold text-blue-700">{inicial.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className={`text-sm font-semibold ${comprado > 0 ? 'text-emerald-700' : 'text-stone-300'}`}>
                          +{comprado.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className={`text-sm font-semibold ${vendido > 0 ? 'text-red-600' : 'text-stone-300'}`}>
                          -{vendido.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className={`text-sm font-bold ${bajo ? 'text-red-600' : 'text-stone-800'}`}>
                          {product.stock.toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ TAB: Compras recibidas ════════════════════════════════════════════ */}
      {!loading && tab === 'compras' && (
        <>
          {/* Filtros */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Desde</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Hasta</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-500 mb-1">Producto</label>
                <select value={filterProdCompra} onChange={e => setFilterProdCompra(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700">
                  <option value="">Todos los productos</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {(filterProdCompra || dateFrom || dateTo) && (
              <button onClick={() => { setFilterProdCompra(''); setDateFrom(''); setDateTo('') }}
                className="text-xs text-stone-500 hover:text-stone-700 underline">
                Limpiar filtros
              </button>
            )}
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
              <p className="text-xs text-emerald-600 uppercase tracking-wide">Registros</p>
              <p className="text-xl font-bold text-emerald-700">{filteredCompras.length}</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-3 text-center">
              <p className="text-xs text-stone-400 uppercase tracking-wide">Total unidades</p>
              <p className="text-xl font-bold text-stone-800">
                {filteredCompras.reduce((s, i) => s + i.quantity, 0).toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          {filteredCompras.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
              <p className="text-4xl mb-3">🛒</p>
              <p className="text-stone-500">No hay compras con estos filtros</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="divide-y divide-stone-50">
                {filteredCompras.map(item => {
                  const nombre = item.product_name?.trim()
                    || products.find(p => p.id === item.product_id)?.name
                    || '—'
                  const fecha = item.purchases?.date ? formatDate(item.purchases.date) : '—'
                  return (
                    <div key={item.id} className="px-4 py-3 hover:bg-stone-50 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-800 text-sm">{nombre}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-400 flex-wrap">
                          <span>📅 {fecha}</span>
                          {item.purchases?.supplier_name && (
                            <span>🏭 {item.purchases.supplier_name}</span>
                          )}
                          {item.unit_cost != null && (
                            <span>💰 {formatCurrency(item.unit_cost)} / ud</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-emerald-700">
                          +{item.quantity.toLocaleString('es-CO')}
                        </p>
                        <p className="text-xs text-stone-400">uds</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
