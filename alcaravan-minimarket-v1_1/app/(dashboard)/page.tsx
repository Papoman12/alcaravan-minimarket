import { createClient } from '@/lib/supabase/server'
import DashboardClient from './dashboard-client'

// Fuerza Next.js a consultar datos frescos en cada visita (sin caché)
export const dynamic = 'force-dynamic'

// Colombia es UTC-5. Devuelve el inicio del día de hoy en Colombia como fecha UTC.
// Ej: si son las 2am UTC del dia 20, en Colombia es aun el dia 19 (19:00 Colombia).
//     Midnight Colombia = 05:00 UTC del mismo dia Colombia.
function getColombiaStartOfDay(): Date {
  const colombiaOffsetMs = 5 * 60 * 60 * 1000 // UTC-5 en milisegundos
  const now = new Date()
  // Hora actual en Colombia
  const nowColombia = new Date(now.getTime() - colombiaOffsetMs)
  // Poner a medianoche en Colombia (setUTCHours sobre la fecha ajustada)
  nowColombia.setUTCHours(0, 0, 0, 0)
  // Convertir de vuelta a UTC (sumar 5h)
  return new Date(nowColombia.getTime() + colombiaOffsetMs)
}

function getColombiaStartOfMonth(): Date {
  const colombiaOffsetMs = 5 * 60 * 60 * 1000
  const now = new Date()
  const nowColombia = new Date(now.getTime() - colombiaOffsetMs)
  // Primer día del mes en Colombia
  const firstDay = new Date(Date.UTC(nowColombia.getUTCFullYear(), nowColombia.getUTCMonth(), 1))
  return new Date(firstDay.getTime() + colombiaOffsetMs)
}

async function getDashboardData() {
  const supabase = await createClient()

  const todayStr = getColombiaStartOfDay().toISOString()
  const startOfMonthStr = getColombiaStartOfMonth().toISOString()

  const [
    { data: todaySales },
    { data: monthSales },
    { data: allProducts },
    { data: openRegister },
    { data: recentSales },
    { data: topProducts },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', todayStr),

    supabase
      .from('sales')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', startOfMonthStr),

    // Traemos todos para filtrar stock bajo (PostgREST no soporta comparar columnas entre sí)
    supabase
      .from('products')
      .select('stock, min_stock')
      .eq('is_active', true),

    // ✅ CORRECTO: cash_sessions (no cash_registers)
    supabase
      .from('cash_sessions')
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

  const todayTotal = todaySales?.reduce((sum, s) => sum + (s.total ?? 0), 0) ?? 0
  const todayCount = todaySales?.length ?? 0
  const monthTotal = monthSales?.reduce((sum, s) => sum + (s.total ?? 0), 0) ?? 0

  // Stock bajo: productos donde stock <= min_stock
  const lowStockCount = (allProducts ?? []).filter(
    (p) => p.stock != null && p.min_stock != null && p.stock <= p.min_stock
  ).length

  return {
    todayTotal,
    todayCount,
    monthTotal,
    avgTicket: todayCount > 0 ? todayTotal / todayCount : 0,
    lowStockCount,
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
