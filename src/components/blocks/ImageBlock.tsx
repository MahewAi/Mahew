interface ImageBlockProps {
  src: string
  alt: string
  caption?: string
}

export function ImageBlock({ src, alt, caption }: ImageBlockProps) {
  return (
    <figure className="my-4">
      <div className="rounded-[16px] overflow-hidden glass-soft shadow-glass">
        <img src={src} alt={alt} loading="lazy" className="w-full h-auto block" />
      </div>
      {caption && (
        <figcaption className="mt-2 text-meta text-text-muted italic text-center">{caption}</figcaption>
      )}
    </figure>
  )
}
