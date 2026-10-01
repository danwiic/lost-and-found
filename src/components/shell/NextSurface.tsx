import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Panel } from '@/components/ui/Panel'

/**
 * Honest interim surface for routes that are designed but not built yet. It
 * states what the surface will do, names the endpoints already serving it, and
 * offers a way back — never a blank screen (agents/UX.md §16) and never a fake
 * control.
 */
export function NextSurface({
  title,
  what,
  endpoints,
  backHref = '/',
  backLabel = 'Back to Home',
}: {
  title: string
  what: string
  endpoints: string[]
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="page-stack">
      <div>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="measure mt-3 text-[0.9375rem] text-ink-muted">{what}</p>
      </div>

      <Panel className="card-pad">
        <p className="text-xs font-medium text-ink-muted">Build note · next surface</p>
        <p className="measure mt-2 text-sm text-ink">
          This screen is designed and its backend is already running and tested. It is being built
          surface by surface, in the same visual language as the desk.
        </p>

        <h2 className="mt-6 text-sm font-medium text-ink">Endpoints already serving it</h2>
        <ul className="mt-2 space-y-2">
          {endpoints.map((endpoint) => (
            // Monospace is kept here: these are literal codes, not prose.
            <li key={endpoint} className="data text-xs text-ink-muted">
              {endpoint}
            </li>
          ))}
        </ul>

        <Link href={backHref} className={`mt-6 ${buttonClass({ variant: 'secondary', size: 'sm' })}`}>
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          {backLabel}
        </Link>
      </Panel>
    </div>
  )
}
