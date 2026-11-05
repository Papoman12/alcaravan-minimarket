/**
 * Utilidades de zona horaria para Colombia (UTC-5 / America/Bogota)
 *
 * Problema raíz: Supabase almacena timestamps en UTC.
 * Colombia es UTC-5, por lo tanto:
 *   - Medianoche Colombia = 05:00 UTC
 *   - 11:59 PM Colombia   = 04:59 UTC del día siguiente
 * Sin este ajuste, las ventas hechas después de las 7 PM quedan
 * registradas en el "día siguiente" según UTC.
 */

/** Retorna la fecha Colombia en formato YYYY-MM-DD */
export function getColombiaDate(date?: Date | string): string {
  const ref = date ? new Date(date) : new Date()
  return ref.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

/**
 * Retorna el rango UTC que corresponde a un día calendario en Colombia.
 */
export function getColombiaDateUTCRange(colombiaDate?: string): {
  from: string
  to: string
} {
  const dateStr = colombiaDate ?? getColombiaDate()
  const from = new Date(`${dateStr}T05:00:00.000Z`)
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000)
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

/** Formatea un timestamp UTC a fecha y hora Colombia legible */
export function formatColombiaDateTime(utcDate: string | Date): string {
  const ref = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  return ref.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Formatea solo la hora Colombia */
export function formatColombiaTime(utcDate: string | Date): string {
  const ref = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  return ref.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
  })
}
