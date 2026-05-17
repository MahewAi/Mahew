interface CodeBlockProps {
  language: string
  content: string
}

export function CodeBlock({ language, content }: CodeBlockProps) {
  return (
    <figure className="my-4">
      <div className="rounded-[14px] glass-soft shadow-glass overflow-hidden">
        <div className="px-3.5 py-2 border-b border-white/30 flex items-center justify-between">
          <span className="text-label-caps text-text-muted">{language || 'code'}</span>
        </div>
        <pre className="px-3.5 py-3 text-xs leading-relaxed text-text-primary overflow-x-auto font-mono">
          <code>{content}</code>
        </pre>
      </div>
    </figure>
  )
}
