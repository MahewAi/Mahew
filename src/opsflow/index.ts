/**
 * OpsFlow — Sistem pemantauan alur kerja ekosistem perusahaan.
 *
 * Pembelian → Finance → Produksi → Pengiriman, dipecah sampai tingkat sub-tim,
 * dengan tiga pertanyaan yang harus bisa dijawab kapan saja:
 *
 *   1. Di mana macetnya sekarang?          → detectBottlenecks()
 *   2. Kenapa macet di situ?               → BottleneckFinding.primaryDriver
 *   3. Kesalahan apa yang berulang, di mana, dan apakah itu soal orang
 *      atau soal proses?                   → computeIncidentMetrics() +
 *                                            reclassifySystemicIncidents()
 *
 * Titik masuk yang paling praktis: `buildDashboardSnapshot(dataset)`.
 *
 * Dokumen perancangan lengkap ada di `docs/opsflow/`.
 */

export {
  SECTORS,
  SECTOR_ORDER,
  STAGES,
  allTeams,
  getStage,
  mainPath,
  mainPathSlaHours,
  stageDistance,
  stagesOfSector,
  type SectorDef,
  type SectorId,
  type StageDef,
  type StageKind,
  type WorkItemType,
} from './taxonomy.ts'

export type {
  ApprovalRule,
  BomLine,
  Carrier,
  Customer,
  Delegation,
  EventType,
  Incident,
  IncidentAttribution,
  IncidentSeverity,
  IncidentType,
  IngestionRun,
  Item,
  OpsDataset,
  Person,
  ProductionLine,
  SlaTarget,
  StageDataQuality,
  Supplier,
  Team,
  WorkCalendar,
  WorkEvent,
  WorkItem,
  WorkItemLink,
  WorkItemStatus,
} from './schema.ts'

export {
  CONTINUOUS_CALENDAR,
  DEFAULT_CALENDAR,
  calendarHoursBetween,
  resolveCalendar,
  workingHoursBetween,
} from './calendar.ts'

export {
  BOTTLENECK_CAPS,
  BOTTLENECK_WEIGHTS,
  assessDataQuality,
  buildDashboardSnapshot,
  buildStageVisits,
  computeFlowMetrics,
  computeIncidentMetrics,
  computePersonScorecards,
  computeStageMetrics,
  computeTeamScorecards,
  detectBottlenecks,
  reclassifySystemicIncidents,
  resolveSla,
  traceWorkItem,
  type BottleneckFinding,
  type DashboardSnapshot,
  type FlowMetrics,
  type IncidentMetrics,
  type MetricsOptions,
  type PersonScorecard,
  type StageMetrics,
  type StageVisit,
  type TeamScorecard,
  type TraceStep,
} from './metrics.ts'

export { buildExampleDataset, type ExampleOptions } from './example.ts'
