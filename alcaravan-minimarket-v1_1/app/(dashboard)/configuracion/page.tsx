'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ConfigurationPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'business' | 'taxes' | 'pos' | 'users'>('business')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [businessInfo, setBusinessInfo] = useState({
    name: 'ALCARAVÁN MINIMARKET CAFÉ',
    nit: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
  })
  const [taxConfig, setTaxConfig] = useState({
    iva_rate: 19,
    apply_iva: false,
    tax_regime: 'simplified',
  })
  const [posConfig, setPosConfig] = useState({
    require_customer: false,
    print_receipt: true,
    allow_negative_stock: false,
  })

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('settings')
        .select('key, value')

      if (!data) return

      data.forEach((s) => {
        if (s.key === 'business_info') setBusinessInfo(s.value as typeof businessInfo)
        if (s.key === 'tax_config') setTaxConfig(s.value as typeof taxConfig)
        if (s.key === 'pos_config') setPosConfig(s.value as typeof posConfig)
      })
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const updates = [
      { key: 'business_info', value: businessInfo },
      { key: 'tax_config', value: taxConfig },
      { key: 'pos_config', value: posConfig },
    ]
    for (const u of updates) {
      await supabase.from('settings').upsert({ key: u.key, value: u.value }, { onConflict: 'branch_id,key' })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Configuración</h1>
        <p className="text-stone-500 text-sm">Configura los parámetros del sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6 w-fit">
        {[
          { key: 'business', label: '🏪 Negocio' },
          { key: 'taxes', label: '💰 Impuestos' },
          { key: 'pos', label: '🛒 POS' },
          { key: 'users', label: '👥 Usuarios' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        {activeTab === 'business' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-stone-800 mb-4">Información del Negocio</h2>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nombre del negocio</label>
              <input
                type="text"
                value={businessInfo.name}
                onChange={(e) => setBusinessInfo((b) => ({ ...b, name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">NIT</label>
                <input
                  type="text"
                  value={businessInfo.nit}
                  onChange={(e) => setBusinessInfo((b) => ({ ...b, nit: e.target.value }))}
                  placeholder="900.000.000-0"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={businessInfo.phone}
                  onChange={(e) => setBusinessInfo((b) => ({ ...b, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Dirección</label>
              <input
                type="text"
                value={businessInfo.address}
                onChange={(e) => setBusinessInfo((b) => ({ ...b, address: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={businessInfo.email}
                onChange={(e) => setBusinessInfo((b) => ({ ...b, email: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>
          </div>
        )}

        {activeTab === 'taxes' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-stone-800 mb-4">Configuración de Impuestos</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              ⚠️ La facturación electrónica con la DIAN se habilitará en la Fase 6 mediante un proveedor tecnológico autorizado.
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Régimen tributario</label>
              <select
                value={taxConfig.tax_regime}
                onChange={(e) => setTaxConfig((t) => ({ ...t, tax_regime: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700 bg-white"
              >
                <option value="simplified">Régimen Simplificado</option>
                <option value="common">Régimen Común</option>
                <option value="special">Régimen Especial</option>
              </select>
            </div>
            <label className="flex items-center gap-3 p-4 rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
              <input
                type="checkbox"
                checked={taxConfig.apply_iva}
                onChange={(e) => setTaxConfig((t) => ({ ...t, apply_iva: e.target.checked }))}
                className="rounded accent-amber-700 w-4 h-4"
              />
              <div>
                <p className="text-sm font-medium text-stone-700">Aplicar IVA en ventas</p>
                <p className="text-xs text-stone-400">Activa el cálculo automático de IVA en el POS</p>
              </div>
            </label>
            {taxConfig.apply_iva && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Tasa de IVA por defecto (%)</label>
                <input
                  type="number"
                  value={taxConfig.iva_rate}
                  onChange={(e) => setTaxConfig((t) => ({ ...t, iva_rate: parseFloat(e.target.value) || 0 }))}
                  min="0" max="100"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-700"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'pos' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-stone-800 mb-4">Configuración del POS</h2>
            {[
              { key: 'require_customer', label: 'Requerir cliente en ventas', desc: 'Obliga a seleccionar un cliente antes de cobrar' },
              { key: 'print_receipt', label: 'Imprimir comprobante automáticamente', desc: 'Envía a la impresora al confirmar la venta' },
              { key: 'allow_negative_stock', label: 'Permitir ventas con stock negativo', desc: 'Permite vender productos sin stock disponible' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-center gap-3 p-4 rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={posConfig[key as keyof typeof posConfig] as boolean}
                  onChange={(e) => setPosConfig((p) => ({ ...p, [key]: e.target.checked }))}
                  className="rounded accent-amber-700 w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium text-stone-700">{label}</p>
                  <p className="text-xs text-stone-400">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 className="font-semibold text-stone-800 mb-4">Gestión de Usuarios</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              💡 La gestión de usuarios se hace directamente desde el panel de Supabase → Authentication → Users.
              Desde allí puedes invitar nuevos usuarios, cambiar contraseñas y desactivar cuentas.
            </div>
            <div className="mt-4 grid gap-3">
              {[
                { role: 'Administrador', desc: 'Acceso completo al sistema', icon: '👑' },
                { role: 'Cajero', desc: 'POS, caja y consulta de productos', icon: '🛒' },
                { role: 'Inventario', desc: 'Productos, compras y proveedores', icon: '📦' },
                { role: 'Cocina', desc: 'Pedidos y producción', icon: '👨‍🍳' },
                { role: 'Domiciliario', desc: 'Gestión de domicilios', icon: '🚚' },
              ].map(({ role, desc, icon }) => (
                <div key={role} className="flex items-center gap-3 p-4 rounded-xl border border-stone-200">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-medium text-stone-800">{role}</p>
                    <p className="text-xs text-stone-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botón guardar */}
        {activeTab !== 'users' && (
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white font-bold rounded-xl transition-colors shadow-sm"
            >
              {saving ? 'Guardando...' : '💾 Guardar Cambios'}
            </button>
            {saved && (
              <span className="text-emerald-600 text-sm font-medium animate-fade-in">
                ✅ Cambios guardados correctamente
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
