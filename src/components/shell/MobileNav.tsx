'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { activeNavHref, mobileNavFor } from '@/components/shell/nav-items'
import { Icon } from '@/components/ui/Icon'

/**
 * Compact navigation bar for small screens (agents/UX.md §3.1). It follows the
 * viewer's role: OSAS staff get their own five destinations, so the whole staff
 * surface is reachable on a phone instead of only by typing an /admin URL
 * (agents/UX.md §3.2 — admin functionality is separated, not hidden).
 */
export function MobileNav({ role, unread }: { role: 'USER' | 'ADMIN'; unread: number }) {
  const pathname = usePathname()
  const items = mobileNavFor(role)
  const current = activeNavHref(pathname, items)

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-rail/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      {/* Six destinations for staff (Intake sits beside the Desk), five for
          students — the grid follows the bar's own contents. */}
      <ul className={`grid ${items.length === 6 ? 'grid-cols-6' : 'grid-cols-5'}`}>
        {items.map((item) => {
          const active = current === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 px-1 py-3 text-[0.6875rem] transition-colors duration-200 ease-[var(--ease-out-expo)] ${
                  active ? 'text-accent' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icon
                  name={item.icon}
                  className={`h-[1.25rem] w-[1.25rem] ${active ? 'text-accent' : 'text-ink-muted'}`}
                />
                <span className={active ? 'font-medium' : undefined}>{item.label}</span>
                {item.href === '/notifications' && unread > 0 ? (
                  <span className="nums absolute top-1.5 right-[22%] rounded-full bg-attention-soft px-1 text-[0.625rem] font-medium text-attention">
                    {unread}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
