import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wmufsliuuvfombbegzbc.supabase.co'

export async function POST(req: NextRequest) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'Falta la variable SUPABASE_SERVICE_ROLE_KEY en Vercel. Ve a Vercel → Settings → Environment Variables y agrégala.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { email, password, full_name, phone, role_id } = body

    if (!email || !password || !full_name || !role_id) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authErr || !authData?.user) {
      return NextResponse.json(
        { error: authErr?.message ?? 'Error al crear usuario' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // 2. Esperar un momento para que el trigger cree la fila en public.users
    await new Promise(r => setTimeout(r, 800))

    // 3. Actualizar role_id (el trigger ya debió crear la fila)
    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ role_id, is_active: true })
      .eq('id', userId)

    if (updateErr) {
      // Si no existe la fila todavía, insertarla
      const { error: insertErr } = await supabaseAdmin
        .from('users')
        .insert({ id: userId, role_id, is_active: true })

      if (insertErr) {
        return NextResponse.json({
          success: true,
          userId,
          warning: 'Usuario creado pero no se pudo asignar rol: ' + insertErr.message,
        })
      }
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Error inesperado' },
      { status: 500 }
    )
  }
}
