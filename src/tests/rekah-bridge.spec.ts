import { describe, expect, it } from 'vitest'
import { isDashboardCommand, isRekahDashboard } from '../shared/rekah-bridge'

describe('Rekah dashboard bridge boundary', () => {
  it('accepts only the Lead Discovery route on allowed origins', () => {
    expect(isRekahDashboard('https://rekah.id/admin/lead-discovery')).toBe(true)
    expect(isRekahDashboard('http://localhost:3000/admin/lead-discovery')).toBe(true)
    expect(isRekahDashboard('https://evil.example/admin/lead-discovery')).toBe(false)
    expect(isRekahDashboard('https://rekah.id/admin/other')).toBe(false)
    expect(isRekahDashboard('https://rekah.id.evil.example/admin/lead-discovery')).toBe(false)
  })

  it('does not expose credential or settings commands to the page', () => {
    expect(isDashboardCommand({ type: 'snapshot' })).toBe(true)
    expect(isDashboardCommand({ type: 'start', config: {} })).toBe(true)
    expect(isDashboardCommand({ type: 'connect', key: 'secret' })).toBe(false)
    expect(isDashboardCommand({ type: 'remove-key' })).toBe(false)
    expect(isDashboardCommand({ type: 'settings' })).toBe(false)
  })
})
