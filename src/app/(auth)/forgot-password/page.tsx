import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { readSession } from '@/lib/session'

export const metadata: Metadata = {
  title: 'Reset your password — Lost and Found',
}

/**
 * Public by design — it exists for people who cannot sign in. There is no mail
 * provider in this project, so a reset is proved with the account's security
 * questions rather than a link; the page says so up front instead of promising
 * an email that will never arrive.
 */
export default async function ForgotPasswordPage() {
  const user = await readSession()
  if (user) redirect('/')

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
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="measure mt-2 mb-6 text-sm text-ink-muted">
            Answer your security questions, then choose a new password. No email is sent.
          </p>
          <ForgotPasswordForm />
        </div>

        <p className="mt-6 text-sm text-ink-muted">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
