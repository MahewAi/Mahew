/**
 * OpsFlow — Mesin metrik.
 *
 * Semua fungsi di sini murni: masukkan OpsDataset, keluar angka. Tidak ada
 * pemanggilan jaringan, tidak ada state global, tidak ada `Date.now()` —
 * waktu acuan selalu `dataset.snapshotAt`. Artinya hasil bisa diuji, bisa
 * dihitung ulang untuk periode masa lalu, dan tidak berubah kalau dijalankan
 * dua kali.
 *
 * Urutan berpikirnya:
 *   events  →  StageVisit  →  StageMetrics  →  BottleneckRanking
 *                          ↘  IncidentMetrics
 *                          ↘  TeamScorecard / PersonScorecard
 *                          ↘  FlowMetrics (lead time end-to-end)
 */

import { calendarHoursBetween, resolveCalendar, workingHoursBetween } from './calendar.ts'
import type {
  EventType,
  Incident,
  IncidentType,
  OpsDataset,
  SlaTarget,
  StageDataQuality,
  WorkCalendar,
  WorkEvent,
  WorkItem,
} from './schema.ts'
import { getStage, mainPath, stageDistance, type SectorId } from './taxonomy.ts'

// ============================================================
// Statistik dasar
// ============================================================

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const rank = (p / 100) * (sorted.length - 1)
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  if (low === high) return sorted[low]
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low)
}

