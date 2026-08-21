import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// URL hardcodeada para evitar problemas de variables de entorno
const SUPABASE_URL = 'https://wmufsliuuvfombbegzbc.supabase.co'

export async function createClient() {
  const cookieStore = await cookies()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

  return createServerClient(SUPABASE_URL, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Component — se puede ignorar si hay middleware
        }
      },
    },
  })
}
