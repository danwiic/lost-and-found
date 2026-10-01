import type { ReactNode } from 'react'

/**
 * The one page container. Every surface renders inside it, so no page decides
 * its own width or gutters and nothing spans edge to edge:
 *
 *   1080px max width, centred, growing with the viewport (1240px at 1280px,
 *   1400px at 1536px, 1520px at 1900px — see `.page-measure`), so a wide
 *   monitor is used rather than left as empty margin
 *   20px horizontal padding on mobile, 32px from the `sm` breakpoint up
 *   32px above the first section, 48px below the last on desktop — and enough
 *   room underneath on mobile for the fixed bottom navigation.
 *
 * The gutters never change; only the measure does, so the page breathes wider
 * on large screens without the text running edge to edge.
 *
 * Sections are spaced 32px apart by `.page-stack` (see globals.css), so a page
 * only has to emit its sections as siblings. Inner rhythm is the section's own
 * business and always tighter than the gaps between sections.
 */
export function PageContainer({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="page-measure mx-auto w-full px-5 pt-8 pb-24 sm:px-8 lg:pt-12 lg:pb-12">
      <div className={`page-stack ${className}`}>{children}</div>
    </div>
  )
}
