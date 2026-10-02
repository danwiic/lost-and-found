import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { homeFor } from '@/components/shell/nav-items'
import { readSession } from '@/lib/session'

export const metadata: Metadata = {
  title: 'Create an account — Lost and Found',
}

export default async function RegisterPage() {
  const user = await readSession()
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
          <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="measure mt-2 mb-6 text-sm text-ink-muted">
            Report an item or file a claim. Your records are private to you.
          </p>
          <RegisterForm />
        </div>

        <p className="mt-6 text-sm text-ink-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
