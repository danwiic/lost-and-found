'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navFor } from '@/components/shell/nav-items'
import { Icon } from '@/components/ui/Icon'

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SideNav({ role, unread }: { role: 'USER' | 'ADMIN'; unread: number }) {
  const pathname = usePathname()
  const items = navFor(role)

  return (
    <nav
      aria-label="Primary"
      className="hidden border-r border-line bg-rail lg:sticky lg:top-0 lg:block lg:h-screen"
    >
      <div className="flex h-full flex-col gap-8 px-4 py-6">
        <Link href="/" className="block rounded-lg px-3 py-1">
          <span className="block text-base leading-tight font-semibold tracking-tight text-ink">
            Lost &amp; Found
          </span>
          <span className="mt-1 block text-xs text-ink-muted">OSAS Records Desk</span>
        </Link>

        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[0.9375rem] transition-colors duration-200 ease-[var(--ease-out-expo)] ${
                    active
                      ? 'bg-accent-soft font-medium text-accent'
                      : 'text-ink-muted hover:bg-surface-sunk hover:text-ink'
                  }`}
                >
                  <Icon
                    name={item.icon}
                    className={`h-[1.125rem] w-[1.125rem] ${active ? 'text-accent' : 'text-ink-muted'}`}
                  />
                  <span>{item.label}</span>
                  {item.href === '/notifications' && unread > 0 ? (
                    <span className="nums ml-auto rounded-full bg-attention-soft px-2 text-xs font-medium text-attention">
                      {unread}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>

        <p className="mt-auto px-3 text-xs leading-relaxed text-ink-muted">
          Matching suggests,
          <br />
          OSAS verifies
        </p>
      </div>
    </nav>
  )
}
