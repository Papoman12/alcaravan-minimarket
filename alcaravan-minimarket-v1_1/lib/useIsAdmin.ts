import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('roles(name)')
        .eq('id', user.id)
        .single()
      if ((data as any)?.roles?.name === 'admin') setIsAdmin(true)
    }
    check()
  }, [])

  return isAdmin
}
