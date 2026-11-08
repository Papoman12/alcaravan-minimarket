'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SaleItemRow {
  quantity: number
  purchase_price: number
  total: number
  product_name: string
  product_id: string | null
  sales: { status: string; created_at: string } | null
}

interface PurchaseRow {
  id: string
  total: number
  payment_method: string | null
  status: string | null
  created_at: string
  supplier: { name: string } | null
  purchase_number: string | null
}

interface ExpenseRow {
  id: string
  description: string | null
  amount: number
  category: string | null
  date: string
  payment_method: string | null
}

interface ProductStat {
  product_name: string
  revenue: number
  cost: number
  profit: number
  units: number
}

type DateRange = '7d' | '30d' | '90d' | 'all'
type Tab = 'bruta' | 'neta'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const pct = (n: number) => `${n.toFixed(1)}%`

const inRange = (dateStr: string, range: DateRange): boolean => {
  if (range === 'all') return true
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return new Date(dateStr) >= cutoff
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const supabase = createClient()

  const [items, setItems]           = useState<SaleItemRow[]>([])
  const [purchases, setPurchases]   = useState<PurchaseRow[]>([])
  const [expenses, setExpenses]     = useState<ExpenseRow[]>([])
  const [fiado, setFiado]           = useState<{id:string; total:number; created_at:string; customer_name:string|null}[]>([])
  const [loading, setLoading]       = useState(true)
  const [range, setRange]           = useState<DateRange>('30d')
  const [tab, setTab]               = useState<Tab>('bruta')
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null)
  // IDs de compras excluidas del cálculo neto (inversión inicial, etc.)
  const [excludedPurchaseIds, setExcludedPurchaseIds] = useState<Set<string>>(new Set())

  const togglePurchase = (id: string) => {
    setExcludedPurchaseIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)

      // 1. sale_items for gross margin calc
      const { data: saleData, error: saleErr } = await supabase
        .from('sale_items')
        .select('quantity, purchase_price, total, product_name, product_id, sales!inner(status, created_at)')
        .eq('sales.status', 'completed')

      if (saleErr) console.error('sale_items:', saleErr)

      const rows: SaleItemRow[] = (saleData ?? []).map((r: any) => ({
        ...r,
        sales: Array.isArray(r.sales) ? (r.sales[0] ?? null) : r.sales,
      }))
      setItems(rows)

      // 2. purchases (all non-cancelled)
      const { data: purchData, error: purchErr } = await supabase
        .from('purchases')
        .select('id, total, payment_method, status, created_at, purchase_number, supplier:suppliers(name)')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })

      if (purchErr) console.error('purchases:', purchErr)

      const purchRows: PurchaseRow[] = (purchData ?? []).map((r: any) => ({
        ...r,
        supplier: Array.isArray(r.supplier) ? (r.supplier[0] ?? null) : r.supplier,
      }))
      setPurchases(purchRows)

      // 3. expenses
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .select('id, description, amount, category, date, payment_method')
        .order('date', { ascending: false })

      if (expErr) console.error('expenses:', expErr)
      setExpenses(expData ?? [])

      // 4. Fiado — ventas con status 'pending' (registradas como fiado en el POS)
      // Primero query simple sin join para verificar que hay registros
      const { data: fiadoData, error: fiadoErr } = await supabase
        .from('sales')
        .select('id, total, created_at, customer_id, sale_number')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (fiadoErr) {
        console.error('fiado query error:', fiadoErr)
      } else {
        console.log('fiado rows found:', fiadoData?.length, fiadoData)
      }

      // Si hay registros con customer_id, intentar traer el nombre del cliente
      const fiadoIds = (fiadoData ?? []).map((s: any) => s.customer_id).filter(Boolean)
      let customerMap: Record<string, string> = {}
      if (fiadoIds.length > 0) {
        const { data: custData } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', fiadoIds)
        for (const c of custData ?? []) {
          customerMap[c.id] = c.name
        }
      }

      const fiadoRows = (fiadoData ?? [])
        .filter((s: any) => (Number(s.total) || 0) >= 0)
        .map((s: any) => ({
          id: s.id,
          total: Number(s.total) || 0,
          created_at: s.created_at,
          customer_name: s.customer_id ? (customerMap[s.customer_id] ?? 'Cliente') : (s.sale_number ?? 'Sin cliente'),
        }))
      setFiado(fiadoRows)

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Filtered sets ───────────────────────────────────────────────────────────
  const filteredItems = useMemo(
    () => items.filter(r => r.sales?.created_at && inRange(r.sales.created_at, range)),
    [items, range]
  )
  const filteredPurchases = useMemo(
    () => purchases.filter(p => p.created_at && inRange(p.created_at, range)),
    [purchases, range]
  )
  const filteredExpenses = useMemo(
    () => expenses.filter(e => e.date && inRange(e.date, range)),
    [expenses, range]
  )
  // Fiado: NO filtramos por rango — son deudas vigentes pendientes de cobro
  const filteredFiado = fiado

  // ─── Gross KPIs ──────────────────────────────────────────────────────────────
  const { totalRevenue, totalCogs, grossProfit, grossMargin, totalUnits } = useMemo(() => {
    let rev = 0, cogs = 0, units = 0
    for (const r of filteredItems) {
      rev   += Number(r.total) || 0
      cogs  += (Number(r.purchase_price) || 0) * (Number(r.quantity) || 1)
      units += Number(r.quantity) || 1
    }
    const profit = rev - cogs
    const margin = rev > 0 ? (profit / rev) * 100 : 0
    return { totalRevenue: rev, totalCogs: cogs, grossProfit: profit, grossMargin: margin, totalUnits: units }
  }, [filteredItems])

  // ─── Net KPIs ────────────────────────────────────────────────────────────────
  const { totalPurchases, totalPurchasesExcluded, totalExpenses, totalFiado, netProfit, netMargin } = useMemo(() => {
    const activePurch = filteredPurchases.filter(p => !excludedPurchaseIds.has(p.id))
    const purch    = activePurch.reduce((s, p) => s + (Number(p.total) || 0), 0)
    const excluded = filteredPurchases.filter(p => excludedPurchaseIds.has(p.id))
                       .reduce((s, p) => s + (Number(p.total) || 0), 0)
    const exp      = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const fdo      = filteredFiado.reduce((s, f) => s + f.total, 0)
    // Net = ventas cobradas + fiado pendiente − compras activas − gastos
    const net      = totalRevenue + fdo - purch - exp
    const margin   = (totalRevenue + fdo) > 0 ? (net / (totalRevenue + fdo)) * 100 : 0
    return { totalPurchases: purch, totalPurchasesExcluded: excluded, totalExpenses: exp, totalFiado: fdo, netProfit: net, netMargin: margin }
  }, [filteredPurchases, filteredExpenses, filteredFiado, totalRevenue, excludedPurchaseIds])

  // ─── Top products (gross) ────────────────────────────────────────────────────
  const allProducts = useMemo(() => {
    const map = new Map<string, ProductStat>()
    for (const r of filteredItems) {
      const name = r.product_name ?? 'Sin nombre'
      const existing = map.get(name) ?? { product_name: name, revenue: 0, cost: 0, profit: 0, units: 0 }
      const rev  = Number(r.total) || 0
      const cost = (Number(r.purchase_price) || 0) * (Number(r.quantity) || 1)
      existing.revenue += rev
      existing.cost    += cost
      existing.profit  += rev - cost
      existing.units   += Number(r.quantity) || 1
      map.set(name, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.profit - a.profit)
  }, [filteredItems])

  const topProducts = allProducts.slice(0, 15)
  const maxProfit = topProducts.length > 0 ? Math.max(...topProducts.map(p => Math.abs(p.profit))) : 1

  // ─── Expense by category ─────────────────────────────────────────────────────
  const expByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of filteredExpenses) {
      const cat = e.category ?? 'Sin categoría'
      map.set(cat, (map.get(cat) ?? 0) + (Number(e.amount) || 0))
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [filteredExpenses])

  const RANGE_LABELS: Record<DateRange, string> = {
    '7d': 'Últimos 7 días', '30d': 'Últimos 30 días',
    '90d': 'Últimos 90 días', 'all': 'Todo el historial',
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl font-bold text-stone-900">📊 Reportes de Utilidad</h1>
          {/* Date range filter */}
          <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
            {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  range === r ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {r === 'all' ? 'Todo' : r === '7d' ? '7 días' : r === '30d' ? '30 días' : '90 días'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="max-w-5xl mx-auto mt-3 flex gap-0 border border-stone-200 rounded-lg overflow-hidden w-fit">
          <button
            onClick={() => setTab('bruta')}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              tab === 'bruta'
                ? 'bg-stone-900 text-white'
                : 'bg-white text-stone-500 hover:text-stone-800 hover:bg-stone-50'
            }`}
          >
            📈 Utilidad Bruta
          </button>
          <button
            onClick={() => setTab('neta')}
            className={`px-5 py-2 text-sm font-medium transition-colors border-l border-stone-200 ${
              tab === 'neta'
                ? 'bg-stone-900 text-white'
                : 'bg-white text-stone-500 hover:text-stone-800 hover:bg-stone-50'
            }`}
          >
            🧾 Utilidad Neta
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {loading && (
          <div className="flex justify-center py-16">
            <div className="text-stone-400 text-sm animate-pulse">Cargando datos…</div>
          </div>
        )}

        {!loading && (
          <>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">
              {RANGE_LABELS[range]}
            </p>

            {/* ══════════════════════ TAB: UTILIDAD BRUTA ══════════════════════ */}
            {tab === 'bruta' && (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Ingresos"       value={fmt(totalRevenue)} sub={`${totalUnits.toLocaleString('es-CO')} uds vendidas`} color="blue"   icon="💰" />
                  <KpiCard label="Costo de venta" value={fmt(totalCogs)}    sub="precio compra × cantidad"                              color="orange" icon="📦" />
                  <KpiCard label="Utilidad bruta" value={fmt(grossProfit)}  sub={grossProfit >= 0 ? '✅ positiva' : '⚠️ negativa'}       color={grossProfit >= 0 ? 'green' : 'red'} icon="📈" />
                  <KpiCard
                    label="Margen bruto"
                    value={pct(grossMargin)}
                    sub={grossMargin >= 30 ? 'Excelente' : grossMargin >= 15 ? 'Bueno' : grossMargin >= 0 ? 'Bajo' : 'Negativo'}
                    color={grossMargin >= 30 ? 'green' : grossMargin >= 15 ? 'blue' : grossMargin >= 0 ? 'yellow' : 'red'}
                    icon="🎯"
                  />
                </div>

                {/* Top products chart */}
                {topProducts.length > 0 ? (
                  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-100">
                      <h2 className="text-sm font-semibold text-stone-800">Top 15 productos por utilidad bruta</h2>
                      <p className="text-xs text-stone-400 mt-0.5">Hover para ver detalle</p>
                    </div>
                    <div className="px-5 pt-3 pb-1 flex gap-4 text-xs text-stone-500">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#1baf7a] inline-block" />Positiva</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#eb6834] inline-block" />Negativa</span>
                    </div>
                    <div className="px-5 pb-5 pt-2 space-y-2.5">
                      {topProducts.map(p => {
                        const barPct = maxProfit > 0 ? (Math.abs(p.profit) / maxProfit) * 100 : 0
                        const isNeg  = p.profit < 0
                        const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
                        return (
                          <div key={p.product_name} onMouseEnter={() => setHoveredProduct(p.product_name)} onMouseLeave={() => setHoveredProduct(null)}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-stone-700 font-medium truncate max-w-[55%]">{p.product_name}</span>
                              <span className={`text-xs font-semibold ${isNeg ? 'text-[#eb6834]' : 'text-[#1baf7a]'}`}>
                                {fmt(p.profit)}
                                <span className="font-normal text-stone-400 ml-1">({pct(margin)})</span>
                              </span>
                            </div>
                            <div className="relative h-5 bg-stone-100 rounded overflow-hidden">
                              <div
                                className="absolute left-0 top-0 h-full rounded transition-all duration-300"
                                style={{
                                  width: `${barPct}%`,
                                  backgroundColor: isNeg ? '#eb6834' : '#1baf7a',
                                  opacity: hoveredProduct && hoveredProduct !== p.product_name ? 0.4 : 1,
                                }}
                              />
                              {hoveredProduct === p.product_name && (
                                <div className="absolute inset-0 flex items-center px-2">
                                  <span className="text-[10px] text-white font-medium drop-shadow">
                                    Rev: {fmt(p.revenue)} · Costo: {fmt(p.cost)} · {p.units} uds
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-stone-200 px-5 py-12 text-center">
                    <p className="text-stone-400 text-sm">No hay ventas completadas en este período</p>
                  </div>
                )}

                {/* Detail table - ALL products */}
                {allProducts.length > 0 && (
                  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-stone-800">Detalle por producto</h2>
                      <span className="text-xs text-stone-400">{allProducts.length} productos</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-stone-100 bg-stone-50">
                            <th className="text-left px-5 py-2.5 font-medium text-stone-500">Producto</th>
                            <th className="text-right px-4 py-2.5 font-medium text-stone-500">Uds</th>
                            <th className="text-right px-4 py-2.5 font-medium text-stone-500">Ingresos</th>
                            <th className="text-right px-4 py-2.5 font-medium text-stone-500">Costo</th>
                            <th className="text-right px-5 py-2.5 font-medium text-stone-500">Utilidad</th>
                            <th className="text-right px-5 py-2.5 font-medium text-stone-500">Margen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allProducts.map((p, i) => {
                            const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
                            const isNeg  = p.profit < 0
                            return (
                              <tr key={p.product_name} className={`border-b border-stone-50 hover:bg-stone-50 transition-colors ${i % 2 ? 'bg-stone-50/40' : ''}`}>
                                <td className="px-5 py-3 text-stone-800 font-medium max-w-[200px] truncate">{p.product_name}</td>
                                <td className="px-4 py-3 text-right text-stone-600">{p.units.toLocaleString('es-CO')}</td>
                                <td className="px-4 py-3 text-right text-stone-700">{fmt(p.revenue)}</td>
                                <td className="px-4 py-3 text-right text-stone-500">{fmt(p.cost)}</td>
                                <td className={`px-5 py-3 text-right font-semibold ${isNeg ? 'text-[#eb6834]' : 'text-[#1baf7a]'}`}>{fmt(p.profit)}</td>
                                <td className={`px-5 py-3 text-right font-medium ${margin >= 30 ? 'text-[#1baf7a]' : margin >= 15 ? 'text-[#2a78d6]' : margin >= 0 ? 'text-[#eda100]' : 'text-[#eb6834]'}`}>{pct(margin)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold">
                            <td className="px-5 py-3 text-stone-800">Total</td>
                            <td className="px-4 py-3 text-right text-stone-700">{totalUnits.toLocaleString('es-CO')}</td>
                            <td className="px-4 py-3 text-right text-stone-700">{fmt(totalRevenue)}</td>
                            <td className="px-4 py-3 text-right text-stone-700">{fmt(totalCogs)}</td>
                            <td className={`px-5 py-3 text-right ${grossProfit >= 0 ? 'text-[#1baf7a]' : 'text-[#eb6834]'}`}>{fmt(grossProfit)}</td>
                            <td className={`px-5 py-3 text-right ${grossMargin >= 15 ? 'text-[#1baf7a]' : 'text-[#eb6834]'}`}>{pct(grossMargin)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                <p className="text-xs text-stone-400 text-center pb-2">
                  💡 Utilidad bruta = Ingresos de ventas − costo de compra registrado en cada ítem al momento de la venta.
                </p>
              </>
            )}

            {/* ══════════════════════ TAB: UTILIDAD NETA ═══════════════════════ */}
            {tab === 'neta' && (
              <>
                {/* KPI Cards — net waterfall */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <KpiCard label="Ingresos ventas"  value={fmt(totalRevenue)}   sub={`${totalUnits.toLocaleString('es-CO')} uds cobradas`}            color="blue"   icon="💰" />
                  <KpiCard label="Por cobrar (fiado)" value={fmt(totalFiado)}   sub={`${filteredFiado.length} venta${filteredFiado.length !== 1 ? 's' : ''} pendientes`} color={totalFiado > 0 ? 'yellow' : 'blue'} icon="🤝" />
                  <KpiCard label="Pagos a proveed."  value={fmt(totalPurchases)} sub={`${filteredPurchases.filter(p => !excludedPurchaseIds.has(p.id)).length} compras incluidas`} color="orange" icon="🏭" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <KpiCard label="Gastos operativos" value={fmt(totalExpenses)}  sub={`${filteredExpenses.length} gastos`} color="yellow" icon="💸" />
                  <KpiCard
                    label="Resultado neto"
                    value={fmt(netProfit)}
                    sub={netProfit >= 0 ? '✅ positivo' : '⚠️ negativo'}
                    color={netProfit >= 0 ? 'green' : 'red'}
                    icon="🏦"
                  />
                </div>

                {/* Waterfall visual */}
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-stone-100">
                    <h2 className="text-sm font-semibold text-stone-800">Resumen del período · {RANGE_LABELS[range]}</h2>
                  </div>
                  <div className="px-5 py-5 space-y-3">
                    {(() => {
                      const base = totalRevenue + totalFiado
                      const rows = [
                        { label: '(+) Ingresos cobrados',              value: totalRevenue,   color: '#1baf7a', sign: '+', note: '' },
                        ...(totalFiado > 0 ? [{ label: '(+) Por cobrar — fiado',  value: totalFiado,     color: '#2a78d6', sign: '+', note: `${filteredFiado.length} ventas pendientes` }] : []),
                        { label: '(−) Pagos a proveedores',            value: totalPurchases, color: '#eb6834', sign: '−', note: excludedPurchaseIds.size > 0 ? `${excludedPurchaseIds.size} excluidas (inv. inicial)` : '' },
                        { label: '(−) Gastos operativos',              value: totalExpenses,  color: '#eda100', sign: '−', note: '' },
                      ]
                      return rows.map(row => {
                        const barPct = base > 0 ? (row.value / base) * 100 : 0
                        return (
                          <div key={row.label}>
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="text-xs text-stone-600">{row.label}</span>
                                {row.note && <span className="ml-2 text-[10px] text-stone-400">({row.note})</span>}
                              </div>
                              <span className="text-xs font-semibold text-stone-800">{row.sign} {fmt(row.value)}</span>
                            </div>
                            <div className="h-4 bg-stone-100 rounded overflow-hidden">
                              <div className="h-full rounded" style={{ width: `${Math.min(barPct, 100)}%`, backgroundColor: row.color }} />
                            </div>
                          </div>
                        )
                      })
                    })()}
                    {/* Divider + result */}
                    <div className="border-t-2 border-stone-200 pt-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-stone-800">= Resultado neto</span>
                      <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-[#1baf7a]' : 'text-[#eb6834]'}`}>
                        {fmt(netProfit)}
                        <span className="text-xs font-normal text-stone-400 ml-2">({pct(netMargin)} margen)</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expenses by category */}
                {expByCategory.length > 0 && (
                  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-100">
                      <h2 className="text-sm font-semibold text-stone-800">Gastos por categoría</h2>
                    </div>
                    <div className="divide-y divide-stone-50">
                      {expByCategory.map(([cat, total]) => (
                        <div key={cat} className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                          <span className="text-sm text-stone-700">{cat}</span>
                          <span className="text-sm font-medium text-stone-800">{fmt(total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fiado list */}
                {filteredFiado.length > 0 && (
                  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-stone-800">🤝 Por cobrar — Fiado</h2>
                        <p className="text-xs text-stone-400 mt-0.5">Todas las ventas fiadas pendientes de cobro (sin filtro de fecha)</p>
                      </div>
                      <span className="text-sm font-bold text-blue-700">{fmt(totalFiado)}</span>
                    </div>
                    <div className="divide-y divide-stone-50">
                      {filteredFiado.map(f => (
                        <div key={f.id} className="flex items-center justify-between px-5 py-3 hover:bg-stone-50">
                          <div>
                            <p className="text-sm text-stone-700 font-medium">{f.customer_name ?? 'Cliente sin nombre'}</p>
                            <p className="text-xs text-stone-400">
                              {new Date(f.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-blue-700">{fmt(f.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Purchases list with exclusion checkboxes */}
                {filteredPurchases.length > 0 && (
                  <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-100">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-stone-800">Compras del período</h2>
                        <span className="text-xs text-stone-400">{filteredPurchases.length} compras</span>
                      </div>
                      <p className="text-xs text-stone-400 mt-1">
                        ☑️ Desmarca las que fueron <strong>inversión inicial</strong> para excluirlas del cálculo neto.
                        {excludedPurchaseIds.size > 0 && (
                          <span className="ml-2 text-amber-600 font-medium">
                            {excludedPurchaseIds.size} excluida{excludedPurchaseIds.size > 1 ? 's' : ''} · {fmt(totalPurchasesExcluded)} no contabilizados
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-stone-100 bg-stone-50">
                            <th className="px-4 py-2.5 w-8"></th>
                            <th className="text-left px-3 py-2.5 font-medium text-stone-500">Proveedor / Ref</th>
                            <th className="text-left px-4 py-2.5 font-medium text-stone-500">Fecha</th>
                            <th className="text-right px-5 py-2.5 font-medium text-stone-500">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPurchases.map((p, i) => {
                            const excluded = excludedPurchaseIds.has(p.id)
                            return (
                              <tr
                                key={p.id}
                                className={`border-b border-stone-50 hover:bg-stone-50 cursor-pointer transition-colors ${
                                  excluded ? 'bg-amber-50/60 opacity-60' : i % 2 ? 'bg-stone-50/40' : ''
                                }`}
                                onClick={() => togglePurchase(p.id)}
                              >
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={!excluded}
                                    onChange={() => togglePurchase(p.id)}
                                    onClick={e => e.stopPropagation()}
                                    className="w-3.5 h-3.5 accent-stone-700"
                                  />
                                </td>
                                <td className="px-3 py-2.5 max-w-[180px]">
                                  <span className={`font-medium ${excluded ? 'line-through text-stone-400' : 'text-stone-700'}`}>
                                    {p.supplier?.name ?? p.purchase_number ?? '—'}
                                  </span>
                                  {excluded && <span className="ml-2 text-[10px] text-amber-600 font-semibold">INVERSIÓN INICIAL</span>}
                                </td>
                                <td className="px-4 py-2.5 text-stone-500">
                                  {new Date(p.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                </td>
                                <td className={`px-5 py-2.5 text-right font-medium ${excluded ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
                                  {fmt(Number(p.total) || 0)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <p className="text-xs text-stone-400 text-center pb-2">
                  💡 Resultado neto = Ingresos cobrados + Fiado por cobrar − Compras incluidas − Gastos operativos.<br/>
                  Desmarca las compras de <strong>inversión inicial</strong> para excluirlas. No incluye depreciación ni ajustes de inventario.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  blue:   'bg-blue-50 border-blue-100 text-blue-700',
  orange: 'bg-orange-50 border-orange-100 text-orange-700',
  green:  'bg-emerald-50 border-emerald-100 text-emerald-700',
  yellow: 'bg-amber-50 border-amber-100 text-amber-700',
  red:    'bg-red-50 border-red-100 text-red-700',
}

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon: string
}) {
  return (
    <div className={`rounded-xl border p-4 ${COLOR_MAP[color] ?? COLOR_MAP['blue']}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-[11px] opacity-70 mt-1">{sub}</p>
    </div>
  )
}
