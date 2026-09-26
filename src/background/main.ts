import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import type { Command, Reply, Snapshot } from '../shared/types'
import { safeError } from '../shared/errors'
import { isDashboardCommand, isRekahDashboard } from '../shared/rekah-bridge'
import { restrictLocalStorage } from './privacy'
import { handleCommand, onResearchAlarm, pumpResearch } from './controller'

if (import.meta.hot) {
  // @ts-expect-error Vite development runtime
  import('/@vite/client')
}

async function protectedCommand(command: Command) {
  await restrictLocalStorage()
  return handleCommand(command)
}

async function respond(command: Command): Promise<Reply<Snapshot>> {
  try {
    return { ok: true, data: await protectedCommand(command) }
  }
  catch (error) {
    return { ok: false, error: safeError(error).message }
  }
}

async function respondDashboard(command: Command) {
  const reply = await respond(command)
  if (!reply.ok)
    return reply
  const { session, settings, connection } = reply.data
  return {
    ok: true as const,
    data: {
      session: session && {
        id: session.id,
        status: session.status,
        phase: session.phase,
        niche: session.niche,
        location: session.location,
        message: session.message,
        analyzedCount: session.analyzedCount,
        qualifiedCount: session.qualifiedCount,
        targetLeadCount: session.targetLeadCount,
        leads: session.leads,
      },
      settings: { engine: settings.engine, decisionLimit: settings.decisionLimit },
      connection: { connected: connection.connected },
    },
  }
}

browser.runtime.onMessage.addListener(
  (raw: unknown, sender: Runtime.MessageSender) => {
    if (!raw || typeof raw !== 'object')
      return undefined
    const message = raw as { channel?: string, command?: Command }

    if (sender.id !== browser.runtime.id || !message.command || typeof message.command.type !== 'string')
      return undefined
    const fromPopup = ['dist/popup/index.html', 'dist/options/index.html'].some(
      path => sender.url?.split(/[?#]/)[0] === browser.runtime.getURL(path),
    )
    if (fromPopup && message.channel === 'gits-ui')
      return respond(message.command)
    if (message.channel === 'gits-dashboard' && sender.tab?.id !== undefined
      && isRekahDashboard(sender.url) && isDashboardCommand(message.command)) {
      return respondDashboard(message.command)
    }
    return undefined
  },
)
browser.alarms.onAlarm.addListener(alarm => onResearchAlarm(alarm.name))
browser.runtime.onStartup.addListener(() => {
  void pumpResearch()
})
browser.runtime.onInstalled.addListener(() => {
  void pumpResearch()
})
