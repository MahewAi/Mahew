/**
 * OpsFlow — Ikon per stage.
 *
 * Dipisahkan dari `taxonomy.ts` dengan sengaja: taksonomi adalah kebenaran soal
 * proses dan dipakai juga oleh mesin metrik serta adapter ingestion, jadi ia
 * tidak boleh ikut membawa urusan tampilan.
 *
 * Ikonnya dipilih agar stasiun di peta bisa dikenali sebelum labelnya dibaca —
 * gudang untuk penerimaan, timbangan untuk rekonsiliasi, truk untuk keberangkatan.
 * Semua dari satu keluarga ikon (Lucide) dengan ketebalan garis yang sama, karena
 * mencampur beberapa set ikon adalah salah satu hal yang paling cepat membuat
 * tampilan terasa murah.
 */

import {
  Ban,
  Banknote,
  Boxes,
  CalendarCheck,
  CheckCircle2,
  LogIn,
  MessageSquareText,
  PauseCircle,
  PencilLine,
  PlayCircle,
  TriangleAlert,
  Undo2,
  UserRoundCog,
  XCircle,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileCheck2,
  FileSearch,
  HandCoins,
  Handshake,
  ListChecks,
  Microscope,
  Navigation,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  Radar,
  Receipt,
  Scale,
  ScanSearch,
  ScrollText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/** Ikon per kode stage. Kode yang tidak terdaftar jatuh ke ikon per jenis stage. */
export const STAGE_ICON: Record<string, LucideIcon> = {
  // Pembelian
  'PROC-10': ClipboardList,
  'PROC-20': ListChecks,
  'PROC-30': Search,
  'PROC-40': Handshake,
  'PROC-50': FileCheck2,
  'PROC-60': Radar,
  'PROC-70': PackageCheck,
  'PROC-80': ScanSearch,
  'PROC-90': PackageOpen,

  // Finance
  'FIN-10': Wallet,
  'FIN-20': FileSearch,
  'FIN-30': Receipt,
  'FIN-40': ShieldCheck,
  'FIN-50': CalendarClock,
  'FIN-60': Banknote,
  'FIN-70': ClipboardCheck,
  'FIN-80': Scale,

  // Produksi
  'PRD-10': CalendarRange,
  'PRD-20': Boxes,
  'PRD-30': PackageOpen,
  'PRD-40': Wrench,
  'PRD-50': Factory,
  'PRD-60': Microscope,
  'PRD-70': Wrench,
  'PRD-80': ShieldCheck,
  'PRD-90': Warehouse,

  // Pengiriman
  'DEL-10': ShoppingCart,
  'DEL-20': ScrollText,
  'DEL-30': PackagePlus,
  'DEL-40': CalendarCheck,
  'DEL-50': Truck,
  'DEL-60': Navigation,
  'DEL-70': ClipboardCheck,
  'DEL-80': PackageOpen,
  'DEL-90': HandCoins,
}

export function iconForStage(code: string): LucideIcon {
  return STAGE_ICON[code] ?? ClipboardList
}

/**
 * Ikon per jenis dokumen. Dipakai di kotak masuk dan daftar dokumen terkait:
 * bentuknya dikenali lebih dulu daripada nomornya dibaca, jadi mata tidak perlu
 * mengeja "PO-2026-0001" untuk tahu itu purchase order.
 */
export const WORK_ITEM_ICON: Record<string, LucideIcon> = {
  purchase_request: ClipboardList,
  purchase_order: FileCheck2,
  goods_receipt: PackageCheck,
  payable_invoice: Receipt,
  payment: Banknote,
  sales_order: ShoppingCart,
  production_order: Factory,
  qc_record: Microscope,
  delivery_order: Truck,
  return_claim: PackageOpen,
  receivable_invoice: HandCoins,
}

export function iconForWorkItem(type: string): LucideIcon {
  return WORK_ITEM_ICON[type] ?? ClipboardList
}

/**
 * Ikon per jenis event di jejak audit.
 *
 * Bukan hiasan: sebelumnya jejak audit hanya dibedakan lewat titik berwarna,
 * dan warna sendirian bukan penanda yang bisa diandalkan — pengguna dengan buta
 * warna, layar redup, atau sekadar mata lelah akan kehilangan bedanya. Bentuk
 * ikon bekerja tanpa syarat itu.
 */
export const EVENT_ICON: Record<string, LucideIcon> = {
  arrived: LogIn,
  started: PlayCircle,
  completed: CheckCircle2,
  approved: ShieldCheck,
  rejected: XCircle,
  returned: Undo2,
  blocked: PauseCircle,
  unblocked: PlayCircle,
  reassigned: UserRoundCog,
  field_changed: PencilLine,
  cancelled: Ban,
  incident_logged: TriangleAlert,
  note: MessageSquareText,
}

export function iconForEvent(type: string): LucideIcon {
  return EVENT_ICON[type] ?? MessageSquareText
}
