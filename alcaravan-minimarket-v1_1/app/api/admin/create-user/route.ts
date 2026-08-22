import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wmufsliuuvfombbegzbc.supabase.co'

export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey || serviceKey === 'TU_SERVICE_ROLE_KEY') {
      return NextResponse.json({ error: 'Service role key no configurada en Vercel. Ve a Settings → Environment Variables y agrega SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { email, password, full_name, phone, role } = await request.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, contraseña y nombre son requeridos' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener mínimo 6 caracteres' }, { status: 400 })
    }

    // Crear usuario en Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Insertar en tabla users
    await supabaseAdmin.from('users').upsert({
      id: authUser.user.id,
      email,
      full_name,
      phone: phone || null,
      role: role ?? 'cashier',
      is_active: true,
    })

    return NextResponse.json({ success: true, id: authUser.user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error desconocido' }, { status: 500 })
  }
}
