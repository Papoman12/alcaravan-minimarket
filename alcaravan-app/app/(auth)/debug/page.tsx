'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SUPABASE_URL = 'https://wmufsliuuvfombbegzbc.supabase.co'

export default function DebugPage() {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'NO DEFINIDO'
  const cleanKey = envKey.trim()
  const [result, setResult] = useState('')
  const [testing, setTesting] = useState(false)

  async function testLogin() {
    setTesting(true)
    setResult('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'ojhp1983@gmail.com',
        password: 'kiara0915'
      })
      if (error) {
        setResult(`❌ ERROR\nCódigo: ${error.status}\nMensaje: ${error.message}\nDetalle: ${JSON.stringify(error, null, 2)}`)
      } else {
        setResult(`✅ LOGIN EXITOSO\nEmail: ${data.user?.email}\nID: ${data.user?.id}\nConfirmado: ${data.user?.email_confirmed_at}`)
      }
    } catch (e) {
      setResult(`❌ EXCEPCIÓN JS: ${String(e)}`)
    }
    setTesting(false)
  }

  async function testFetch() {
    setTesting(true)
    setResult('')
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: cleanKey }
      })
      const text = await res.text()
      setResult(`HTTP ${res.status} desde Supabase:\n${text}`)
    } catch (e) {
      setResult(`❌ Fetch directo falló: ${String(e)}`)
    }
    setTesting(false)
  }

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: 900 }}>
      <h2>🔍 Diagnóstico Alcaraván v8</h2>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 24 }}>
        <tbody>
          <tr style={{ background: '#f5f5f5' }}>
            <td style={{ padding: 8, fontWeight: 'bold' }}>URL (hardcodeada):</td>
            <td style={{ padding: 8 }}>{SUPABASE_URL}</td>
          </tr>
          <tr>
            <td style={{ padding: 8, fontWeight: 'bold' }}>ANON KEY (env var):</td>
            <td style={{ padding: 8 }}>{cleanKey.substring(0, 40)}...</td>
          </tr>
          <tr style={{ background: '#f5f5f5' }}>
            <td style={{ padding: 8, fontWeight: 'bold' }}>KEY empieza con eyJ:</td>
            <td style={{ padding: 8, color: cleanKey.startsWith('eyJ') ? 'green' : 'red', fontWeight: 'bold' }}>
              {cleanKey.startsWith('eyJ') ? '✅ Sí — parece válida' : '❌ NO — la key está mal o no está definida'}
            </td>
          </tr>
          <tr>
            <td style={{ padding: 8, fontWeight: 'bold' }}>KEY es placeholder:</td>
            <td style={{ padding: 8, color: cleanKey === 'TU_ANON_KEY' ? 'red' : 'green', fontWeight: 'bold' }}>
              {cleanKey === 'TU_ANON_KEY' ? '❌ SÍ — no se configuró en Vercel' : '✅ No — tiene valor real'}
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button onClick={testFetch} disabled={testing}
          style={{ padding: '10px 20px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          {testing ? '...' : '📡 Verificar conexión Supabase'}
        </button>
        <button onClick={testLogin} disabled={testing}
          style={{ padding: '10px 20px', background: '#92400e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          {testing ? '...' : '🔐 Probar login (ojhp1983@gmail.com)'}
        </button>
      </div>

      {result && (
        <pre style={{
          padding: 20,
          background: result.includes('✅') ? '#d1fae5' : '#fee2e2',
          borderRadius: 8,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontSize: 13
        }}>
          {result}
        </pre>
      )}
    </div>
  )
}
