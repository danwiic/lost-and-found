import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { homeFor } from '@/components/shell/nav-items'
import { readSession } from '@/lib/session'

export const metadata: Metadata = {
  title: 'Sign in — Lost and Found',
}

export default async function LoginPage() {
  const user = await readSession()
  // Already signed in: staff go to their dashboard, students to their desk.
  if (user) redirect(homeFor(user.role))

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
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="measure mt-2 mb-6 text-sm text-ink-muted">
            Your reports, possible matches and claims are private to your account.
          </p>
          <LoginForm />
        </div>

        <p className="mt-6 text-sm text-ink-muted">
          No account yet?{' '}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  )
}
