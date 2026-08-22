import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import DashboardClient from './dashboard-client'

async function getDashboardData() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const [
    { data: todaySales },
    { data: monthSales },
    { data: lowStockProducts },
    { data: openRegister },
    { data: recentSales },
    { data: topProducts },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('total, tax_amount, subtotal')
      .eq('status', 'completed')
      .gte('created_at', todayStr),

    supabase
      .from('sales')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', startOfMonth),

    supabase
      .from('products')
      .select('id, name, stock, min_stock')
      .eq('is_active', true)
      .limit(5),

    supabase
      .from('cash_registers')
      .select('*')
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

  const todayTotal = todaySales?.reduce((sum, s) => sum + s.total, 0) ?? 0
  const todayCount = todaySales?.length ?? 0
  const monthTotal = monthSales?.reduce((sum, s) => sum + s.total, 0) ?? 0

  return {
    todayTotal,
    todayCount,
    monthTotal,
    avgTicket: todayCount > 0 ? todayTotal / todayCount : 0,
    lowStockCount: lowStockProducts?.length ?? 0,
    openRegister: openRegister ?? null,
    recentSales: recentSales ?? [],
    topProducts: topProducts ?? [],
  }
}

export default async function DashboardPage() {
  let data
  try {
    data = await getDashboardData()
  } catch {
    // Fallback con datos vacíos si no hay conexión con Supabase
    data = {
      todayTotal: 0,
      todayCount: 0,
      monthTotal: 0,
      avgTicket: 0,
      lowStockCount: 0,
      openRegister: null,
      recentSales: [],
      topProducts: [],
    }
  }

  return <DashboardClient data={data} />
}
