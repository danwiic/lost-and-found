'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'

/** Ends the session and returns to sign in. */
export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOut() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('failed')
      router.push('/login')
      router.refresh()
    } catch {
      setError("We couldn't sign you out. Check your connection and try again.")
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        className={buttonClass({ variant: 'secondary' })}
      >
        {busy ? <Spinner /> : null}
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}
