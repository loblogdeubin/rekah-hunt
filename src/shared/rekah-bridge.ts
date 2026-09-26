import type { Command } from './types'

const allowedOrigins = new Set([
  'https://rekah.id',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

export function isRekahDashboard(url?: string) {
  try {
    const page = new URL(url || '')
    return page.pathname === '/admin/lead-discovery' && allowedOrigins.has(page.origin)
  }
  catch { return false }
}

export function isDashboardCommand(value: unknown): value is Command {
  return !!value && typeof value === 'object'
    && ['snapshot', 'start', 'pause', 'resume', 'stop', 'new-search'].includes((value as Command).type)
}
