'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toColombiaDate } from '@/lib/colombia-time'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SaleItemRow {
  quantity: number
  unit_price: number
  purchase_price: number
  total: number          // revenue after discounts
  product_name: string
  product_id: string | null
  sales: { status: string; created_at: string } | null
}

interface ProductStat {
  product_name: string
  revenue: number
  cost: number
  profit: number
  units: number
}

type DateRange = '7d' | '30d' | '90d' | 'all'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const pct = (n: number) => `${n >= 0 ? '' : ''}${n.toFixed(1)}%`

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const supabase = createClient()

  const [items, setItems] = useState<SaleItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>('30d')
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: string } | null>(null)

  // ─── Load all completed sale_items ──────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('sale_items')
        .select('quantity, unit_price, purchase_price, total, product_name, product_id, sales!inner(status, created_at)')
        .eq('sales.status', 'completed')
        .order('sales(created_at)', { ascending: false })

      if (error) console.error('sale_items error:', error)

      // Normalize: Supabase may return sales as array or object
      const rows: SaleItemRow[] = (data ?? []).map((r: any) => ({
        ...r,
        sales: Array.isArray(r.sales) ? (r.sales[0] ?? null) : r.sales,
      }))
      setItems(rows)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Filter by date range ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (range === 'all') return items
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return items.filter(r => {
      if (!r.sales?.created_at) return false
      return new Date(r.sales.created_at) >= cutoff
    })
  }, [items, range])

  // ─── Aggregate KPIs ──────────────────────────────────────────────────────────
  const { totalRevenue, totalCost, grossProfit, grossMargin, totalUnits } = useMemo(() => {
    let rev = 0, cost = 0, units = 0
    for (const r of filtered) {
      rev  += Number(r.total) || 0
      cost += (Number(r.purchase_price) || 0) * (Number(r.quantity) || 1)
      units += Number(r.quantity) || 1
    }
    const profit = rev - cost
    const margin = rev > 0 ? (profit / rev) * 100 : 0
    return { totalRevenue: rev, totalCost: cost, grossProfit: profit, grossMargin: margin, totalUnits: units }
  }, [filtered])

  // ─── Top products by profit ───────────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const map = new Map<string, ProductStat>()
    for (const r of filtered) {
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
    return Array.from(map.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 15)
  }, [filtered])

  const maxProfit = topProducts.length > 0 ? Math.max(...topProducts.map(p => Math.abs(p.profit))) : 1

  const RANGE_LABELS: Record<DateRange, string> = {
    '7d': 'Últimos 7 días',
    '30d': 'Últimos 30 días',
    '90d': 'Últimos 90 días',
    'all': 'Todo el historial',
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-stone-900">📊 Reportes de Utilidad</h1>
            <p className="text-sm text-stone-500 mt-0.5">Ventas completadas · calculado a partir de precio de compra en el momento de la venta</p>
          </div>
          {/* Date range filter */}
          <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
            {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  range === r
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {r === 'all' ? 'Todo' : r === '7d' ? '7 días' : r === '30d' ? '30 días' : '90 días'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="text-stone-400 text-sm animate-pulse">Cargando datos…</div>
          </div>
        )}

        {!loading && (
          <>
            {/* Period label */}
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">
              {RANGE_LABELS[range]} · {filtered.length.toLocaleString('es-CO')} ítems vendidos
            </p>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label="Ingresos"
                value={fmt(totalRevenue)}
                sub={`${totalUnits.toLocaleString('es-CO')} unidades`}
                color="blue"
                icon="💰"
              />
              <KpiCard
                label="Costo"
                value={fmt(totalCost)}
                sub="precio compra × unidades"
                color="orange"
                icon="📦"
              />
              <KpiCard
                label="Utilidad bruta"
                value={fmt(grossProfit)}
                sub={grossProfit >= 0 ? '✅ positiva' : '⚠️ negativa'}
                color={grossProfit >= 0 ? 'green' : 'red'}
                icon="📈"
              />
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
                  <h2 className="text-sm font-semibold text-stone-800">Top productos por utilidad</h2>
                  <p className="text-xs text-stone-400 mt-0.5">Barras = utilidad bruta por producto · {RANGE_LABELS[range]}</p>
                </div>

                {/* Legend */}
                <div className="px-5 pt-3 pb-1 flex gap-4 text-xs text-stone-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#1baf7a] inline-block" />Utilidad positiva</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#eb6834] inline-block" />Utilidad negativa</span>
                </div>

                {/* Bars */}
                <div className="px-5 pb-5 pt-2 space-y-2.5">
                  {topProducts.map(p => {
                    const barPct = maxProfit > 0 ? (Math.abs(p.profit) / maxProfit) * 100 : 0
                    const isNeg = p.profit < 0
                    const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0

                    return (
                      <div
                        key={p.product_name}
                        className="group"
                        onMouseEnter={() => setHoveredProduct(p.product_name)}
                        onMouseLeave={() => setHoveredProduct(null)}
                      >
                        {/* Product label row */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-stone-700 font-medium truncate max-w-[55%]">{p.product_name}</span>
                          <span className={`text-xs font-semibold ${isNeg ? 'text-[#eb6834]' : 'text-[#1baf7a]'}`}>
                            {fmt(p.profit)}
                            <span className="font-normal text-stone-400 ml-1">({pct(margin)})</span>
                          </span>
                        </div>
                        {/* Bar */}
                        <div className="relative h-5 bg-stone-100 rounded overflow-hidden">
                          <div
                            className="absolute left-0 top-0 h-full rounded transition-all duration-300"
                            style={{
                              width: `${barPct}%`,
                              backgroundColor: isNeg ? '#eb6834' : '#1baf7a',
                              opacity: hoveredProduct && hoveredProduct !== p.product_name ? 0.5 : 1,
                            }}
                          />
                          {/* Hover detail inside bar */}
                          {hoveredProduct === p.product_name && (
                            <div className="absolute inset-0 flex items-center px-2 gap-3">
                              <span className="text-[10px] text-white font-medium">
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

            {/* Detail table */}
            {topProducts.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100">
                  <h2 className="text-sm font-semibold text-stone-800">Detalle por producto</h2>
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
                      {topProducts.map((p, i) => {
                        const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
                        const isNeg = p.profit < 0
                        return (
                          <tr
                            key={p.product_name}
                            className={`border-b border-stone-50 hover:bg-stone-50 transition-colors ${i % 2 === 0 ? '' : 'bg-stone-50/40'}`}
                          >
                            <td className="px-5 py-3 text-stone-800 font-medium max-w-[200px] truncate">{p.product_name}</td>
                            <td className="px-4 py-3 text-right text-stone-600">{p.units.toLocaleString('es-CO')}</td>
                            <td className="px-4 py-3 text-right text-stone-700">{fmt(p.revenue)}</td>
                            <td className="px-4 py-3 text-right text-stone-500">{fmt(p.cost)}</td>
                            <td className={`px-5 py-3 text-right font-semibold ${isNeg ? 'text-[#eb6834]' : 'text-[#1baf7a]'}`}>
                              {fmt(p.profit)}
                            </td>
                            <td className={`px-5 py-3 text-right font-medium ${
                              margin >= 30 ? 'text-[#1baf7a]' :
                              margin >= 15 ? 'text-[#2a78d6]' :
                              margin >= 0  ? 'text-[#eda100]' :
                              'text-[#eb6834]'
                            }`}>
                              {pct(margin)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {/* Totals footer */}
                    <tfoot>
                      <tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold">
                        <td className="px-5 py-3 text-stone-800">Total</td>
                        <td className="px-4 py-3 text-right text-stone-700">{totalUnits.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-3 text-right text-stone-700">{fmt(totalRevenue)}</td>
                        <td className="px-4 py-3 text-right text-stone-700">{fmt(totalCost)}</td>
                        <td className={`px-5 py-3 text-right ${grossProfit >= 0 ? 'text-[#1baf7a]' : 'text-[#eb6834]'}`}>
                          {fmt(grossProfit)}
                        </td>
                        <td className={`px-5 py-3 text-right ${grossMargin >= 15 ? 'text-[#1baf7a]' : 'text-[#eb6834]'}`}>
                          {pct(grossMargin)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Note */}
            <p className="text-xs text-stone-400 text-center pb-2">
              💡 La utilidad se calcula con el <strong>precio de compra en el momento de la venta</strong> registrado en cada ítem, no el precio de compra actual del producto.
            </p>
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

function KpiCard({
  label, value, sub, color, icon,
}: {
  label: string
  value: string
  sub: string
  color: string
  icon: string
}) {
  const cls = COLOR_MAP[color] ?? COLOR_MAP['blue']
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-[11px] opacity-70 mt-1">{sub}</p>
    </div>
  )
}
