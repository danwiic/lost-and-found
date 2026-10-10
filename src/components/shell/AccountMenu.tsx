'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Button'
import { initials } from '@/lib/format'

/**
 * Account menu: a lightweight popover (agents/UX.md §4.5), never a modal. Escape
 * closes it, a click outside closes it, and focus returns to the trigger.
 */
export function AccountMenu({
  name,
  email,
  role,
}: {
  name: string
  email: string
  role: 'USER' | 'ADMIN'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function signOut() {
    setSigningOut(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Sign out failed')
      router.push('/login')
      router.refresh()
    } catch {
      setSigningOut(false)
      setError("We couldn't sign you out. Check your connection and try again.")
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-sm text-ink transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-surface-sunk"
      >
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-xs font-medium text-accent"
        >
          {initials(name)}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:block">{name}</span>
        <Icon name="user" className="h-4 w-4 text-ink-muted sm:hidden" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="drawer-overlay absolute right-0 z-50 mt-2 w-60 rounded-lg border border-line bg-surface p-1 shadow-lift"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-xs text-ink-muted">{email}</p>
            {role === 'ADMIN' ? (
              <p className="mt-1 text-xs font-medium text-ink-muted">OSAS staff</p>
            ) : null}
          </div>

          {role === 'ADMIN' ? (
            // The staff bottom bar is full at six destinations, so the rare
            // errand — helping a student who cannot sign in — lives here.
            <Link
              href="/admin/accounts"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink"
            >
              <Icon name="copy" className="h-4 w-4" />
              Student and personnel accounts
            </Link>
          ) : null}

          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${role === 'ADMIN' ? '' : 'mt-1 '}flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink`}
          >
            <Icon name="user" className="h-4 w-4" />
            Profile
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink disabled:opacity-50"
          >
            {signingOut ? <Spinner /> : <Icon name="arrow" className="h-4 w-4" />}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>

          {error ? (
            <p role="alert" className="px-3 pt-1 pb-2 text-xs text-refused">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
