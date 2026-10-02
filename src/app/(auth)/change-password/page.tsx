import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'
import { homeFor } from '@/components/shell/nav-items'
import { SignOutButton } from '@/components/shell/SignOutButton'
import { readSession } from '@/lib/session'

export const metadata: Metadata = {
  title: 'Choose your password — Lost and Found',
}

/**
 * Where a staff-issued temporary password ends. It lives outside the signed-in
 * shell on purpose: the shell redirects here, so this page must not need it —
 * and while the flag is set there is nothing else to navigate to anyway.
 *
 * An account without the flag has no reason to be here and is sent back to
 * whichever desk belongs to its role.
 */
export default async function ChangePasswordPage() {
  const user = await readSession()
  if (!user) redirect('/login?next=/change-password')
  if (!user.mustChangePassword) redirect(homeFor(user.role))

  return (
    <main className="w-full">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <p className="text-lg leading-tight font-semibold tracking-tight text-ink">
            Lost &amp; Found
          </p>
          <p className="mt-1 text-xs text-ink-muted">OSAS Records Desk</p>
        </div>

        <div className="card-pad rounded-lg border border-line bg-surface">
          <h1 className="text-2xl font-semibold tracking-tight">Choose your password</h1>
          <p className="measure mt-2 mb-6 text-sm text-ink-muted">
            OSAS issued you a temporary password. Choose one only you know — it stops working the
            moment you save.
          </p>
          <ChangePasswordForm role={user.role} />
        </div>

        {/* There is no shell on this page, so the way out of a session has to be
            here: a shared phone can easily sign in with the wrong account. */}
        <div className="mt-6 space-y-3">
          <p className="text-sm text-ink-muted">Not your account? Sign out before continuing.</p>
          <SignOutButton />
        </div>
      </div>
    </main>
  )
}
