'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Panel, PanelHeading } from '@/components/ui/Panel'
import { hideRecoveryPrompt } from '@/lib/client-api'

/**
 * The desk's one-time nudge to set up account recovery. It appears on the home
 * page of an account with no security questions and goes away for a fortnight
 * when dismissed — a prompt that cannot be put down stops being read, and this
 * one is a convenience, not a duty.
 *
 * It links to the profile rather than embedding the form: the questions are
 * changed in exactly one place, and two copies of that form would drift.
 */
export function RecoveryPrompt() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function dismiss() {
    setBusy(true)
    setError(null)
    try {
      await hideRecoveryPrompt()
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not dismiss that.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="border-accent/30">
      <PanelHeading
        title="Set up account recovery"
        description="Two minutes now, so a forgotten password is not a trip to the office."
      />

      <div className="px-6 py-6 sm:px-6">
        <p className="measure text-[0.9375rem] text-ink-muted">
          This system sends no reset emails. Instead, three security questions on your account are
          the way back in if you forget your password — and without them, only the OSAS office can
          reset it. You pick the questions and answer them yourself.
        </p>

        {error ? (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/profile#recovery" className={buttonClass({ variant: 'primary' })}>
            Set up security questions
          </Link>
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className={buttonClass({ variant: 'quiet' })}
          >
            {busy ? <Spinner /> : null}
            Not now
          </button>
        </div>
      </div>
    </Panel>
  )
}
