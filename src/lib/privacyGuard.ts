const privacyLockEnabled = import.meta.env.VITE_GERAI_PRIVACY_LOCK !== 'off'
const agentBridgeRequested = import.meta.env.VITE_GERAI_AGENT_BRIDGE === 'on'
const telemetryRequested = import.meta.env.VITE_GERAI_TELEMETRY === 'on'

export const AGENT_BRIDGE_ALLOWED = !privacyLockEnabled && agentBridgeRequested
export const TELEMETRY_ALLOWED = !privacyLockEnabled && telemetryRequested

let runtimeGuardInstalled = false

export function isPrivacyLockEnabled() {
  return privacyLockEnabled
}

export function getPrivacyPosture() {
  return {
    privacyLockEnabled,
    agentBridgeRequested,
    telemetryRequested,
    agentBridgeAllowed: AGENT_BRIDGE_ALLOWED,
    telemetryAllowed: TELEMETRY_ALLOWED,
    dataEgress: AGENT_BRIDGE_ALLOWED ? 'bridge-enabled' : 'blocked',
  } as const
}

export function installPrivacyRuntimeGuard() {
  if (!privacyLockEnabled || runtimeGuardInstalled || typeof window === 'undefined') return
  runtimeGuardInstalled = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' || input instanceof URL ? input.toString() : input.url
    const url = new URL(rawUrl, window.location.href)
    const blockedLocalPath =
      url.pathname.startsWith('/api/agent') ||
      url.pathname.startsWith('/api/atmaja') ||
      url.pathname.startsWith('/api/telemetry')

    if (url.origin !== window.location.origin || blockedLocalPath) {
      return Promise.reject(new Error(`Gerai privacy lock blocked outbound request to ${url.origin}${url.pathname}`))
    }

    return originalFetch(input, init)
  }) as typeof window.fetch

  if ('sendBeacon' in navigator) {
    navigator.sendBeacon = (() => false) as typeof navigator.sendBeacon
  }

  window.WebSocket = (function BlockedWebSocket() {
    throw new Error('Gerai privacy lock blocked WebSocket egress.')
  }) as unknown as typeof WebSocket

  window.EventSource = (function BlockedEventSource() {
    throw new Error('Gerai privacy lock blocked EventSource egress.')
  }) as unknown as typeof EventSource
}
