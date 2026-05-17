import { useEffect, useId, useRef, useState } from 'react'
import mermaid from 'mermaid'

interface MermaidBlockProps {
  code: string
  caption?: string
}

let initialized = false
function ensureInit() {
  if (initialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      primaryColor: '#F4EBDC', // accent-bg
      primaryTextColor: '#1F1A14',
      primaryBorderColor: '#B8956B',
      lineColor: '#807767',
      secondaryColor: '#EDDFC8',
      tertiaryColor: '#FAF8F4',
      background: 'transparent',
      mainBkg: '#F4EBDC',
      secondBkg: '#EDDFC8',
      tertiaryBkg: '#FAF8F4',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '13px',
    },
    flowchart: {
      curve: 'basis',
      htmlLabels: true,
      padding: 12,
    },
    securityLevel: 'loose',
  })
  initialized = true
}

export function MermaidBlock({ code, caption }: MermaidBlockProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reactId = useId().replace(/:/g, '')
  const id = `mermaid-${reactId}`
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureInit()
    let cancelled = false

    const render = async () => {
      try {
        const { svg } = await mermaid.render(id, code)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Render error')
        }
      }
    }
    render()

    return () => {
      cancelled = true
    }
  }, [code, id])

  return (
    <figure className="my-4">
      <div className="rounded-[16px] glass-soft shadow-glass p-4 flex justify-center overflow-x-auto">
        {error ? (
          <div className="text-meta text-status-decision p-2">Diagram tidak dapat dirender: {error}</div>
        ) : (
          <div ref={ref} className="[&_svg]:max-w-full [&_svg]:h-auto" />
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 text-meta text-text-muted italic text-center">{caption}</figcaption>
      )}
    </figure>
  )
}
