import Link from 'next/link'
import { AccountMenu } from '@/components/shell/AccountMenu'
import { inputClass } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import type { SessionUser } from '@/lib/session'

/**
 * Header band: the global search, notifications, and the account menu. The
 * search is a plain GET form, so it works before any JavaScript loads and lands
 * on Browse with the query applied.
 */
export function TopBar({ user, unread }: { user: SessionUser; unread: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="shrink-0 text-base font-semibold tracking-tight text-ink lg:hidden"
        >
          Lost &amp; Found
        </Link>

        <form
          action="/browse"
          method="get"
          role="search"
          className="relative min-w-0 flex-1 lg:max-w-md"
        >
          <label htmlFor="item-search" className="sr-only">
            Search items
          </label>
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle"
          />
          <input
            id="item-search"
            name="q"
            type="search"
            placeholder="Search items by name, colour or place"
            className={inputClass({ className: 'py-2 pl-8' })}
          />
        </form>

        {/* ml-auto pins the bell and account to the far edge once the search
            hits its desktop max width — otherwise dead space trails the row. */}
        <Link
          href="/notifications"
          className="relative ml-auto shrink-0 rounded-lg p-2 text-ink-muted transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-surface-sunk hover:text-ink"
        >
          <Icon name="bell" />
          <span className="sr-only">
            Notifications
            {unread > 0 ? `, ${unread} unread` : ', nothing unread'}
          </span>
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="nums absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-medium text-on-accent"
            >
              {unread}
            </span>
          ) : null}
        </Link>

        <AccountMenu name={user.name} email={user.email} role={user.role} />
      </div>
    </header>
  )
}
