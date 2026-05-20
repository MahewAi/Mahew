const VAULT_SCHEMA = 'gerai-private-sync-vault'
const VAULT_VERSION = 1

const PRIVATE_SYNC_KEYS = [
  { key: 'gerai:briefs:v1', label: 'Brief inbox' },
  { key: 'gerai:learning-memory:v1', label: 'Learning memory' },
  { key: 'gerai:atmaja-thread', label: 'Atmaja thread' },
  { key: 'gerai:automation-runs:v1', label: 'Automation runs' },
] as const

type PrivateSyncKey = (typeof PRIVATE_SYNC_KEYS)[number]['key']

export interface PrivateSyncVault {
  schema: typeof VAULT_SCHEMA
  version: typeof VAULT_VERSION
  exportedAt: string
  source: {
    app: 'gerai'
    origin: string
  }
  records: Partial<Record<PrivateSyncKey, string>>
  checksum: string
}

export interface PrivateSyncSnapshotStatus {
  recordCount: number
  sizeInBytes: number
  labels: string[]
}

export interface PrivateSyncImportResult {
  imported: number
  skipped: number
  exportedAt: string
  checksumVerified: boolean
}

type VaultWithoutChecksum = Omit<PrivateSyncVault, 'checksum'>

function getOrigin() {
  if (typeof window === 'undefined') return 'local'
  return window.location.origin
}

function normalizeVaultPayload(vault: VaultWithoutChecksum) {
  const records = Object.fromEntries(
    PRIVATE_SYNC_KEYS.map(({ key }) => [key, vault.records[key]]).filter(([, value]) => typeof value === 'string'),
  )

  return JSON.stringify({
    schema: vault.schema,
    version: vault.version,
    exportedAt: vault.exportedAt,
    source: vault.source,
    records,
  })
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function assertLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Local storage unavailable.')
  }
}

export function getPrivateSyncKeyLabels() {
  return PRIVATE_SYNC_KEYS.map(({ label }) => label)
}

export function getPrivateSyncSnapshotStatus(): PrivateSyncSnapshotStatus {
  if (typeof window === 'undefined') return { recordCount: 0, sizeInBytes: 0, labels: [] }

  let sizeInBytes = 0
  const labels: string[] = []

  for (const { key, label } of PRIVATE_SYNC_KEYS) {
    const value = window.localStorage.getItem(key)
    if (!value) continue
    sizeInBytes += new TextEncoder().encode(value).byteLength
    labels.push(label)
  }

  return {
    recordCount: labels.length,
    sizeInBytes,
    labels,
  }
}

export async function buildPrivateSyncVault(): Promise<PrivateSyncVault> {
  assertLocalStorage()

  const records: PrivateSyncVault['records'] = {}
  for (const { key } of PRIVATE_SYNC_KEYS) {
    const value = window.localStorage.getItem(key)
    if (value) records[key] = value
  }

  const payload: VaultWithoutChecksum = {
    schema: VAULT_SCHEMA,
    version: VAULT_VERSION,
    exportedAt: new Date().toISOString(),
    source: {
      app: 'gerai',
      origin: getOrigin(),
    },
    records,
  }

  return {
    ...payload,
    checksum: await sha256Hex(normalizeVaultPayload(payload)),
  }
}

export async function restorePrivateSyncVault(raw: string): Promise<PrivateSyncImportResult> {
  assertLocalStorage()

  const parsed = JSON.parse(raw) as Partial<PrivateSyncVault>
  if (parsed.schema !== VAULT_SCHEMA || parsed.version !== VAULT_VERSION || !parsed.records) {
    throw new Error('Vault tidak cocok dengan format Gerai.')
  }

  const payload: VaultWithoutChecksum = {
    schema: VAULT_SCHEMA,
    version: VAULT_VERSION,
    exportedAt: parsed.exportedAt ?? new Date(0).toISOString(),
    source: {
      app: 'gerai',
      origin: parsed.source?.origin ?? 'unknown',
    },
    records: parsed.records,
  }
  const expectedChecksum = await sha256Hex(normalizeVaultPayload(payload))
  const checksumVerified = parsed.checksum === expectedChecksum

  let imported = 0
  let skipped = 0

  for (const { key } of PRIVATE_SYNC_KEYS) {
    const value = parsed.records[key]
    if (typeof value !== 'string') {
      skipped += 1
      continue
    }

    window.localStorage.setItem(key, value)
    imported += 1
  }

  return {
    imported,
    skipped,
    exportedAt: payload.exportedAt,
    checksumVerified,
  }
}
