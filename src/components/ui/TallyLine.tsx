import { formatCount } from '@/lib/format'

export type Tally = { label: string; value: number; emphasis?: boolean }

/**
 * The user's own totals, read left to right as one line rather than as a grid
 * of metric cards. Deliberately not the "big number, small label, accent"
 * hero-metric template: modest numerals, no cards, no accent unless a figure
 * is actually asking for the user's attention. Tabular figures keep the
 * numbers aligned without spending the monospace face on them.
 */
export function TallyLine({ items }: { items: Tally[] }) {
  return (
    <dl className="flex flex-wrap items-end gap-x-8 gap-y-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-[5rem]">
          <dt className="text-xs font-medium text-ink-muted">{item.label}</dt>
          <dd
            className={`nums mt-1 text-xl leading-none font-semibold ${
              item.emphasis ? 'text-attention' : 'text-ink'
            }`}
          >
            {formatCount(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}
