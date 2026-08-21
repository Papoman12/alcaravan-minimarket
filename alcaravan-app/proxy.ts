import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Proxy mínimo: no intercepta nada.
// La autenticación la maneja el layout del dashboard (server component).
export function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
