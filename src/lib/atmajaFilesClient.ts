// Client-side helper for Atmaja file library (Lapis 3).
// Backend: api/atmaja/files.js — uploads to Vercel Blob, indexes in Vercel KV.
// Frontend ini call via same-origin (isRequestAllowed di backend allow same-host browser).

export interface AtmajaLibraryFile {
  id: string
  name: string
  size: number
  contentType: string
  blobUrl: string
  uploadedAt: string
  description?: string | null
  pageCount?: number | null
}

export interface AtmajaLibraryListResponse {
  ok: boolean
  files: AtmajaLibraryFile[]
  count: number
  max: number
  totalBytes?: number
}

export interface AtmajaServerCapabilities {
  fileLibrary: boolean
  longTermMemory: boolean
  memoryAutoUpdate: boolean
  pdfNative: boolean
  imageVision: boolean
  historyMaxMessages: number
  maxFileAttachedPerTurn: number
}

const DEFAULT_CAPABILITIES: AtmajaServerCapabilities = {
  fileLibrary: false,
  longTermMemory: false,
  memoryAutoUpdate: false,
  pdfNative: false,
  imageVision: false,
  historyMaxMessages: 10,
  maxFileAttachedPerTurn: 0,
}

export async function fetchServerCapabilities(): Promise<AtmajaServerCapabilities> {
  try {
    const response = await fetch('/api/agent/health', { cache: 'no-store' })
    if (!response.ok) return DEFAULT_CAPABILITIES
    const data = await response.json()
    const caps = data?.chat?.capabilities ?? {}
    return {
      fileLibrary: Boolean(caps.fileLibrary),
      longTermMemory: Boolean(caps.longTermMemory),
      memoryAutoUpdate: Boolean(caps.memoryAutoUpdate),
      pdfNative: Boolean(caps.pdfNative),
      imageVision: Boolean(caps.imageVision),
      historyMaxMessages: Number(caps.historyMaxMessages) || 10,
      maxFileAttachedPerTurn: Number(caps.maxFileAttachedPerTurn) || 0,
    }
  } catch {
    return DEFAULT_CAPABILITIES
  }
}

export async function listLibraryFiles(): Promise<AtmajaLibraryListResponse | null> {
  try {
    // Cache-bust dengan timestamp untuk bypass SW + browser cache.
    const cacheBust = `_=${Date.now()}`
    const response = await fetch(`/api/atmaja/memory?type=files&${cacheBust}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
    })
    if (!response.ok) {
      console.error('[atmajaFilesClient] list HTTP', response.status, await response.text().catch(() => ''))
      return null
    }
    return (await response.json()) as AtmajaLibraryListResponse
  } catch (error) {
    console.error('[atmajaFilesClient] list error:', error)
    return null
  }
}

export interface UploadFilePayload {
  name: string
  contentType: string
  dataBase64: string
  description?: string
}

export interface UploadFileResponse {
  ok: boolean
  file?: AtmajaLibraryFile
  note?: string
  error?: string
}

export async function uploadLibraryFile(payload: UploadFilePayload): Promise<UploadFileResponse> {
  try {
    const response = await fetch('/api/atmaja/memory?type=files', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      return { ok: false, error: data?.error ?? `http_${response.status}` }
    }
    return data as UploadFileResponse
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'network_error' }
  }
}

export async function deleteLibraryFile(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/atmaja/memory?type=files&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    const data = await response.json()
    if (!response.ok) {
      return { ok: false, error: data?.error ?? `http_${response.status}` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'network_error' }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatUploadedAt(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