function median(values: number[]): number {
  return percentile(values, 50)
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Skala 0..1 dengan batas atas, supaya satu stage ekstrem tidak menenggelamkan sisanya. */
function normalize(value: number, cap: number): number {
  if (cap <= 0) return 0
  return Math.min(1, Math.max(0, value / cap))
}

// ============================================================
// Resolusi SLA
// ============================================================

/**
 * Pilih SLA paling spesifik yang cocok untuk sebuah item di sebuah stage.
 * Urutan kekhususan: supplier > kategori item > prioritas > tanpa pembatas.
 */
export function resolveSla(
  targets: SlaTarget[],
  stageCode: string,
  item: WorkItem | null,
  items: OpsDataset['items'],
): SlaTarget | null {
  const candidates = targets.filter((t) => t.stageCode === stageCode)
  if (candidates.length === 0) return null

  const itemCategories = new Set<string>()
  if (item?.refs.itemIds) {
    for (const id of item.refs.itemIds) {
      const master = items.find((i) => i.id === id)
      if (master) itemCategories.add(master.category)
    }
  }

  const score = (t: SlaTarget): number => {
    if (!t.scope) return 1
    let s = 0
    if (t.scope.supplierId) {
      if (t.scope.supplierId !== item?.refs.supplierId) return -1
      s += 8
    }
    if (t.scope.itemCategory) {
      if (!itemCategories.has(t.scope.itemCategory)) return -1
      s += 4
    }
    if (t.scope.priority) {
      if (t.scope.priority !== item?.priority) return -1
      s += 2
    }
    return s
  }

  let best: SlaTarget | null = null
  let bestScore = -1
  for (const candidate of candidates) {
    const s = score(candidate)
    if (s > bestScore) {
      bestScore = s
      best = candidate
    }
  }
  return bestScore < 0 ? null : best
}

/** Kalau SLA belum dikonfigurasi, pakai hipotesis dari taxonomy supaya dashboard tetap jalan. */
function fallbackSla(stageCode: string): { maxWaitHours: number; maxTouchHours: number } {
  const stage = getStage(stageCode)
  return {
    maxWaitHours: stage?.slaWaitHours ?? 8,
    maxTouchHours: stage?.slaTouchHours ?? 4,
  }
}

// ============================================================
// StageVisit — satu kali sebuah objek kerja melewati sebuah stage
// ============================================================

export interface StageVisit {
  workItemId: string
  stageCode: string
  sector: SectorId
  team: string
  /** Kunjungan ke-berapa. > 1 berarti pekerjaan berulang (rework / dikembalikan). */
  visitIndex: number
  arrivedAt: string | null
  startedAt: string | null
  completedAt: string | null
  /** PIC pada kunjungan ini — diambil dari event 'started', jatuh ke 'completed'. */
  actorPersonId: string | null
  /** Jam kerja menganggur di antrean. null = timestamp tidak lengkap. */
  waitHours: number | null
  /** Jam kerja dikerjakan aktif. null = timestamp tidak lengkap. */
  touchHours: number | null
  /** Jam kerja tertahan pihak luar. Dikeluarkan dari penilaian SLA. */
  blockedHours: number
  /** Masih di stage ini pada saat snapshot. */
  isOpen: boolean
  /** Umur kunjungan sejak masuk antrean sampai snapshot (untuk yang masih terbuka). */
  ageHours: number | null
  waitBreached: boolean
  touchBreached: boolean
  /** Ditolak / dikembalikan pada kunjungan ini. */
  rejected: boolean
  returned: boolean
  /** Jumlah perubahan data setelah dokumen terbentuk di stage ini. */
  fieldChangeCount: number
  /** Selisih waktu kejadian vs waktu pencatatan (median event pada kunjungan ini), jam. */
  recordingLagHours: number | null
}

const EVENT_ORDER: Record<string, number> = {
  arrived: 0,
  started: 1,
  reassigned: 2,
  blocked: 3,
  unblocked: 4,
  field_changed: 5,
  note: 6,
  incident_logged: 7,
  approved: 8,
  rejected: 9,
  returned: 9,
  cancelled: 9,
  completed: 10,
}

function sortEvents(events: WorkEvent[]): WorkEvent[] {
  return [...events].sort((a, b) => {
    const timeDiff = Date.parse(a.occurredAt) - Date.parse(b.occurredAt)
    if (timeDiff !== 0) return timeDiff
    return (EVENT_ORDER[a.type] ?? 5) - (EVENT_ORDER[b.type] ?? 5)
  })
}

function calendarForStage(
  dataset: Pick<OpsDataset, 'calendars' | 'slaTargets'>,
  stageCode: string,
): WorkCalendar {
  const target = dataset.slaTargets.find((t) => t.stageCode === stageCode)
  return resolveCalendar(dataset.calendars, target?.calendarId)
}

/**
 * Rekonstruksi seluruh kunjungan stage dari event log.
 *
 * Toleran terhadap data tidak lengkap — itu keadaan normal di bulan-bulan awal.
 * Kalau `arrived` tidak ada tapi `completed` ada, kunjungan tetap dibuat dengan
 * waitHours = null. Yang tidak boleh terjadi adalah diam-diam mengarang angka:
 * null tetap null, dan cakupannya dilaporkan lewat `assessDataQuality()`.
 */
/**
 * Event yang hanya menempel pada kunjungan yang sedang berjalan — bukan penanda
 * bahwa pekerjaan sedang berada di sebuah stage.
 */
const ANNOTATION_EVENTS = new Set<EventType>(['note', 'field_changed', 'incident_logged', 'reassigned'])

/** Kunjungan yang sedang dibangun saat event log dibaca berurutan. */
interface VisitAccumulator {
  stageCode: string
  visitIndex: number
  arrivedAt: string | null
  startedAt: string | null
  actorPersonId: string | null
  /** Waktu mulai tertahan pihak luar, kalau sedang tertahan. */
  blockedFrom: string | null
  blockedHours: number
  rejected: boolean
  returned: boolean
  fieldChangeCount: number
  /** Jeda pencatatan dari setiap event pada kunjungan ini. */
  lags: number[]
}

export function buildStageVisits(dataset: OpsDataset): StageVisit[] {
  const eventsByItem = new Map<string, WorkEvent[]>()
  for (const event of dataset.events) {
    const list = eventsByItem.get(event.workItemId)
    if (list) list.push(event)
    else eventsByItem.set(event.workItemId, [event])
  }

  const visits: StageVisit[] = []

  for (const workItem of dataset.workItems) {
    const events = sortEvents(eventsByItem.get(workItem.id) ?? [])
    const visitCountByStage = new Map<string, number>()

    const flush = (acc: VisitAccumulator, completedAt: string | null): void => {
      const stage = getStage(acc.stageCode)
      const cal = calendarForStage(dataset, acc.stageCode)
      const sla = resolveSla(dataset.slaTargets, acc.stageCode, workItem, dataset.items) ?? {
        ...fallbackSla(acc.stageCode),
      }

      const isOpen = completedAt === null
      const referenceEnd = completedAt ?? dataset.snapshotAt

      let blockedHours = acc.blockedHours
      if (acc.blockedFrom) {
        blockedHours += workingHoursBetween(acc.blockedFrom, referenceEnd, cal)
      }

      const waitHours =
        acc.arrivedAt === null
          ? null
          : acc.startedAt === null
            ? Math.max(0, workingHoursBetween(acc.arrivedAt, referenceEnd, cal) - blockedHours)
            : workingHoursBetween(acc.arrivedAt, acc.startedAt, cal)

      const touchHours =
        acc.startedAt === null
          ? null
          : Math.max(0, workingHoursBetween(acc.startedAt, referenceEnd, cal) - blockedHours)

      const ageHours = acc.arrivedAt ? workingHoursBetween(acc.arrivedAt, dataset.snapshotAt, cal) : null

      visits.push({
        workItemId: workItem.id,
        stageCode: acc.stageCode,
        sector: stage?.sector ?? 'PROC',
        team: stage?.team ?? 'unknown',
        visitIndex: acc.visitIndex,
        arrivedAt: acc.arrivedAt,
        startedAt: acc.startedAt,
        completedAt,
        actorPersonId: acc.actorPersonId,
        waitHours: waitHours === null ? null : round(waitHours),
        touchHours: touchHours === null ? null : round(touchHours),
        blockedHours: round(blockedHours),
        isOpen,
        ageHours: ageHours === null ? null : round(ageHours),
        waitBreached: waitHours !== null && waitHours > sla.maxWaitHours,
        touchBreached: touchHours !== null && touchHours > sla.maxTouchHours,
        rejected: acc.rejected,
        returned: acc.returned,
        fieldChangeCount: acc.fieldChangeCount,
        recordingLagHours: acc.lags.length > 0 ? round(median(acc.lags)) : null,
      })
    }

    const openVisit = (stageCode: string, arrivedAt: string | null): VisitAccumulator => {
      const nextIndex = (visitCountByStage.get(stageCode) ?? 0) + 1
      visitCountByStage.set(stageCode, nextIndex)
      return {
        stageCode,
        visitIndex: nextIndex,
        arrivedAt,
        startedAt: null,
        actorPersonId: null,
        blockedFrom: null,
        blockedHours: 0,
        rejected: false,
        returned: false,
        fieldChangeCount: 0,
        lags: [],
      }
    }

    let current: VisitAccumulator | null = null

    for (const event of events) {
      const lag = event.recordingLagHours ?? calendarHoursBetween(event.occurredAt, event.recordedAt)

      // Event untuk stage lain: tutup kunjungan berjalan tanpa completedAt —
      // artinya pekerjaan pindah stage tanpa pernah ditandai selesai. Ini sendiri
      // sinyal disiplin pencatatan yang layak dilihat.
      if (current && current.stageCode !== event.stageCode && event.type !== 'completed') {
        flush(current, null)
        current = null
      }

      // Event anotasi tidak bisa mendefinisikan kunjungan sendiri. Kalau tidak
      // ada kunjungan yang sedang terbuka, ia dilewati.
      //
      // Tanpa penjagaan ini, sebuah `field_changed` yang terjadi SETELAH stage
      // ditutup akan membuka "kunjungan hantu": tidak punya arrivedAt, startedAt,
      // maupun completedAt, lalu ikut terhitung sebagai satu kunjungan stage dan
      // mengencerkan seluruh persentase. Ditemukan lewat uji mandiri yang
      // memeriksa bahwa setiap kunjungan punya minimal satu timestamp.
      if (!current && ANNOTATION_EVENTS.has(event.type)) continue

      // 'completed' tanpa pembuka: buat kunjungan sekilas agar throughput tetap terhitung.
      const visit: VisitAccumulator =
        current ?? openVisit(event.stageCode, event.type === 'arrived' ? event.occurredAt : null)
      current = visit
      if (lag > 0) visit.lags.push(lag)

      switch (event.type) {
        case 'arrived':
          if (visit.arrivedAt === null) visit.arrivedAt = event.occurredAt
          break
        case 'started':
          if (visit.startedAt === null) visit.startedAt = event.occurredAt
          if (visit.actorPersonId === null) visit.actorPersonId = event.actorPersonId
          break
        case 'reassigned':
          visit.actorPersonId = event.actorPersonId
          break
        case 'blocked':
          if (visit.blockedFrom === null) visit.blockedFrom = event.occurredAt
          break
        case 'unblocked':
          if (visit.blockedFrom !== null) {
            visit.blockedHours += workingHoursBetween(
              visit.blockedFrom,
              event.occurredAt,
              calendarForStage(dataset, visit.stageCode),
            )
            visit.blockedFrom = null
          }
          break
        case 'field_changed':
          visit.fieldChangeCount += 1
          break
        case 'rejected':
          visit.rejected = true
          break
        case 'returned':
          visit.returned = true
          if (visit.actorPersonId === null) visit.actorPersonId = event.actorPersonId
          flush(visit, event.occurredAt)
          current = null
          break
        case 'completed':
        case 'cancelled':
          if (visit.actorPersonId === null) visit.actorPersonId = event.actorPersonId
          flush(visit, event.occurredAt)
          current = null
          break
        default:
          break
      }
    }

    if (current) flush(current, null)
  }

  return visits
}

// ============================================================
// Metrik per stage
// ============================================================

export interface StageMetrics {
  stageCode: string
  stageName: string
  sector: SectorId
  team: string
  /** Jumlah item yang SEKARANG mengantre/dikerjakan di stage ini. */
  wip: number
  /** WIP yang belum ada yang mulai kerjakan sama sekali. Antrean murni. */
  untouchedWip: number
  /** WIP yang tertahan pihak luar. */
  blockedWip: number
  /** Item selesai di jendela analisis. */
  completedInWindow: number
  /** Throughput per hari kalender di jendela analisis. */
  throughputPerDay: number
  /**
   * Hukum Little: WIP ÷ throughput. Artinya "kalau tidak ada pekerjaan baru
   * masuk, berapa hari untuk menghabiskan antrean ini". Indikator macet paling
   * jujur karena tidak bisa dikaburkan oleh rata-rata.
   */
  queueDays: number
  waitHoursP50: number
  waitHoursP90: number
  touchHoursP50: number
  touchHoursP90: number
  /** Bagian waktu yang benar-benar dikerjakan. Rendah = masalah alur, bukan kecepatan orang. */
  touchShare: number
  slaWaitTarget: number
  slaTouchTarget: number
  waitBreachRate: number
  touchBreachRate: number
  /** Item yang mengunjungi stage ini lebih dari sekali. */
  reworkRate: number
  rejectRate: number
  /** Insiden yang BERSUMBER di stage ini, per 100 item selesai. */
  incidentsPer100: number
  /** Umur WIP terbuka, dikelompokkan (jam kerja). */
  aging: { under8h: number; h8to24: number; h24to72: number; over72h: number }
  /** Item terbuka paling tua di stage ini — daftar tindakan langsung. */
  oldestOpen: Array<{ workItemId: string; ageHours: number; actorPersonId: string | null }>
}

export interface MetricsOptions {
  /** Panjang jendela analisis dalam hari kalender, dihitung mundur dari snapshotAt. */
  windowDays?: number
}

const DEFAULT_WINDOW_DAYS = 30

function windowStart(snapshotAt: string, windowDays: number): number {
  return Date.parse(snapshotAt) - windowDays * 86_400_000
}

export function computeStageMetrics(
  dataset: OpsDataset,
  visits: StageVisit[],
  options: MetricsOptions = {},
): StageMetrics[] {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const from = windowStart(dataset.snapshotAt, windowDays)

  const byStage = new Map<string, StageVisit[]>()
  for (const visit of visits) {
    const list = byStage.get(visit.stageCode)
    if (list) list.push(visit)
    else byStage.set(visit.stageCode, [visit])
  }

  const incidentsByStage = new Map<string, number>()
  for (const incident of dataset.incidents) {
    if (Date.parse(incident.occurredAt) < from) continue
    incidentsByStage.set(incident.occurredAtStage, (incidentsByStage.get(incident.occurredAtStage) ?? 0) + 1)
  }

  const results: StageMetrics[] = []

  for (const [stageCode, stageVisits] of byStage) {
    const stage = getStage(stageCode)
    const sla = resolveSla(dataset.slaTargets, stageCode, null, dataset.items) ?? fallbackSla(stageCode)

    const open = stageVisits.filter((v) => v.isOpen)
    const closedInWindow = stageVisits.filter(
      (v) => v.completedAt !== null && Date.parse(v.completedAt) >= from,
    )

    const waitSamples = closedInWindow.map((v) => v.waitHours).filter((v): v is number => v !== null)
    const touchSamples = closedInWindow.map((v) => v.touchHours).filter((v): v is number => v !== null)

    const totalWait = waitSamples.reduce((a, b) => a + b, 0)
    const totalTouch = touchSamples.reduce((a, b) => a + b, 0)
    const throughputPerDay = closedInWindow.length / windowDays

    const distinctItems = new Set(stageVisits.map((v) => v.workItemId))
    const repeatItems = new Set(stageVisits.filter((v) => v.visitIndex > 1).map((v) => v.workItemId))

    const aging = { under8h: 0, h8to24: 0, h24to72: 0, over72h: 0 }
    for (const visit of open) {
      const age = visit.ageHours ?? 0
      if (age < 8) aging.under8h += 1
      else if (age < 24) aging.h8to24 += 1
      else if (age < 72) aging.h24to72 += 1
      else aging.over72h += 1
    }

    const oldestOpen = [...open]
      .sort((a, b) => (b.ageHours ?? 0) - (a.ageHours ?? 0))
      .slice(0, 5)
      .map((v) => ({
        workItemId: v.workItemId,
        ageHours: v.ageHours ?? 0,
        actorPersonId: v.actorPersonId,
      }))

    results.push({
      stageCode,
      stageName: stage?.name ?? stageCode,
      sector: stage?.sector ?? 'PROC',
      team: stage?.team ?? 'unknown',
      wip: open.length,
      untouchedWip: open.filter((v) => v.startedAt === null).length,
      blockedWip: open.filter((v) => v.blockedHours > 0).length,
      completedInWindow: closedInWindow.length,
      throughputPerDay: round(throughputPerDay, 3),
      queueDays: throughputPerDay > 0 ? round(open.length / throughputPerDay) : open.length > 0 ? 999 : 0,
      waitHoursP50: round(percentile(waitSamples, 50)),
      waitHoursP90: round(percentile(waitSamples, 90)),
      touchHoursP50: round(percentile(touchSamples, 50)),
      touchHoursP90: round(percentile(touchSamples, 90)),
      touchShare: totalWait + totalTouch > 0 ? round(totalTouch / (totalWait + totalTouch), 3) : 0,
      slaWaitTarget: sla.maxWaitHours,
      slaTouchTarget: sla.maxTouchHours,
      waitBreachRate:
        closedInWindow.length > 0
          ? round(closedInWindow.filter((v) => v.waitBreached).length / closedInWindow.length, 3)
          : 0,
      touchBreachRate:
        closedInWindow.length > 0
          ? round(closedInWindow.filter((v) => v.touchBreached).length / closedInWindow.length, 3)
          : 0,
      reworkRate: distinctItems.size > 0 ? round(repeatItems.size / distinctItems.size, 3) : 0,
      rejectRate:
        stageVisits.length > 0 ? round(stageVisits.filter((v) => v.rejected).length / stageVisits.length, 3) : 0,
      incidentsPer100:
        closedInWindow.length > 0
          ? round(((incidentsByStage.get(stageCode) ?? 0) / closedInWindow.length) * 100, 1)
          : 0,
      aging,
      oldestOpen,
    })
  }

  const order = mainPath().map((s) => s.code)
  results.sort((a, b) => {
    const ai = order.indexOf(a.stageCode)
    const bi = order.indexOf(b.stageCode)
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
  })
  return results
}

// ============================================================
// Deteksi bottleneck
// ============================================================

/**
 * Bobot skor bottleneck. Sengaja diekspor agar bisa disetel dan agar rumusnya
 * bisa dibuka ke tim — dashboard yang skornya "kotak hitam" tidak akan
 * dipercaya, dan tim akan berdebat soal angkanya bukan soal masalahnya.
 */
export const BOTTLENECK_WEIGHTS = {
  /** Antrean menumpuk relatif kemampuan menghabiskannya (Hukum Little). */
  queueDays: 0.3,
  /** Menganggur di antrean dibanding target. */
  waitVsSla: 0.25,
  /** Seberapa sering SLA dilanggar. */
  breachRate: 0.2,
  /** Pekerjaan berulang — kapasitas terbuang. */
  rework: 0.15,
  /** Kesalahan bersumber di sini. */
  incidents: 0.1,
} as const

/** Batas atas normalisasi. Di atas nilai ini, komponen dianggap 100% buruk. */
export const BOTTLENECK_CAPS = {
  queueDays: 10,
  waitRatio: 4,
  incidentsPer100: 20,
} as const

export interface BottleneckFinding {
  stageCode: string
  stageName: string
  sector: SectorId
  team: string
  /** 0–100. Tidak absolut — dipakai untuk mengurutkan prioritas. */
  score: number
  /** Rincian kontribusi, supaya bisa dijelaskan "kenapa stage ini nomor satu". */
  components: {
    queueDays: number
    waitVsSla: number
    breachRate: number
    rework: number
    incidents: number
  }
  /**
   * Diagnosis utama — ini yang menentukan tindakan:
   * - 'queue'     : kerjaan menumpuk, kapasitas kurang atau prioritas tidak jelas
   * - 'idle_wait' : tidak ada yang mengambil pekerjaan (masalah kepemilikan/alur)
   * - 'slow_work' : dikerjakan tapi lambat (masalah alat/keterampilan/kompleksitas)
   * - 'rework'    : sering diulang (masalah mutu di stage sebelumnya)
   * - 'errors'    : banyak kesalahan bersumber di sini
   * - 'external'  : tertahan pihak luar
   */
  primaryDriver: 'queue' | 'idle_wait' | 'slow_work' | 'rework' | 'errors' | 'external'
  /** Satu kalimat penjelasan siap tampil di dashboard. */
  explanation: string
  /** Jumlah item yang tertahan di sini sekarang. */
  itemsStuck: number
  /** Nilai rupiah yang tertahan di stage ini — argumen untuk prioritas perbaikan. */
  valueStuckIdr: number
}

export function detectBottlenecks(
  dataset: OpsDataset,
  stageMetrics: StageMetrics[],
  visits: StageVisit[],
): BottleneckFinding[] {
  const itemById = new Map(dataset.workItems.map((i) => [i.id, i]))
  const openByStage = new Map<string, StageVisit[]>()
  for (const visit of visits) {
    if (!visit.isOpen) continue
    const list = openByStage.get(visit.stageCode)
    if (list) list.push(visit)
    else openByStage.set(visit.stageCode, [visit])
  }

  const findings = stageMetrics.map((m): BottleneckFinding => {
    const waitRatio = m.slaWaitTarget > 0 ? m.waitHoursP90 / m.slaWaitTarget : 0
    const components = {
      queueDays: normalize(m.queueDays, BOTTLENECK_CAPS.queueDays),
      waitVsSla: normalize(waitRatio, BOTTLENECK_CAPS.waitRatio),
      breachRate: Math.max(m.waitBreachRate, m.touchBreachRate),
      rework: m.reworkRate,
      incidents: normalize(m.incidentsPer100, BOTTLENECK_CAPS.incidentsPer100),
    }

    const score =
      100 *
      (components.queueDays * BOTTLENECK_WEIGHTS.queueDays +
        components.waitVsSla * BOTTLENECK_WEIGHTS.waitVsSla +
        components.breachRate * BOTTLENECK_WEIGHTS.breachRate +
        components.rework * BOTTLENECK_WEIGHTS.rework +
        components.incidents * BOTTLENECK_WEIGHTS.incidents)

    const openVisits = openByStage.get(m.stageCode) ?? []
    const valueStuckIdr = openVisits.reduce((sum, v) => sum + (itemById.get(v.workItemId)?.amount ?? 0), 0)

    const blockedShare = m.wip > 0 ? m.blockedWip / m.wip : 0
    const untouchedShare = m.wip > 0 ? m.untouchedWip / m.wip : 0

    let primaryDriver: BottleneckFinding['primaryDriver'] = 'queue'
    if (blockedShare >= 0.5) primaryDriver = 'external'
    else if (m.reworkRate >= 0.25) primaryDriver = 'rework'
    else if (m.incidentsPer100 >= 10) primaryDriver = 'errors'
    else if (untouchedShare >= 0.6 || m.touchShare < 0.2) primaryDriver = 'idle_wait'
    else if (m.touchHoursP90 > m.slaTouchTarget * 1.5) primaryDriver = 'slow_work'
    else primaryDriver = 'queue'

    return {
      stageCode: m.stageCode,
      stageName: m.stageName,
      sector: m.sector,
      team: m.team,
      score: round(score, 1),
      components: {
        queueDays: round(components.queueDays, 3),
        waitVsSla: round(components.waitVsSla, 3),
        breachRate: round(components.breachRate, 3),
        rework: round(components.rework, 3),
        incidents: round(components.incidents, 3),
      },
      primaryDriver,
      explanation: explainBottleneck(m, primaryDriver),
      itemsStuck: m.wip,
      valueStuckIdr: Math.round(valueStuckIdr),
    }
  })

  return findings.sort((a, b) => b.score - a.score)
}

function explainBottleneck(m: StageMetrics, driver: BottleneckFinding['primaryDriver']): string {
  const stuck = `${m.wip} item tertahan`
  switch (driver) {
    case 'external':
      return `${stuck}, ${m.blockedWip} di antaranya menunggu pihak luar. Perbaikannya di pengelolaan vendor/ekspedisi, bukan di tim internal.`
    case 'rework':
      return `${Math.round(m.reworkRate * 100)}% item harus kembali ke stage ini. Akar masalahnya ada di stage sebelumnya — kapasitas di sini terbuang untuk mengulang.`
    case 'errors':
      return `${m.incidentsPer100} kesalahan per 100 item bersumber di sini. Perbaiki kontrolnya sebelum menambah orang.`
    case 'idle_wait':
      return `${m.untouchedWip} item belum ada yang mulai kerjakan; hanya ${Math.round(m.touchShare * 100)}% waktu dipakai bekerja. Ini masalah kepemilikan pekerjaan, bukan kecepatan orang.`
    case 'slow_work':
      return `Waktu pengerjaan p90 ${m.touchHoursP90} jam vs target ${m.slaTouchTarget} jam. Periksa alat kerja, kejelasan instruksi, dan kompleksitas kasus.`
    default:
      return `${stuck} dengan kecepatan penyelesaian ${m.throughputPerDay}/hari — butuh ${m.queueDays} hari hanya untuk menghabiskan antrean yang ada sekarang.`
  }
}

// ============================================================
// Metrik kesalahan
// ============================================================

export interface IncidentMetrics {
  total: number
  bySeverity: Record<string, number>
  byType: Record<string, number>
  byAttribution: Record<string, number>
  bySector: Record<string, number>
  /**
   * Kesalahan yang lolos ke stage berikutnya sebelum ketahuan.
   * Ini metrik terpenting di bagian ini: kesalahan yang ketahuan di tempat itu
   * murah, yang ketahuan di tangan pelanggan itu mahal.
   */
  escapeRate: number
  /** Rata-rata jumlah stage yang terlewati sebelum kesalahan ketahuan. */
  avgEscapeDistance: number
  /** Kesalahan yang baru ketahuan dari komplain pelanggan. Angka ini idealnya nol. */
  customerDetectedCount: number
  totalDelayHours: number
  totalCostIdr: number
  /** Pola berulang: jenis+stage yang sama muncul lagi. Ini target perbaikan proses. */
  recurringPatterns: Array<{
    stageCode: string
    type: IncidentType
    count: number
    distinctPeople: number
    /** True kalau sudah dilakukan ≥3 orang berbeda → hampir pasti masalah proses. */
    systemic: boolean
  }>
  /** Prinsip Pareto: sedikit pasangan stage+jenis yang menyumbang mayoritas kesalahan. */
  paretoTop: Array<{ stageCode: string; type: IncidentType; count: number; cumulativeShare: number }>
}

export function computeIncidentMetrics(dataset: OpsDataset, options: MetricsOptions = {}): IncidentMetrics {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const from = windowStart(dataset.snapshotAt, windowDays)
  const incidents = dataset.incidents.filter((i) => Date.parse(i.occurredAt) >= from)

  const bySeverity: Record<string, number> = {}
  const byType: Record<string, number> = {}
  const byAttribution: Record<string, number> = {}
  const bySector: Record<string, number> = {}

  let escaped = 0
  let escapeDistanceSum = 0
  let escapeDistanceCount = 0
  let totalDelayHours = 0
  let totalCostIdr = 0
  let customerDetectedCount = 0

  const patternKey = (i: Incident): string => `${i.occurredAtStage}::${i.type}`
  const patterns = new Map<
    string,
    { stageCode: string; type: IncidentType; count: number; people: Set<string>; systemicPeople: number }
  >()

  for (const incident of incidents) {
    bySeverity[incident.severity] = (bySeverity[incident.severity] ?? 0) + 1
    byType[incident.type] = (byType[incident.type] ?? 0) + 1
    byAttribution[incident.attribution] = (byAttribution[incident.attribution] ?? 0) + 1

    const sector = getStage(incident.occurredAtStage)?.sector ?? 'PROC'
    bySector[sector] = (bySector[sector] ?? 0) + 1

    if (incident.occurredAtStage !== incident.detectedAtStage) {
      escaped += 1
      const distance = stageDistance(incident.occurredAtStage, incident.detectedAtStage)
      if (distance !== null && distance > 0) {
        escapeDistanceSum += distance
        escapeDistanceCount += 1
      }
    }

    if (incident.detectionMethod === 'customer_complaint') customerDetectedCount += 1
    totalDelayHours += incident.delayImpactHours ?? 0
    totalCostIdr += incident.costImpactIdr ?? 0

    const key = patternKey(incident)
    const existing = patterns.get(key)
    if (existing) {
      existing.count += 1
      if (incident.personId) existing.people.add(incident.personId)
      existing.systemicPeople = Math.max(existing.systemicPeople, incident.systemicDistinctPeople ?? 0)
    } else {
      patterns.set(key, {
        stageCode: incident.occurredAtStage,
        type: incident.type,
        count: 1,
        people: new Set(incident.personId ? [incident.personId] : []),
        systemicPeople: incident.systemicDistinctPeople ?? 0,
      })
    }
  }

  const patternList = [...patterns.values()].sort((a, b) => b.count - a.count)
  let cumulative = 0
  const paretoTop = patternList.slice(0, 10).map((p) => {
    cumulative += p.count
    return {
      stageCode: p.stageCode,
      type: p.type,
      count: p.count,
      cumulativeShare: incidents.length > 0 ? round(cumulative / incidents.length, 3) : 0,
    }
  })

  return {
    total: incidents.length,
    bySeverity,
    byType,
    byAttribution,
    bySector,
    escapeRate: incidents.length > 0 ? round(escaped / incidents.length, 3) : 0,
    avgEscapeDistance: escapeDistanceCount > 0 ? round(escapeDistanceSum / escapeDistanceCount) : 0,
    customerDetectedCount,
    totalDelayHours: round(totalDelayHours),
    totalCostIdr: Math.round(totalCostIdr),
    recurringPatterns: patternList
      .filter((p) => p.count > 1)
      .map((p) => ({
        stageCode: p.stageCode,
        type: p.type,
        count: p.count,
        // Ambil yang terbesar: setelah reklasifikasi, personId dikosongkan,
        // jadi jumlah orang aslinya hanya tersisa di systemicDistinctPeople.
        distinctPeople: Math.max(p.people.size, p.systemicPeople),
        systemic: Math.max(p.people.size, p.systemicPeople) >= 3,
      })),
    paretoTop,
  }
}

/**
 * Reklasifikasi otomatis: kesalahan berpola sistemik dipindah dari 'person'
 * ke 'process'.
 *
 * Aturannya: jenis kesalahan yang sama, di stage yang sama, dilakukan oleh
 * `minDistinctPeople` orang berbeda di dalam jendela waktu → itu bukan soal
 * orangnya. Mengganti atau menegur orang tidak akan menghentikannya; yang perlu
 * diubah adalah prosedur, validasi sistem, atau beban kerjanya.
 *
 * Fungsi ini tidak mengubah data asli — ia mengembalikan salinan. Insiden yang
 * direklasifikasi diberi catatan di `rootCause` agar keputusannya bisa dilacak.
 */
export function reclassifySystemicIncidents(
  incidents: Incident[],
  options: { windowDays?: number; minDistinctPeople?: number; referenceAt: string } = {
    referenceAt: new Date(0).toISOString(),
  },
): Incident[] {
  const windowDays = options.windowDays ?? 30
  const minPeople = options.minDistinctPeople ?? 3
  const from = Date.parse(options.referenceAt) - windowDays * 86_400_000

  const groups = new Map<string, Set<string>>()
  for (const incident of incidents) {
    if (Date.parse(incident.occurredAt) < from) continue
    if (!incident.personId) continue
    const key = `${incident.occurredAtStage}::${incident.type}`
    const set = groups.get(key)
    if (set) set.add(incident.personId)
    else groups.set(key, new Set([incident.personId]))
  }

  const systemicKeys = new Set(
    [...groups.entries()].filter(([, people]) => people.size >= minPeople).map(([key]) => key),
  )

  return incidents.map((incident) => {
    const key = `${incident.occurredAtStage}::${incident.type}`
    if (!systemicKeys.has(key) || incident.attribution !== 'person') return incident
    const people = groups.get(key)?.size ?? 0
    return {
      ...incident,
      attribution: 'process' as const,
      personId: null,
      systemicPattern: true,
      systemicDistinctPeople: people,
      rootCause:
        incident.rootCause ??
        `Direklasifikasi otomatis dari 'person' ke 'process': kesalahan sejenis di stage yang sama dilakukan ${people} orang berbeda dalam ${windowDays} hari.`,
    }
  })
}

// ============================================================
// Kartu skor sub-tim & individu
// ============================================================

export interface TeamScorecard {
  teamId: string
  teamName: string
  sector: SectorId
  headcount: number
  itemsHandled: number
  /** Beban per orang di jendela analisis — konteks wajib sebelum menilai kecepatan. */
  itemsPerPerson: number
  medianResponseHours: number
  medianTouchHours: number
  onTimeHandoffPct: number
  incidentsSourced: number
  incidentsEscaped: number
  /** Selisih waktu kejadian vs pencatatan. Tinggi = data tim ini tidak bisa dipercaya. */
  medianRecordingLagHours: number
  /** Cakupan pencatatan: berapa persen kunjungan punya timestamp lengkap. */
  timestampCompletenessPct: number
}

export function computeTeamScorecards(
  dataset: OpsDataset,
  visits: StageVisit[],
  options: MetricsOptions = {},
): TeamScorecard[] {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const from = windowStart(dataset.snapshotAt, windowDays)

  const teamByName = new Map(dataset.teams.map((t) => [t.name, t]))
  const grouped = new Map<string, StageVisit[]>()
  for (const visit of visits) {
    if (visit.completedAt === null || Date.parse(visit.completedAt) < from) continue
    const list = grouped.get(visit.team)
    if (list) list.push(visit)
    else grouped.set(visit.team, [visit])
  }

  const incidentsByTeamStage = new Map<string, { sourced: number; escaped: number }>()
  for (const incident of dataset.incidents) {
    if (Date.parse(incident.occurredAt) < from) continue
    const team = getStage(incident.occurredAtStage)?.team ?? 'unknown'
    const entry = incidentsByTeamStage.get(team) ?? { sourced: 0, escaped: 0 }
    entry.sourced += 1
    if (incident.occurredAtStage !== incident.detectedAtStage) entry.escaped += 1
    incidentsByTeamStage.set(team, entry)
  }

  return [...grouped.entries()]
    .map(([teamName, teamVisits]): TeamScorecard => {
      const master = teamByName.get(teamName)
      const responses = teamVisits.map((v) => v.waitHours).filter((v): v is number => v !== null)
      const touches = teamVisits.map((v) => v.touchHours).filter((v): v is number => v !== null)
      const lags = teamVisits.map((v) => v.recordingLagHours).filter((v): v is number => v !== null)
      const onTime = teamVisits.filter((v) => !v.waitBreached && !v.touchBreached).length
      const complete = teamVisits.filter((v) => v.arrivedAt !== null && v.startedAt !== null).length
      const headcount = master?.headcount ?? 1
      const incidents = incidentsByTeamStage.get(teamName) ?? { sourced: 0, escaped: 0 }

      return {
        teamId: master?.id ?? teamName,
        teamName,
        sector: teamVisits[0].sector,
        headcount,
        itemsHandled: teamVisits.length,
        itemsPerPerson: round(teamVisits.length / Math.max(1, headcount), 1),
        medianResponseHours: round(median(responses)),
        medianTouchHours: round(median(touches)),
        onTimeHandoffPct: round((onTime / teamVisits.length) * 100, 1),
        incidentsSourced: incidents.sourced,
        incidentsEscaped: incidents.escaped,
        medianRecordingLagHours: round(median(lags)),
        timestampCompletenessPct: round((complete / teamVisits.length) * 100, 1),
      }
    })
    .sort((a, b) => a.onTimeHandoffPct - b.onTimeHandoffPct)
}

export interface PersonScorecard {
  personId: string
  personName: string
  teamName: string
  itemsHandled: number
  /** Seberapa cepat mengambil pekerjaan dari antrean (jam kerja, median). */
  medianResponseHours: number
  /** Seberapa cepat menyelesaikan setelah mulai (jam kerja, median). */
  medianTouchHours: number
  /** Median waktu pengerjaan rekan satu tim — pembanding yang adil. */
  teamMedianTouchHours: number
  onTimeHandoffPct: number
  /** Insiden yang setelah ditelusuri memang atribusi individu. */
  incidentsAttributed: number
  medianRecordingLagHours: number
  /**
   * Peringatan pembacaan. Selalu tampilkan bersama angkanya, jangan pernah
   * dipisah — sampel kecil dan beban berat menghasilkan angka yang menyesatkan.
   */
  caveats: string[]
}

const MIN_SAMPLE_FOR_JUDGEMENT = 15

export function computePersonScorecards(
  dataset: OpsDataset,
  visits: StageVisit[],
  options: MetricsOptions = {},
): PersonScorecard[] {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const from = windowStart(dataset.snapshotAt, windowDays)
  const personById = new Map(dataset.people.map((p) => [p.id, p]))
  const teamById = new Map(dataset.teams.map((t) => [t.id, t]))

  const relevant = visits.filter(
    (v) => v.actorPersonId !== null && v.completedAt !== null && Date.parse(v.completedAt) >= from,
  )

  const teamTouchSamples = new Map<string, number[]>()
  for (const visit of relevant) {
    if (visit.touchHours === null) continue
    const list = teamTouchSamples.get(visit.team)
    if (list) list.push(visit.touchHours)
    else teamTouchSamples.set(visit.team, [visit.touchHours])
  }

  const incidentsByPerson = new Map<string, number>()
  for (const incident of dataset.incidents) {
    if (Date.parse(incident.occurredAt) < from) continue
    if (incident.attribution !== 'person' || !incident.personId) continue
    incidentsByPerson.set(incident.personId, (incidentsByPerson.get(incident.personId) ?? 0) + 1)
  }

  const grouped = new Map<string, StageVisit[]>()
  for (const visit of relevant) {
    const key = visit.actorPersonId as string
    const list = grouped.get(key)
    if (list) list.push(visit)
    else grouped.set(key, [visit])
  }

  return [...grouped.entries()]
    .map(([personId, personVisits]): PersonScorecard => {
      const person = personById.get(personId)
      const teamName = person ? (teamById.get(person.teamId)?.name ?? personVisits[0].team) : personVisits[0].team
      const responses = personVisits.map((v) => v.waitHours).filter((v): v is number => v !== null)
      const touches = personVisits.map((v) => v.touchHours).filter((v): v is number => v !== null)
      const lags = personVisits.map((v) => v.recordingLagHours).filter((v): v is number => v !== null)
      const onTime = personVisits.filter((v) => !v.waitBreached && !v.touchBreached).length
      const teamMedianTouch = median(teamTouchSamples.get(personVisits[0].team) ?? [])

      const caveats: string[] = []
      if (personVisits.length < MIN_SAMPLE_FOR_JUDGEMENT) {
        caveats.push(
          `Sampel kecil (${personVisits.length} item). Belum cukup untuk kesimpulan tentang individu.`,
        )
      }
      const blockedHeavy = personVisits.filter((v) => v.blockedHours > 0).length
      if (blockedHeavy / personVisits.length > 0.3) {
        caveats.push(
          `${Math.round((blockedHeavy / personVisits.length) * 100)}% pekerjaannya sempat tertahan pihak luar.`,
        )
      }
      const incompleteTimestamps = personVisits.filter((v) => v.arrivedAt === null || v.startedAt === null).length
      if (incompleteTimestamps / personVisits.length > 0.3) {
        caveats.push('Timestamp tidak lengkap pada sebagian besar item — angka waktu di sini belum bisa dipercaya.')
      }

      return {
        personId,
        personName: person?.name ?? personId,
        teamName,
        itemsHandled: personVisits.length,
        medianResponseHours: round(median(responses)),
        medianTouchHours: round(median(touches)),
        teamMedianTouchHours: round(teamMedianTouch),
        onTimeHandoffPct: round((onTime / personVisits.length) * 100, 1),
        incidentsAttributed: incidentsByPerson.get(personId) ?? 0,
        medianRecordingLagHours: round(median(lags)),
        caveats,
      }
    })
    .sort((a, b) => a.onTimeHandoffPct - b.onTimeHandoffPct)
}

// ============================================================
// Lead time end-to-end
// ============================================================

export interface FlowMetrics {
  /** Objek kerja selesai di jendela analisis. */
  completed: number
  /** Lead time kalender dari lahir sampai selesai, hari. */
  leadTimeDaysP50: number
  leadTimeDaysP90: number
  /** Total jam kerja yang benar-benar dipakai bekerja di seluruh jalur. */
  touchHoursP50: number
  /**
   * Rasio efisiensi alur: waktu kerja ÷ total waktu berjalan.
   * Di perusahaan besar tanpa perbaikan alur, angka ini biasanya 5–15%.
   * Artinya 85–95% waktu adalah menunggu — dan itulah ruang perbaikan terbesar,
   * jauh lebih besar daripada menuntut orang bekerja lebih cepat.
   */
  flowEfficiency: number
  /** Ketepatan janji: selesai sebelum atau pada `promisedAt`. */
  onTimePct: number
  /** Item yang masih terbuka dan sudah melewati tanggal janji. */
  overdueOpen: number
  /** Waktu tertahan per sektor — untuk melihat sektor mana penyumbang terbesar. */
  waitHoursBySector: Record<string, number>
}

export function computeFlowMetrics(
  dataset: OpsDataset,
  visits: StageVisit[],
  options: MetricsOptions = {},
): FlowMetrics {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const from = windowStart(dataset.snapshotAt, windowDays)
  const snapshotMs = Date.parse(dataset.snapshotAt)

  const visitsByItem = new Map<string, StageVisit[]>()
  for (const visit of visits) {
    const list = visitsByItem.get(visit.workItemId)
    if (list) list.push(visit)
    else visitsByItem.set(visit.workItemId, [visit])
  }

  const completedItems = dataset.workItems.filter(
    (i) => i.closedAt !== null && Date.parse(i.closedAt) >= from && i.status === 'completed',
  )

  const leadTimes: number[] = []
  const touchTotals: number[] = []
  const waitTotals: number[] = []
  let onTime = 0
  let promisedCount = 0

  for (const item of completedItems) {
    const leadHours = calendarHoursBetween(item.createdAt, item.closedAt as string)
    leadTimes.push(leadHours / 24)

    const itemVisits = visitsByItem.get(item.id) ?? []
    touchTotals.push(itemVisits.reduce((sum, v) => sum + (v.touchHours ?? 0), 0))
    waitTotals.push(itemVisits.reduce((sum, v) => sum + (v.waitHours ?? 0), 0))

    if (item.promisedAt) {
      promisedCount += 1
      if (Date.parse(item.closedAt as string) <= Date.parse(item.promisedAt)) onTime += 1
    }
  }

  const waitHoursBySector: Record<string, number> = {}
  for (const visit of visits) {
    if (visit.completedAt === null || Date.parse(visit.completedAt) < from) continue
    waitHoursBySector[visit.sector] = round((waitHoursBySector[visit.sector] ?? 0) + (visit.waitHours ?? 0))
  }

  const medianTouch = median(touchTotals)
  const medianWait = median(waitTotals)

  return {
    completed: completedItems.length,
    leadTimeDaysP50: round(percentile(leadTimes, 50)),
    leadTimeDaysP90: round(percentile(leadTimes, 90)),
    touchHoursP50: round(medianTouch),
    flowEfficiency: medianTouch + medianWait > 0 ? round(medianTouch / (medianTouch + medianWait), 3) : 0,
    onTimePct: promisedCount > 0 ? round((onTime / promisedCount) * 100, 1) : 0,
    overdueOpen: dataset.workItems.filter(
      (i) => i.closedAt === null && i.promisedAt !== undefined && Date.parse(i.promisedAt) < snapshotMs,
    ).length,
    waitHoursBySector,
  }
}

// ============================================================
// Seri harian (tren)
// ============================================================

export interface DailyPoint {
  /** 'YYYY-MM-DD' di zona Asia/Jakarta. */
  date: string
  /** Kunjungan stage yang selesai pada hari itu. */
  completed: number
  /** Di antaranya yang melewati SLA. */
  breached: number
  /** Jumlah pekerjaan yang masih berjalan pada akhir hari itu. */
  wip: number
}

/**
 * Tren harian throughput, pelanggaran SLA, dan WIP.
 *
 * Dihitung dari kunjungan stage yang sama, bukan dari sumber lain — supaya
 * angka di grafik tren tidak pernah berbeda dari angka di kartu metrik.
 * Opsional `sector` membatasi ke satu sektor.
 */
export function computeDailySeries(
  dataset: OpsDataset,
  visits: StageVisit[],
  options: MetricsOptions & { sector?: SectorId } = {},
): DailyPoint[] {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const snapshotMs = Date.parse(dataset.snapshotAt)
  const scoped = options.sector ? visits.filter((v) => v.sector === options.sector) : visits

  const points: DailyPoint[] = []
  for (let dayOffset = windowDays - 1; dayOffset >= 0; dayOffset -= 1) {
    const dayEndMs = snapshotMs - dayOffset * 86_400_000
    const dayStartMs = dayEndMs - 86_400_000
    let completed = 0
    let breached = 0
    let wip = 0

    for (const visit of scoped) {
      const completedMs = visit.completedAt ? Date.parse(visit.completedAt) : null
      if (completedMs !== null && completedMs > dayStartMs && completedMs <= dayEndMs) {
        completed += 1
        if (visit.waitBreached || visit.touchBreached) breached += 1
      }
      const arrivedMs = visit.arrivedAt ? Date.parse(visit.arrivedAt) : null
      if (arrivedMs !== null && arrivedMs <= dayEndMs && (completedMs === null || completedMs > dayEndMs)) {
        wip += 1
      }
    }

    points.push({
      date: new Date(dayEndMs).toISOString().slice(0, 10),
      completed,
      breached,
      wip,
    })
  }
  return points
}

// ============================================================
// Penelusuran lintas sektor
// ============================================================

export interface TraceStep {
  workItemId: string
  documentNumber: string
  type: WorkItem['type']
  stageCode: string
  stageName: string
  sector: SectorId
  arrivedAt: string | null
  completedAt: string | null
  waitHours: number | null
  touchHours: number | null
  actorPersonName: string | null
  /** True kalau langkah ini penyumbang keterlambatan terbesar di rantai. */
  isWorstDelay: boolean
  breached: boolean
}

/**
 * Telusuri satu objek kerja beserta seluruh objek yang terhubung, lalu urutkan
 * jadi satu garis waktu.
 *
 * Ini jawaban untuk pertanyaan yang paling sering ditanyakan manajemen:
 * "kenapa order pelanggan A telat?" — dan jawabannya sering ada di sektor lain,
 * misalnya PO material yang tertahan sembilan hari di persetujuan finance.
 */
export function traceWorkItem(dataset: OpsDataset, visits: StageVisit[], rootWorkItemId: string): TraceStep[] {
  const itemById = new Map(dataset.workItems.map((i) => [i.id, i]))
  const personById = new Map(dataset.people.map((p) => [p.id, p]))

  const chain = new Set<string>()
  const queue = [rootWorkItemId]
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (chain.has(id)) continue
    chain.add(id)
    const item = itemById.get(id)
    if (!item) continue
    for (const link of item.links) queue.push(link.targetWorkItemId)
    // Ikuti juga arah sebaliknya: objek lain yang merujuk ke objek ini.
    for (const other of dataset.workItems) {
      if (other.links.some((l) => l.targetWorkItemId === id)) queue.push(other.id)
    }
  }

  const steps = visits
    .filter((v) => chain.has(v.workItemId))
    .map((visit): TraceStep => {
      const item = itemById.get(visit.workItemId)
      const stage = getStage(visit.stageCode)
      return {
        workItemId: visit.workItemId,
        documentNumber: item?.documentNumber ?? visit.workItemId,
        type: item?.type ?? 'purchase_request',
        stageCode: visit.stageCode,
        stageName: stage?.name ?? visit.stageCode,
        sector: visit.sector,
        arrivedAt: visit.arrivedAt,
        completedAt: visit.completedAt,
        waitHours: visit.waitHours,
        touchHours: visit.touchHours,
        actorPersonName: visit.actorPersonId ? (personById.get(visit.actorPersonId)?.name ?? null) : null,
        isWorstDelay: false,
        breached: visit.waitBreached || visit.touchBreached,
      }
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.arrivedAt ?? a.completedAt ?? '')
      const bTime = Date.parse(b.arrivedAt ?? b.completedAt ?? '')
      if (Number.isNaN(aTime)) return 1
      if (Number.isNaN(bTime)) return -1
      return aTime - bTime
    })

  let worstIndex = -1
  let worstDelay = -1
  steps.forEach((step, index) => {
    const delay = (step.waitHours ?? 0) + (step.touchHours ?? 0)
    if (delay > worstDelay) {
      worstDelay = delay
      worstIndex = index
    }
  })
  if (worstIndex >= 0) steps[worstIndex].isWorstDelay = true

  return steps
}

