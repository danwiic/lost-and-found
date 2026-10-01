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

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'home' },
  { href: '/admin/lost', label: 'Lost Items', icon: 'ledger' },
  { href: '/admin/found', label: 'Found Items', icon: 'ledger' },
  { href: '/admin/claims', label: 'Claims', icon: 'claim' },
  { href: '/admin/returns', label: 'Returns', icon: 'check' },
]

/** OSAS staff keep their own navigation, separated from the student one. */
export function navFor(role: 'USER' | 'ADMIN'): NavItem[] {
  return role === 'ADMIN' ? ADMIN_NAV : USER_NAV
}
