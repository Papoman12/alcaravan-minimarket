import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wmufsliuuvfombbegzbc.supabase.co'

export async function POST(req: NextRequest) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'Falta la variable SUPABASE_SERVICE_ROLE_KEY en Vercel' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { email, password, full_name, phone, role_name } = body

    if (!email || !password || !full_name || !role_name) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: email, password, full_name, role_name' },
        { status: 400 }
      )
    }

    // Cliente admin con service role
    const supabaseAdmin = createClient(SUPABASE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Buscar el role_id según el nombre del rol
    const { data: roleData, error: roleErr } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', role_name)
      .single()

    if (roleErr || !roleData) {
      return NextResponse.json(
        { error: `Rol "${role_name}" no encontrado en la tabla roles` },
        { status: 400 }
      )
    }

    const role_id = roleData.id

    // 2. Crear usuario en Supabase Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: role_name },
    })

    if (authErr || !authData?.user) {
      return NextResponse.json(
        { error: authErr?.message ?? 'Error al crear usuario en Auth' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // 3. Insertar en la tabla users con role_id correcto
    // NOTA: full_name NO se incluye porque es columna generada desde auth.users metadata
    const { error: dbErr } = await supabaseAdmin.from('users').upsert({
      id: userId,
      email,
      phone: phone?.trim() || null,
      role_id,
      is_active: true,
    })

    if (dbErr) {
      // Si falla el insert en users, eliminar el auth user para no dejar inconsistencia
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Error al guardar en tabla users: ' + dbErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Error inesperado' },
      { status: 500 }
    )
  }
}
