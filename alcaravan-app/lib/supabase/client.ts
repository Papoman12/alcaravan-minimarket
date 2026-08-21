import { createBrowserClient } from '@supabase/ssr'

// URL hardcodeada para evitar problemas de variables de entorno
const SUPABASE_URL = 'https://wmufsliuuvfombbegzbc.supabase.co'

export function createClient() {
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
  return createBrowserClient(SUPABASE_URL, supabaseKey)
}
