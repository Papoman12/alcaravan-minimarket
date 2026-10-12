'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleReset() {
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-stone-800 mb-1">Recuperar contraseña</h1>
        <p className="text-sm text-stone-500 mb-6">
          Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        {sent ? (
          <div className="bg-emerald-50 text-emerald-700 rounded-xl px-4 py-3 text-sm">
            ✅ Revisa tu correo — te enviamos el enlace de recuperación.
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleReset}
              disabled={!email}
              className="w-full py-2.5 bg-amber-700 text-white rounded-xl font-semibold hover:bg-amber-800 disabled:bg-stone-300 transition-colors"
            >
              Enviar enlace
            </button>

            <a
              href="/login"
              className="block text-center text-sm text-stone-500 hover:text-stone-700 mt-4"
            >
              ← Volver al inicio de sesión
            </a>
          </>
        )}
      </div>
    </div>
  )
}
