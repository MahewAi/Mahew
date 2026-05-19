import type { Contributor, Role } from '@/lib/types'

export interface AgentRegistryItem {
  id: Contributor
  folder: string
  parent: Role
  status: 'ready' | 'missing' | 'support'
  responsibility: string
}

export const agentRegistry: AgentRegistryItem[] = [
  { id: 'ceo', folder: 'direktur', parent: 'ceo', status: 'ready', responsibility: 'Orkestrasi keputusan dan sintesis final.' },
  { id: 'coo', folder: 'coo', parent: 'coo', status: 'ready', responsibility: 'Operasi internal, staffing, sistem kerja.' },
  { id: 'cmo', folder: 'cmo', parent: 'cmo', status: 'ready', responsibility: 'Market, brand, channel, growth.' },
  { id: 'cfo', folder: 'cfo', parent: 'cfo', status: 'ready', responsibility: 'Model bisnis, pricing, ROI, budget.' },
  { id: 'cco', folder: 'cco', parent: 'cco', status: 'ready', responsibility: 'Dokumen, editorial, source quality.' },
  { id: 'hr_systems', folder: 'hr-system-designer', parent: 'coo', status: 'ready', responsibility: 'Staffing, SOP, sistem prosedur kerja.' },
  { id: 'production_manager', folder: 'production-planner', parent: 'coo', status: 'ready', responsibility: 'Supply chain, vendor production, fulfillment.' },
  { id: 'curator', folder: 'product-curator', parent: 'coo', status: 'ready', responsibility: 'Katalog produk, supplier vetting, curation logic.' },
  { id: 'brand_strategist', folder: 'brand-strategist', parent: 'cmo', status: 'ready', responsibility: 'Positioning, narrative, identity DNA.' },
  { id: 'market_researcher', folder: 'market-researcher', parent: 'cmo', status: 'ready', responsibility: 'Market, competitor, segment, trend research.' },
  { id: 'sales_strategist', folder: 'sales-strategy-designer', parent: 'cmo', status: 'ready', responsibility: 'Funnel, channel strategy, conversion.' },
  { id: 'innovation_scout', folder: 'innovation-scout', parent: 'cmo', status: 'ready', responsibility: 'Trend scouting dan eksplorasi cross-industry.' },
  { id: 'business_designer', folder: 'business-designer', parent: 'cfo', status: 'ready', responsibility: 'Revenue stream, operating model, business architecture.' },
  { id: 'financial_analyst', folder: 'financial-analyst', parent: 'cfo', status: 'ready', responsibility: 'ROI, forecast, pricing, budget discipline.' },
  { id: 'document_writer', folder: 'document-architect', parent: 'cco', status: 'ready', responsibility: 'Business plan, technical doc, internal memo.' },
  { id: 'editorial', folder: 'editorial-reviewer', parent: 'cco', status: 'ready', responsibility: 'Copywriting dan brand voice consistency.' },
  { id: 'web_researcher', folder: 'web-researcher', parent: 'cco', status: 'ready', responsibility: 'Web source gathering dan fact-checking.' },
]
