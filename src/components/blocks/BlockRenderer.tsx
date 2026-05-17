import type { BriefBlock } from '@/lib/types'
import { MarkdownBlock } from './MarkdownBlock'
import { TableBlock } from './TableBlock'
import { ChartBlock } from './ChartBlock'
import { MermaidBlock } from './MermaidBlock'
import { CalloutBlock } from './CalloutBlock'
import { GridBlock } from './GridBlock'
import { ImageBlock } from './ImageBlock'
import { CodeBlock } from './CodeBlock'
import { CSuiteVoteBlock } from './CSuiteVoteBlock'

interface BlockRendererProps {
  block: BriefBlock
}

/** Dispatch BriefBlock ke component rendering yang sesuai. */
export function BlockRenderer({ block }: BlockRendererProps) {
  switch (block.type) {
    case 'markdown':
      return <MarkdownBlock content={block.content} />
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
        <ChartBlock
          kind={block.kind}
          data={block.data}
          options={block.options}
          caption={block.caption}
        />
      )
    case 'mermaid':
      return <MermaidBlock code={block.code} caption={block.caption} />
    case 'callout':
      return <CalloutBlock variant={block.variant} title={block.title} content={block.content} />
    case 'grid':
      return <GridBlock columns={block.columns} items={block.items} />
    case 'image':
      return <ImageBlock src={block.src} alt={block.alt} caption={block.caption} />
    case 'code':
      return <CodeBlock language={block.language} content={block.content} />
    case 'csuite-vote':
      return <CSuiteVoteBlock votes={block.votes} />
  }
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
