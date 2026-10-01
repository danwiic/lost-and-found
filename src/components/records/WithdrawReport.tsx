'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorNote } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { deleteItem } from '@/lib/client-api'

/**
 * Withdrawing a report is destructive and irreversible, so it asks first
 * (agents/UX.md §13.1) and names the action rather than saying "Confirm"
 * (§21). The API refuses once a claim process has begun, and that refusal is
 * shown as-is rather than being swallowed.
 */
export function WithdrawReport({ itemId, name }: { itemId: string; name: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function withdraw() {
    setBusy(true)
    setError(null)
    try {
      await deleteItem(itemId)
      notify('Report withdrawn.')
      setOpen(false)
      router.push('/my-reports')
      router.refresh()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "We couldn't withdraw that report. Try again.",
      )
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass({ variant: 'quiet' })}
      >
        Withdraw report
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        busy={busy}
        title="Withdraw this report?"
        description={`“${name}” will be removed from the list, along with its photo and any possible matches. This cannot be undone.`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className={buttonClass({ variant: 'secondary' })}
            >
              Keep report
            </button>
            <button
              type="button"
              onClick={() => void withdraw()}
              disabled={busy}
              className={buttonClass({ variant: 'danger' })}
            >
              {busy ? <Spinner /> : null}
              {busy ? 'Withdrawing…' : 'Withdraw Report'}
            </button>
          </>
        }
      >
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </Dialog>
    </>
  )
}