// ============================================================
// Kualitas data
// ============================================================

/**
 * Nilai apakah metrik tiap stage boleh dipercaya.
 *
 * Ini bukan tambahan opsional. Dashboard yang menampilkan angka meyakinkan dari
 * data setengah kosong lebih berbahaya daripada tidak punya dashboard: keputusan
 * diambil atas dasar yang salah, dan ketika kesalahannya ketahuan, seluruh
 * sistem kehilangan kepercayaan sekaligus.
 */
export function assessDataQuality(_dataset: OpsDataset, visits: StageVisit[]): StageDataQuality[] {
  const byStage = new Map<string, StageVisit[]>()
  for (const visit of visits) {
    const list = byStage.get(visit.stageCode)
    if (list) list.push(visit)
    else byStage.set(visit.stageCode, [visit])
  }

  const results: StageDataQuality[] = []
  for (const stage of mainPath()) {
    const stageVisits = byStage.get(stage.code) ?? []
    if (stageVisits.length === 0) {
      results.push({
        stageCode: stage.code,
        arrivedCoveragePct: 0,
        startedCoveragePct: 0,
        medianRecordingLagHours: 0,
        confidence: 'insufficient',
      })
      continue
    }

    const arrivedPct = (stageVisits.filter((v) => v.arrivedAt !== null).length / stageVisits.length) * 100
    const startedPct = (stageVisits.filter((v) => v.startedAt !== null).length / stageVisits.length) * 100
    const lags = stageVisits.map((v) => v.recordingLagHours).filter((v): v is number => v !== null)
    const medianLag = median(lags)

    let confidence: StageDataQuality['confidence']
    if (stageVisits.length < 10) confidence = 'insufficient'
    else if (arrivedPct >= 90 && startedPct >= 90 && medianLag <= 4) confidence = 'high'
    else if (arrivedPct >= 70 && startedPct >= 50 && medianLag <= 12) confidence = 'medium'
    else confidence = 'low'

    results.push({
      stageCode: stage.code,
      arrivedCoveragePct: round(arrivedPct, 1),
      startedCoveragePct: round(startedPct, 1),
      medianRecordingLagHours: round(medianLag),
      confidence,
    })
  }
  return results
}

