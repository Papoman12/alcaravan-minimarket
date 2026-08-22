'use client'

import { formatCurrency, formatDateTime } from '@/lib/utils'

interface StatCardProps {
  icon: string
  label: string
  value: string
  subtitle?: string
  color: 'amber' | 'green' | 'blue' | 'red' | 'purple' | 'orange'
  trend?: { value: number; positive: boolean }
}

function StatCard({ icon, label, value, subtitle, color, trend }: StatCardProps) {
  const colorMap = {
    amber: 'bg-amber-50 border-amber-200',
    green: 'bg-emerald-50 border-emerald-200',
    blue: 'bg-blue-50 border-blue-200',
    red: 'bg-red-50 border-red-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  }
  const iconBg = {
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className={`rounded-2xl border p-5 ${colorMap[color]} animate-fade-in`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${iconBg[color]}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend.positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-stone-800 tabular-nums">{value}</p>
        <p className="text-sm font-medium text-stone-600 mt-0.5">{label}</p>
        {subtitle && <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

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

export default function DashboardClient({ data }: { data: DashboardData }) {
  const {
    todayTotal,
    todayCount,
    monthTotal,
    avgTicket,
    lowStockCount,
    openRegister,
    recentSales,
    topProducts,
  } = data

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Buenos días' : today.getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">{greeting} 👋</h1>
        <p className="text-stone-500 text-sm mt-1">
          {today.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Alerta de caja */}
      {!openRegister && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div className="flex-1">
            <p className="font-semibold text-amber-800">No hay caja abierta</p>
            <p className="text-sm text-amber-700">Abre la caja del día antes de iniciar ventas</p>
          </div>
          <a
            href="/caja"
            className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors"
          >
            Abrir Caja
          </a>
        </div>
      )}

      {/* Alertas de inventario */}
      {lowStockCount > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold text-red-800">{lowStockCount} productos con stock bajo</p>
            <p className="text-sm text-red-700">Revisa el inventario para evitar quiebres de stock</p>
          </div>
          <a
            href="/inventario"
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors"
          >
            Ver Inventario
          </a>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon="💵"
          label="Ventas Hoy"
          value={formatCurrency(todayTotal)}
          subtitle={`${todayCount} transacciones`}
          color="amber"
        />
        <StatCard
          icon="📅"
          label="Ventas del Mes"
          value={formatCurrency(monthTotal)}
          color="green"
        />
        <StatCard
          icon="🎫"
          label="Ticket Promedio"
          value={formatCurrency(avgTicket)}
          color="blue"
        />
        <StatCard
          icon="💰"
          label="Caja Actual"
          value={openRegister ? formatCurrency(openRegister.opening_amount + (openRegister.total_sales || 0)) : 'Cerrada'}
          subtitle={openRegister ? 'Caja abierta' : 'Sin sesión activa'}
          color={openRegister ? 'purple' : 'red'}
        />
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { href: '/pos', icon: '🛒', label: 'Nueva Venta', color: 'bg-amber-700 hover:bg-amber-800 text-white' },
          { href: '/productos/nuevo', icon: '📦', label: 'Agregar Producto', color: 'bg-emerald-700 hover:bg-emerald-800 text-white' },
          { href: '/clientes/nuevo', icon: '👤', label: 'Nuevo Cliente', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
          { href: '/caja', icon: '💰', label: 'Control de Caja', color: 'bg-stone-700 hover:bg-stone-800 text-white' },
        ].map((action) => (
          <a
            key={action.href}
            href={action.href}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium text-sm transition-all duration-150 shadow-sm active:scale-[0.97] ${action.color}`}
          >
            <span className="text-xl">{action.icon}</span>
            <span>{action.label}</span>
          </a>
        ))}
      </div>

      {/* Tablas */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Ventas recientes */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-800">Ventas Recientes</h3>
            <a href="/reportes" className="text-xs text-amber-700 hover:underline font-medium">Ver todas →</a>
          </div>
          <div className="divide-y divide-stone-50">
            {recentSales.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-stone-400 text-sm">No hay ventas hoy</p>
                <a href="/pos" className="text-amber-700 text-sm hover:underline mt-1 inline-block">
                  Crear primera venta →
                </a>
              </div>
            ) : (
              recentSales.map((sale) => (
                <div key={sale.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-stone-50/50 transition-colors">
                  <div>
                    <p className="font-medium text-stone-800 text-sm">{sale.sale_number}</p>
                    <p className="text-xs text-stone-400">
                      {sale.customer ? `${sale.customer.first_name} ${sale.customer.last_name ?? ''}` : 'Cliente mostrador'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-stone-800 text-sm">{formatCurrency(sale.total)}</p>
                    <p className="text-[10px] text-stone-400">
                      {new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Resumen del día */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h3 className="font-semibold text-stone-800">Resumen del Día</h3>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: 'Total en ventas', value: formatCurrency(todayTotal), icon: '💵' },
              { label: 'Número de ventas', value: todayCount.toString(), icon: '🧾' },
              { label: 'Ticket promedio', value: formatCurrency(avgTicket), icon: '🎫' },
              { label: 'Productos con stock bajo', value: lowStockCount.toString(), icon: '⚠️', alert: lowStockCount > 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm text-stone-600">{item.label}</span>
                </div>
                <span className={`font-bold text-sm ${item.alert ? 'text-red-600' : 'text-stone-800'}`}>
                  {item.value}
                </span>
              </div>
            ))}

            <a
              href="/pos"
              className="block w-full text-center py-3 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-xl transition-colors mt-2 shadow-sm shadow-amber-700/30"
            >
              🛒 Ir al Punto de Venta
            </a>
          </div>
        </div>
      </div>

      {/* Branding footer */}
      <p className="text-center text-stone-300 text-xs mt-8">
        ALCARAVÁN MINIMARKET CAFÉ · Sistema de Gestión · Fase 1 MVP
      </p>
    </div>
  )
}
