import type { IconName } from '@/components/ui/Icon'

export type NavItem = { href: string; label: string; icon: IconName }

/**
 * The user navigation from agents/UX.md §3.1. Order matters: it is the order of
 * the working day — what is waiting on you, then what you are looking for, then
 * your own records, then your account.
 */
export const USER_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/browse', label: 'Browse Items', icon: 'search' },
  { href: '/my-reports', label: 'My Reports', icon: 'ledger' },
  { href: '/claims', label: 'My Claims', icon: 'claim' },
  { href: '/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/profile', label: 'Profile', icon: 'user' },
]

/**
 * The bottom bar on small screens keeps five destinations; Profile stays
 * reachable from the account menu in the header, so no destination is lost
 * (agents/UX.md §3.1).
 */
export const MOBILE_NAV: NavItem[] = USER_NAV.filter((item) => item.href !== '/profile')

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'home' },
  // Second in the day's order: what someone just handed over the counter.
  { href: '/admin/intake', label: 'Intake', icon: 'plus' },
  { href: '/admin/lost', label: 'Lost Items', icon: 'ledger' },
  { href: '/admin/found', label: 'Found Items', icon: 'ledger' },
  { href: '/admin/claims', label: 'Claims', icon: 'claim' },
  { href: '/admin/returns', label: 'Returns', icon: 'check' },
  // Last, because it is the rare errand: a student who cannot sign in.
  { href: '/admin/accounts', label: 'Accounts', icon: 'user' },
]

/**
 * The admin bottom bar. Shortened labels so five destinations fit a phone
 * width without truncating: the destination is the same, only the wording is
 * tighter. Notifications is deliberately absent — the header bell already
 * carries the unread count, and it is the one destination the user bar and the
 * admin bar share.
 */
export const ADMIN_MOBILE_NAV: NavItem[] = [
  { href: '/admin', label: 'Desk', icon: 'home' },
  { href: '/admin/intake', label: 'Intake', icon: 'plus' },
  { href: '/admin/lost', label: 'Lost', icon: 'ledger' },
  { href: '/admin/found', label: 'Found', icon: 'ledger' },
  { href: '/admin/claims', label: 'Claims', icon: 'claim' },
  { href: '/admin/returns', label: 'Returns', icon: 'check' },
]

/** OSAS staff keep their own navigation, separated from the student one. */
export function navFor(role: 'USER' | 'ADMIN'): NavItem[] {
  return role === 'ADMIN' ? ADMIN_NAV : USER_NAV
}

/**
 * Where an account belongs when nothing more specific was asked for: after
 * signing in, or when tapping the wordmark. Staff land on the OSAS dashboard,
 * not the student desk — the desk is still reachable, but it should never be
 * the first thing an admin sees, because every control on it is the wrong one
 * for their day. A `?next=` destination always wins over this.
 */
export function homeFor(role: 'USER' | 'ADMIN'): string {
  return role === 'ADMIN' ? '/admin' : '/'
}

/**
 * The one destination a pathname belongs to: the longest href that matches it
 * exactly or as a parent path. Without picking the longest, `/admin` claims
 * every `/admin/...` page and the dashboard stays lit while another admin
 * destination is the one being viewed.
 */
export function activeNavHref(pathname: string, items: readonly NavItem[]): string | null {
  let match: string | null = null

  for (const item of items) {
    const hit =
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname.startsWith(`${item.href}/`)
    if (hit && (match === null || item.href.length > match.length)) match = item.href
  }

  return match
}

/** The same split for the small-screen bottom bar (agents/UX.md §3.2). */
export function mobileNavFor(role: 'USER' | 'ADMIN'): NavItem[] {
  return role === 'ADMIN' ? ADMIN_MOBILE_NAV : MOBILE_NAV
}
