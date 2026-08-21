'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) {
      setError('No se pudo enviar el correo. Verifica el email.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-800 via-amber-900 to-stone-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-3xl mb-2">☕</p>
          <h1 className="text-xl font-bold text-stone-800">Recuperar contraseña</h1>
          <p className="text-stone-500 text-sm mt-1">ALCARAVÁN MINIMARKET CAFÉ</p>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-4xl mb-3">📧</p>
            <p className="font-semibold text-stone-800 mb-2">¡Correo enviado!</p>
            <p className="text-stone-500 text-sm">Revisa tu bandeja de entrada en <strong>{email}</strong> y sigue el enlace para crear una nueva contraseña.</p>
            <a href="/login" className="block mt-6 text-amber-700 hover:underline text-sm">← Volver al login</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>

            <a href="/login" className="block text-center text-stone-500 hover:text-stone-700 text-sm">← Volver al login</a>
          </form>
        )}
      </div>
    </div>
  )
}
