import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import type { MapsCommand, Reply } from '../shared/types'
import { safeError } from '../shared/errors'
import { isDashboardCommand, isRekahDashboard } from '../shared/rekah-bridge'
import { GoogleMapsExecutor } from './google-maps/executor'

const onRekahDashboard = isRekahDashboard(location.href)

if (onRekahDashboard) {
  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin
      || event.data?.source !== 'rekah-lead-discovery') return
    if (event.data.type === 'ping') {
      window.postMessage({ source: 'gits-extension', type: 'ready' }, location.origin)
      return
    }
    if (event.data.type !== 'request' || typeof event.data.id !== 'string'
      || event.data.id.length > 80) return
    const command = event.data.command
    if (!isDashboardCommand(command)) return
    try {
      const reply = await browser.runtime.sendMessage({ channel: 'gits-dashboard', command })
      window.postMessage({ source: 'gits-extension', type: 'response', id: event.data.id, reply }, location.origin)
    }
    catch {
      window.postMessage({ source: 'gits-extension', type: 'response', id: event.data.id,
        reply: { ok: false, error: 'Ekstensi Rekah Hunt tidak merespons. Muat ulang ekstensi dan halaman Rekah.' } }, location.origin)
    }
  })
  window.postMessage({ source: 'gits-extension', type: 'ready' }, location.origin)
}

let activeOperation: AbortController | undefined
if (!onRekahDashboard) browser.runtime.onMessage.addListener(
  (raw: unknown, sender: Runtime.MessageSender) => {
    if (!raw || typeof raw !== 'object')
      return undefined
    const message = raw as {
      channel?: string
      ping?: boolean
      cancel?: boolean
      command?: MapsCommand
    }

    if (sender.id !== browser.runtime.id || message?.channel !== 'gits-maps')
      return undefined
    if (message.ping)
      return Promise.resolve({ ok: true, data: { ready: true } })
    if (message.cancel) {
      activeOperation?.abort()
      return Promise.resolve({ ok: true, data: null })
    }
    return message.command ? execute(message.command) : undefined
  },
)
async function execute(
  command: MapsCommand,
): Promise<Reply<unknown> & { code?: string }> {
  if (activeOperation) {
    return {
      ok: false,
      error: 'Google Maps is still processing the previous operation.',
      code: 'maps_busy',
    }
  }
  activeOperation = new AbortController()
  const maps = new GoogleMapsExecutor(activeOperation.signal)
  try {
    let data: unknown
    switch (command.operation) {
      case 'search':
        data = await maps.search(command.query)
        break
      case 'scrollResults':
        data = await maps.scrollResults()
        break
      case 'openBusiness':
        data = await maps.openBusiness(command.candidate)
        break
      case 'readBusiness':
        data = await maps.readBusiness(command.candidate, command.query)
        break
      case 'backToResults':
        data = await maps.backToResults()
        break
      default:
        return {
          ok: false,
          error: 'Unknown Maps operation.',
          code: 'maps_unsupported',
        }
    }
    return { ok: true, data: data ?? null }
  }
  catch (error) {
    const safe = safeError(error)
    return { ok: false, error: safe.message, code: safe.code }
  }
  finally {
    activeOperation = undefined
  }
}
