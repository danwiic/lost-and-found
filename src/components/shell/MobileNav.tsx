'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MOBILE_NAV } from '@/components/shell/nav-items'
import { Icon } from '@/components/ui/Icon'

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Compact navigation bar for small screens (agents/UX.md §3.1). */
export function MobileNav({ unread }: { unread: number }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-rail/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href)
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
