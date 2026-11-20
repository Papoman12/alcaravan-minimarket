'use client'

/**
 * Movimientos de Inventario — solo consulta
 * Las compras se ingresan desde /compras, no desde aquí.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Product {
  id: string
  name: string
  stock: number
  min_stock: number | null
}

interface PurchaseItem {
  id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  unit_cost: number | null
  purchase_date: string | null
  supplier_name: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'America/Bogota',
  })
}

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n)
}

export default function MovimientosPage() {
  const [products, setProducts]       = useState<Product[]>([])
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [soldMap, setSoldMap]         = useState<Record<string, number>>({})
  const [loading, setLoading]         = useState(true)
  const [errors, setErrors]           = useState<string[]>([])

  const [tab, setTab]                 = useState<'resumen' | 'compras'>('resumen')
  const [searchProduct, setSearchProduct] = useState('')
  const [filterProd, setFilterProd]   = useState('')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setErrors([])
    const supabase = createClient()
    const errs: string[] = []

    // 1. Productos
    const { data: prods, error: e1 } = await supabase
      .from('products')
      .select('id, name, stock, min_stock')
      .eq('is_active', true)
      .order('name')
    if (e1) errs.push('productos: ' + e1.message)
    setProducts(prods ?? [])

    // 2. Items de compra con la fecha de su compra (dos consultas separadas)
    const { data: rawItems, error: e2 } = await supabase
      .from('purchase_items')
      .select('id, product_id, product_name, quantity, unit_cost, purchase_id')
    if (e2) errs.push('purchase_items: ' + e2.message)

    let enrichedItems: PurchaseItem[] = []
    if (rawItems && rawItems.length > 0) {
      // Obtener ids únicos de compras
      const purchaseIds = [...new Set(rawItems.map((i: any) => i.purchase_id).filter(Boolean))]
      const { data: purchases, error: e3 } = await supabase
        .from('purchases')
        .select('id, date, supplier_name')
        .in('id', purchaseIds)
      if (e3) errs.push('purchases: ' + e3.message)

      const purchaseMap: Record<string, { date: string; supplier_name: string | null }> = {}
      for (const p of purchases ?? []) {
        purchaseMap[p.id] = { date: p.date, supplier_name: p.supplier_name ?? null }
      }

      enrichedItems = rawItems.map((i: any) => ({
        id:            i.id,
        product_id:    i.product_id,
        product_name:  i.product_name ?? null,
        quantity:      i.quantity ?? 0,
        unit_cost:     i.unit_cost ?? null,
        purchase_date: purchaseMap[i.purchase_id]?.date ?? null,
        supplier_name: purchaseMap[i.purchase_id]?.supplier_name ?? null,
      }))
    }
    setPurchaseItems(enrichedItems)

    // 3. Unidades vendidas por producto
    const { data: sitems, error: e4 } = await supabase
      .from('sale_items')
      .select('product_id, quantity, sales!inner(status)')
      .eq('sales.status', 'completed')
    if (e4) errs.push('sale_items: ' + e4.message)

    const sold: Record<string, number> = {}
    for (const s of sitems ?? []) {
      if (s.product_id) sold[s.product_id] = (sold[s.product_id] ?? 0) + (s.quantity ?? 0)
    }
    setSoldMap(sold)

    setErrors(errs)
    setLoading(false)
  }

  // Resumen por producto
  const summaries = products
    .filter(p => !searchProduct || p.name.toLowerCase().includes(searchProduct.toLowerCase()))
    .map(p => {
      const comprado = purchaseItems
        .filter(i => i.product_id === p.id)
        .reduce((s, i) => s + i.quantity, 0)
      const vendido = soldMap[p.id] ?? 0
      // Inv. inicial = stock actual + vendido - comprado
      const inicial = p.stock + vendido - comprado
      return { product: p, comprado, vendido, inicial }
    })

  // Filtro compras
  const filteredCompras = purchaseItems.filter(i => {
    if (filterProd && i.product_id !== filterProd) return false
    if (dateFrom && i.purchase_date && i.purchase_date < dateFrom) return false
    if (dateTo   && i.purchase_date && i.purchase_date > dateTo)   return false
    return true
  })

  return (
    <div className="p-4 max-w-5xl mx-auto">

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-stone-800">📦 Movimientos de Inventario</h1>
        <p className="text-stone-500 text-sm mt-0.5">Consulta de inventario por producto</p>
      </div>

      {/* Errores visibles para debug */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 space-y-1">
          <p className="font-semibold text-red-700 text-sm">Error cargando datos:</p>
          {errors.map((e, i) => <p key={i} className="text-red-600 text-xs font-mono">{e}</p>)}
          <button onClick={loadData} className="mt-2 text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg">
            Reintentar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-5 w-fit">
        {([['resumen', '📊 Por producto'], ['compras', '🛒 Compras recibidas']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === k ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ══ TAB: Por producto ══════════════════════════════════════════════ */}
          {tab === 'resumen' && (
            <>
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">🔍</span>
                <input type="text" value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700" />
                {searchProduct && (
                  <button onClick={() => setSearchProduct('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xl">×</button>
                )}
              </div>

              {summaries.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
                  <p className="text-stone-400">No se encontraron productos</p>
                </div>
              ) : (
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-1 px-4 py-2.5 bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    <div className="col-span-4">Producto</div>
                    <div className="col-span-2 text-right text-blue-600">Inv. inicial</div>
                    <div className="col-span-2 text-right text-emerald-600">+ Compras</div>
                    <div className="col-span-2 text-right text-red-500">− Vendido</div>
                    <div className="col-span-2 text-right">= Actual</div>
                  </div>
                  <div className="divide-y divide-stone-50">
                    {summaries.map(({ product, comprado, vendido, inicial }) => {
                      const bajo = product.min_stock != null && product.stock <= product.min_stock
                      return (
                        <div key={product.id} className="grid grid-cols-12 gap-1 px-4 py-3 items-center hover:bg-stone-50">
                          <div className="col-span-4">
                            <p className="font-medium text-stone-800 text-sm">{product.name}</p>
                            {bajo && <span className="text-[10px] text-red-600 font-semibold">⚠️ Stock bajo</span>}
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

          {/* ══ TAB: Compras recibidas ════════════════════════════════════════ */}
          {tab === 'compras' && (
            <>
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
                    <select value={filterProd} onChange={e => setFilterProd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700">
                      <option value="">Todos los productos</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                {(filterProd || dateFrom || dateTo) && (
                  <button onClick={() => { setFilterProd(''); setDateFrom(''); setDateTo('') }}
                    className="text-xs text-stone-500 hover:text-stone-700 underline">
                    Limpiar filtros
                  </button>
                )}
              </div>

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
                      return (
                        <div key={item.id} className="px-4 py-3 hover:bg-stone-50 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-stone-800 text-sm">{nombre}</p>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-400 flex-wrap">
                              {item.purchase_date && <span>📅 {formatDate(item.purchase_date)}</span>}
                              {item.supplier_name && <span>🏭 {item.supplier_name}</span>}
                              {item.unit_cost != null && <span>💰 {formatCOP(item.unit_cost)} / ud</span>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-emerald-700">+{item.quantity.toLocaleString('es-CO')}</p>
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
        </>
      )}
    </div>
  )
}
