'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { decideMatch } from '@/lib/client-api'

/**
 * The two decisions OSAS makes on a suggested pair. Each is its own labelled
 * action — never one ambiguous "review" button — and neither is destructive:
 * the Match row keeps its outcome, and confirming does not release anything by
 * itself.
 */
export function MatchDecision({ matchId }: { matchId: string }) {
  const router = useRouter()
  const { notify } = useToast()

  const [busy, setBusy] = useState<'CONFIRM' | 'DISMISS' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(action: 'CONFIRM' | 'DISMISS') {
    if (busy) return
    setBusy(action)
    setError(null)
    try {
      const result = await decideMatch(matchId, action)
      notify(result.message)
      router.refresh()
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "We couldn't record that decision. Try again.",
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void decide('CONFIRM')}
        disabled={busy !== null}
        className={buttonClass({ variant: 'secondary', size: 'sm' })}
      >
        {busy === 'CONFIRM' ? <Spinner /> : <Icon name="check" className="h-4 w-4" />}
        {busy === 'CONFIRM' ? 'Confirming…' : 'Confirm same item'}
      </button>
      <button
        type="button"
        onClick={() => void decide('DISMISS')}
        disabled={busy !== null}
        className={buttonClass({ variant: 'quiet', size: 'sm' })}
      >
        {busy === 'DISMISS' ? <Spinner /> : null}
        {busy === 'DISMISS' ? 'Dismissing…' : 'Not a match'}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-refused">
          {error}
        </p>
      ) : null}
    </div>
  )
}