// ============================================================
// Snapshot lengkap
// ============================================================

export interface DashboardSnapshot {
  snapshotAt: string
  windowDays: number
  flow: FlowMetrics
  stages: StageMetrics[]
  bottlenecks: BottleneckFinding[]
  incidents: IncidentMetrics
  teams: TeamScorecard[]
  people: PersonScorecard[]
  dataQuality: StageDataQuality[]
  /** Tren harian throughput, pelanggaran SLA, dan WIP. */
  daily: DailyPoint[]
  /** Ringkasan tiga kalimat untuk pimpinan — apa yang macet, kenapa, berapa nilainya. */
  headline: string
}

/**
 * Satu pemanggilan menghasilkan seluruh isi dashboard.
 * Inilah fungsi yang nantinya dipanggil endpoint API tiap beberapa menit,
 * hasilnya di-cache, lalu disajikan ke UI.
 */
export function buildDashboardSnapshot(dataset: OpsDataset, options: MetricsOptions = {}): DashboardSnapshot {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const normalizedIncidents = reclassifySystemicIncidents(dataset.incidents, {
    referenceAt: dataset.snapshotAt,
    windowDays,
  })
  const normalized: OpsDataset = { ...dataset, incidents: normalizedIncidents }

  const visits = buildStageVisits(normalized)
  const stages = computeStageMetrics(normalized, visits, options)
  const bottlenecks = detectBottlenecks(normalized, stages, visits)
  const incidents = computeIncidentMetrics(normalized, options)
  const flow = computeFlowMetrics(normalized, visits, options)

  return {
    snapshotAt: dataset.snapshotAt,
    windowDays,
    flow,
    stages,
    bottlenecks,
    incidents,
    teams: computeTeamScorecards(normalized, visits, options),
    people: computePersonScorecards(normalized, visits, options),
    dataQuality: assessDataQuality(normalized, visits),
    daily: computeDailySeries(normalized, visits, options),
    headline: buildHeadline(bottlenecks, flow, incidents),
  }
}

function buildHeadline(
  bottlenecks: BottleneckFinding[],
  flow: FlowMetrics,
  incidents: IncidentMetrics,
): string {
  const top = bottlenecks[0]
  if (!top) return 'Belum ada data yang cukup untuk menyimpulkan titik macet.'

  const value =
    top.valueStuckIdr > 0
      ? ` Nilai tertahan di titik ini Rp ${(top.valueStuckIdr / 1_000_000).toFixed(1)} juta.`
      : ''
  const efficiency = `Secara keseluruhan hanya ${Math.round(flow.flowEfficiency * 100)}% dari waktu proses dipakai untuk bekerja — sisanya menunggu.`
  const escape =
    incidents.total > 0
      ? ` ${Math.round(incidents.escapeRate * 100)}% kesalahan baru ketahuan di stage berikutnya, rata-rata ${incidents.avgEscapeDistance} stage setelah terjadi.`
      : ''

  return `Titik macet utama: ${top.stageName} (${top.team}) dengan ${top.itemsStuck} item tertahan.${value} ${efficiency}${escape}`
}

export { median as medianOf, percentile as percentileOf }
