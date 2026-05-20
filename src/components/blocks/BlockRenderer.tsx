import { lazy, Suspense, type ReactNode } from 'react'
import type { BriefBlock } from '@/lib/types'
import { TableBlock } from './TableBlock'
import { ImageBlock } from './ImageBlock'
import { GeneratedImageBlock } from './GeneratedImageBlock'
import { CodeBlock } from './CodeBlock'

const MarkdownBlock = lazy(() => import('./MarkdownBlock').then((module) => ({ default: module.MarkdownBlock })))
const ChartBlock = lazy(() => import('./ChartBlock').then((module) => ({ default: module.ChartBlock })))
const MermaidBlock = lazy(() => import('./MermaidBlock').then((module) => ({ default: module.MermaidBlock })))
const CalloutBlock = lazy(() => import('./CalloutBlock').then((module) => ({ default: module.CalloutBlock })))
const GridBlock = lazy(() => import('./GridBlock').then((module) => ({ default: module.GridBlock })))
const CSuiteVoteBlock = lazy(() => import('./CSuiteVoteBlock').then((module) => ({ default: module.CSuiteVoteBlock })))

interface BlockRendererProps {
  block: BriefBlock
}

/** Dispatch BriefBlock ke component rendering yang sesuai. */
export function BlockRenderer({ block }: BlockRendererProps) {
  switch (block.type) {
    case 'markdown':
      return (
        <LazyBlock>
          <MarkdownBlock content={block.content} />
        </LazyBlock>
      )
    case 'table':
      return (
        <TableBlock
          headers={block.headers}
          rows={block.rows}
          align={block.align}
          caption={block.caption}
        />
      )
    case 'chart':
      return (
        <LazyBlock>
          <ChartBlock
            kind={block.kind}
            data={block.data}
            options={block.options}
            caption={block.caption}
          />
        </LazyBlock>
      )
    case 'mermaid':
      return (
        <LazyBlock>
          <MermaidBlock code={block.code} caption={block.caption} />
        </LazyBlock>
      )
    case 'callout':
      return (
        <LazyBlock>
          <CalloutBlock variant={block.variant} title={block.title} content={block.content} />
        </LazyBlock>
      )
    case 'grid':
      return (
        <LazyBlock>
          <GridBlock columns={block.columns} items={block.items} />
        </LazyBlock>
      )
    case 'image':
      return <ImageBlock src={block.src} alt={block.alt} caption={block.caption} />
    case 'generated-image':
      return (
        <GeneratedImageBlock
          title={block.title}
          prompt={block.prompt}
          src={block.src}
          alt={block.alt}
          caption={block.caption}
          status={block.status}
          provider={block.provider}
          generatedAt={block.generatedAt}
          aspectRatio={block.aspectRatio}
        />
      )
    case 'code':
      return <CodeBlock language={block.language} content={block.content} />
    case 'csuite-vote':
      return (
        <LazyBlock>
          <CSuiteVoteBlock votes={block.votes} />
        </LazyBlock>
      )
  }
}

function LazyBlock({ children }: { children: ReactNode }) {
  return <Suspense fallback={<BlockLoading />}>{children}</Suspense>
}

function BlockLoading() {
  return (
    <div className="my-4 h-24 rounded-md border border-border-soft bg-white/52 shadow-soft" aria-label="Memuat blok" />
  )
}

interface BlockListProps {
  blocks: BriefBlock[]
}

/** Convenience component to render array of blocks. */
export function BlockList({ blocks }: BlockListProps) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </>
  )
}
