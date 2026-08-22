'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'last_month'

export default function ReportsPage() {
  const supabase = createClient()
  const [period, setPeriod] = useState<Period>('today')
  const [activeReport, setActiveReport] = useState<'sales' | 'products' | 'payments'>('sales')
  const [salesData, setSalesData] = useState<{
    id: string; sale_number: string; total: number; created_at: string;
    customer?: { full_name: string } | null; items_count?: number
  }[]>([])
  const [productSales, setProductSales] = useState<{
    product_name: string; total_qty: number; total_revenue: number; times_sold: number
  }[]>([])
  const [paymentSummary, setPaymentSummary] = useState<{
    payment_method: string; total: number; count: number
  }[]>([])
  const [totals, setTotals] = useState({ revenue: 0, count: 0, profit: 0 })
  const [loading, setLoading] = useState(false)

  function getDateRange(p: Period): { from: string; to: string } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (p) {
      case 'today':
        return { from: today.toISOString(), to: new Date(today.getTime() + 86400000).toISOString() }
      case 'yesterday': {
        const y = new Date(today.getTime() - 86400000)
        return { from: y.toISOString(), to: today.toISOString() }
      }
      case 'week': {
        const w = new Date(today.getTime() - 7 * 86400000)
        return { from: w.toISOString(), to: new Date(today.getTime() + 86400000).toISOString() }
      }
      case 'month': {
        const m = new Date(now.getFullYear(), now.getMonth(), 1)
        return { from: m.toISOString(), to: new Date(today.getTime() + 86400000).toISOString() }
      }
      case 'last_month': {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lme = new Date(now.getFullYear(), now.getMonth(), 1)
        return { from: lm.toISOString(), to: lme.toISOString() }
      }
    }
  }

  async function loadReport() {
    setLoading(true)
    const { from, to } = getDateRange(period)

    const { data: sales } = await supabase
      .from('sales')
      .select('id, sale_number, total, created_at')
      .eq('status', 'completed')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })

    setSalesData((sales ?? []).map((s) => ({ ...s, customer: null })))

    const revenue = sales?.reduce((s, sale) => s + sale.total, 0) ?? 0
    setTotals({
      revenue,
      count: sales?.length ?? 0,
      profit: revenue * 0.3, // estimado - en producción calcular del costo real
    })

    // Productos más vendidos
    const { data: items } = await supabase
      .from('sale_items')
      .select('product_name, quantity, total, sale:sales!inner(status, created_at)')
      .gte('sale.created_at', from)
      .lt('sale.created_at', to)

    if (items) {
      const grouped = items.reduce((acc, item) => {
        const key = item.product_name
        if (!acc[key]) acc[key] = { product_name: key, total_qty: 0, total_revenue: 0, times_sold: 0 }
        acc[key].total_qty += item.quantity
        acc[key].total_revenue += item.total
        acc[key].times_sold += 1
        return acc
      }, {} as Record<string, { product_name: string; total_qty: number; total_revenue: number; times_sold: number }>)

      setProductSales(Object.values(grouped).sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 20))
    }

    // Métodos de pago
    const { data: payments } = await supabase
      .from('sale_payments')
      .select('payment_method, amount, sale:sales!inner(status, created_at)')
      .gte('sale.created_at', from)
      .lt('sale.created_at', to)

    if (payments) {
      const grouped = payments.reduce((acc, p) => {
        const key = p.payment_method
        if (!acc[key]) acc[key] = { payment_method: key, total: 0, count: 0 }
        acc[key].total += p.amount
        acc[key].count += 1
        return acc
      }, {} as Record<string, { payment_method: string; total: number; count: number }>)

      setPaymentSummary(Object.values(grouped).sort((a, b) => b.total - a.total))
    }

    setLoading(false)
  }

  useEffect(() => { loadReport() }, [period])

  const PERIOD_LABELS: Record<Period, string> = {
    today: 'Hoy',
    yesterday: 'Ayer',
    week: 'Últimos 7 días',
    month: 'Este mes',
    last_month: 'Mes anterior',
  }

  const PAYMENT_LABELS: Record<string, string> = {
    cash: '💵 Efectivo',
    card_debit: '💳 Débito',
    card_credit: '💳 Crédito',
    transfer: '🏦 Transferencia',
    nequi: '📱 Nequi',
    daviplata: '📱 Daviplata',
    bancolombia: '🏦 Bancolombia',
    other: '💰 Otro',
    loyalty_points: '⭐ Puntos',
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Reportes</h1>
      </div>

      {/* Filtros de período */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              period === key
                ? 'bg-amber-700 text-white shadow-sm'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-stone-800 tabular-nums">{formatCurrency(totals.revenue)}</p>
          <p className="text-sm text-stone-500 mt-0.5">Total vendido</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-stone-800 tabular-nums">{totals.count}</p>
          <p className="text-sm text-stone-500 mt-0.5">Transacciones</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-stone-800 tabular-nums">
            {formatCurrency(totals.count > 0 ? totals.revenue / totals.count : 0)}
          </p>
          <p className="text-sm text-stone-500 mt-0.5">Ticket promedio</p>
        </div>
      </div>

      {/* Tabs de reportes */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-4 w-fit">
        {[
          { key: 'sales', label: '🧾 Ventas' },
          { key: 'products', label: '📦 Productos' },
          { key: 'payments', label: '💳 Pagos' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveReport(tab.key as typeof activeReport)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeReport === tab.key
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="w-8 h-8 border-3 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeReport === 'sales' && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              {salesData.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-2">📊</p>
                  <p className="text-stone-400">No hay ventas en este período</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="text-left px-4 py-3 font-semibold text-stone-600">Factura</th>
                        <th className="text-left px-4 py-3 font-semibold text-stone-600">Fecha</th>
                        <th className="text-left px-4 py-3 font-semibold text-stone-600">Cliente</th>
                        <th className="text-right px-4 py-3 font-semibold text-stone-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {salesData.map((sale) => (
                        <tr key={sale.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3 font-medium text-stone-800">{sale.sale_number}</td>
                          <td className="px-4 py-3 text-stone-500 text-xs">{formatDate(sale.created_at)}</td>
                          <td className="px-4 py-3 text-stone-600">
                            {(sale as any).customer?.full_name ?? 'Mostrador'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-stone-800">
                            {formatCurrency(sale.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-50 border-t-2 border-amber-200">
                        <td colSpan={3} className="px-4 py-3 font-bold text-stone-800">TOTAL</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700 text-lg">
                          {formatCurrency(totals.revenue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeReport === 'products' && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="text-left px-4 py-3 font-semibold text-stone-600">Producto</th>
                      <th className="text-right px-4 py-3 font-semibold text-stone-600">Cantidad</th>
                      <th className="text-right px-4 py-3 font-semibold text-stone-600">Ventas</th>
                      <th className="text-right px-4 py-3 font-semibold text-stone-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {productSales.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-10 text-stone-400">Sin datos</td></tr>
                    ) : productSales.map((p, i) => (
                      <tr key={p.product_name} className="hover:bg-stone-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-stone-100 rounded text-xs flex items-center justify-center font-bold text-stone-500">
                              {i + 1}
                            </span>
                            <span className="font-medium text-stone-800">{p.product_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-stone-600">{p.total_qty}</td>
                        <td className="px-4 py-3 text-right text-stone-500">{p.times_sold}</td>
                        <td className="px-4 py-3 text-right font-bold text-stone-800">
                          {formatCurrency(p.total_revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'payments' && (
            <div className="grid md:grid-cols-2 gap-4">
              {paymentSummary.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center col-span-2">
                  <p className="text-stone-400">Sin datos de pagos en este período</p>
                </div>
              ) : paymentSummary.map((p) => (
                <div key={p.payment_method} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-700">
                      {PAYMENT_LABELS[p.payment_method] ?? p.payment_method}
                    </span>
                    <span className="text-xs text-stone-400 bg-stone-100 px-2 py-1 rounded-lg">
                      {p.count} transacciones
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-stone-800 mt-2">{formatCurrency(p.total)}</p>
                  <div className="mt-2 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.min(100, (p.total / totals.revenue) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    {totals.revenue > 0 ? ((p.total / totals.revenue) * 100).toFixed(1) : 0}% del total
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
