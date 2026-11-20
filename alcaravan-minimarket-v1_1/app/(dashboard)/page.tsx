'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import DashboardClient from './dashboard-client'

interface DashboardData {
  todayTotal: number
  todayCount: number
  monthTotal: number
  avgTicket: number
  lowStockCount: number
  openRegister: { opening_amount: number; total_sales: number } | null
  recentSales: Array<{
    id: string
    sale_number: string
    total: number
    status: string
    created_at: string
    customer?: { first_name?: string; last_name?: string } | null
  }>
  topProducts: Array<{ product_name: string; quantity: number; total: number }>
}

async function fetchDashboardData(): Promise<DashboardData> {
  const supabase = createClient()

  // Fecha de hoy en Colombia (UTC-5)
  const now = new Date()
  const colombiaOffset = -5 * 60
  const utcMinutes = now.getTime() / 60000 + now.getTimezoneOffset()
  const colombiaDate = new Date((utcMinutes + colombiaOffset) * 60000)
  colombiaDate.setHours(0, 0, 0, 0)
  // Rango UTC del día colombiano
  const todayColombiaStart = new Date(colombiaDate.getTime() - colombiaOffset * 60000)
  const todayStr = todayColombiaStart.toISOString()
  const tomorrowStr = new Date(todayColombiaStart.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const startOfMonth = new Date(colombiaDate.getFullYear(), colombiaDate.getMonth(), 1)
  const startOfMonthUTC = new Date(startOfMonth.getTime() - colombiaOffset * 60000)
  const startOfMonthStr = startOfMonthUTC.toISOString()

  const [
    { data: todaySales },
    { data: monthSales },
    { data: lowStockProducts },
    { data: openSession },
    { data: recentSales },
    { data: topProducts },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', todayStr)
      .lt('created_at', tomorrowStr),

    supabase
      .from('sales')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', startOfMonthStr),

    // stock bajo: PostgREST no soporta comparar columnas entre sí,
    // así que traemos todos y filtramos en cliente
    supabase
      .from('products')
      .select('id, stock, min_stock')
      .eq('is_active', true),

    // ✅ CORRECTO: usar cash_sessions (no cash_registers)
    supabase
      .from('cash_sessions')
      .select('id, opening_amount, status, opened_at')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('sales')
      .select('id, sale_number, total, status, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(8),

    supabase
      .from('sale_items')
      .select('product_name, quantity, total')
      .order('quantity', { ascending: false })
      .limit(5),
  ])

  // Filtrar stock bajo manualmente (lt en columna calculada no siempre funciona vía PostgREST)
  const lowStock = (lowStockProducts ?? []).filter(
    (p) => p.stock != null && p.min_stock != null && p.stock <= p.min_stock
  )

  const todayTotal = (todaySales ?? []).reduce((sum, s) => sum + s.total, 0)
  const todayCount = todaySales?.length ?? 0
  const monthTotal = (monthSales ?? []).reduce((sum, s) => sum + s.total, 0)

  return {
    todayTotal,
    todayCount,
    monthTotal,
    avgTicket: todayCount > 0 ? todayTotal / todayCount : 0,
    lowStockCount: lowStock.length,
    openRegister: openSession
      ? {
          opening_amount: openSession.opening_amount ?? 0,
          total_sales: todayTotal, // ventas de hoy = efectivo acumulado esperado
        }
      : null,
    recentSales: recentSales ?? [],
    topProducts: topProducts ?? [],
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    todayTotal: 0,
    todayCount: 0,
    monthTotal: 0,
    avgTicket: 0,
    lowStockCount: 0,
    openRegister: null,
    recentSales: [],
    topProducts: [],
  })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const d = await fetchDashboardData()
      setData(d)
    } catch (err) {
      console.error('Error cargando dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    // Refrescar al volver a la pestaña (el usuario abre/cierra la caja y regresa)
    const handleFocus = () => refresh()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    // También refrescar cada 60 segundos por si acaso
    const interval = setInterval(refresh, 60_000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(interval)
    }
  }, [refresh])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <DashboardClient data={data} />
}
