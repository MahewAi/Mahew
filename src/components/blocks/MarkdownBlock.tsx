import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownBlockProps {
  content: string
  className?: string
}

/**
 * Markdown renderer dengan GFM support, styled sesuai brand tokens.
 * Untuk inline rendering di brief detail body.
 */
export function MarkdownBlock({ content, className }: MarkdownBlockProps) {
  return (
    <div className={cn('text-text-primary', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[26px] leading-[30px] font-bold tracking-[-0.022em] text-text-primary mt-6 mb-3">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[20px] leading-[24px] font-bold tracking-[-0.015em] text-text-primary mt-6 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[16px] leading-[20px] font-semibold text-text-primary mt-4 mb-1.5">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-text-primary mb-3">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-text-primary">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-3 space-y-1.5 text-sm leading-relaxed text-text-secondary">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 space-y-1.5 text-sm leading-relaxed text-text-secondary list-decimal pl-5">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="flex gap-2 [&_p]:mb-0">
              <span aria-hidden="true" className="text-accent-dark shrink-0 select-none mt-0.5">•</span>
              <span className="flex-1 min-w-0">{children}</span>
            </li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-accent-dark underline underline-offset-2 hover:text-accent"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-4 border-l-2 border-accent italic text-sm leading-relaxed text-text-secondary">
              {children}
            </blockquote>
          ),
          code: ({ children, className: cls }) => {
            const isBlock = cls?.startsWith('language-')
            if (isBlock) {
              return (
                <pre className="my-3 p-3 rounded-[12px] glass-soft text-xs leading-relaxed text-text-primary overflow-x-auto font-mono">
                  <code>{children}</code>
                </pre>
              )
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-bg-soft text-[12px] font-mono text-accent-dark">
                {children}
              </code>
            )
          },
          hr: () => <hr className="my-5 border-border-soft" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-[12px] glass-soft">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-white/30">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2.5 text-left text-label-caps text-text-muted">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2.5 text-text-primary border-t border-white/20">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
