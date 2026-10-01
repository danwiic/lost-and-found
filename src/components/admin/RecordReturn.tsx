'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { recordReturn } from '@/lib/client-api'
import { localDay } from '@/lib/format'

/**
 * Recording the physical hand-over. Deliberately separate from approving the
 * claim: approval means OSAS verified the claim, a return record means the item
 * left the office (agents/UX.md §12, Rule 2). The confirmation says exactly
 * that, so the two are never conflated.
 */
export function RecordReturn({
  claimId,
  itemName,
  claimantName,
  claimDate,
}: {
  claimId: string
  itemName: string
  claimantName: string
  claimDate: string
}) {
  const router = useRouter()
  const { notify } = useToast()

  // The picker's bounds: the hand-over happened after the claim existed and
  // before now — both on the viewer's own clock.
  const today = localDay()
  const claimDay = localDay(claimDate)

  const [returnDate, setReturnDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validateDate(): string | null {
    if (!returnDate) return 'Enter the return date.'
    if (returnDate > today) return "The return date can't be in the future."
    if (returnDate < claimDay) return "The return date can't be before the claim was filed."
    return null
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const result = await recordReturn(claimId, { returnDate, notes })
      notify(result.message)
      setConfirming(false)
      router.refresh()
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "We couldn't record that return. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const problem = validateDate()
        setDateError(problem)
        if (problem) return
        setConfirming(true)
      }}
      noValidate
      className="space-y-6"
    >
      <Field
        id="returnDate"
        label="Return date"
        hint="The day the item physically left the office."
        error={dateError ?? undefined}
      >
        {(props) => (
          <input
            {...props}
            type="date"
            value={returnDate}
            onChange={(event) => {
              setReturnDate(event.target.value)
              // The picker only emits in-range values, so a stale message
              // would describe a problem that no longer exists.
              setDateError(null)
            }}
            min={claimDay}
            max={today}
            required
            className={inputClass({ invalid: Boolean(dateError) })}
          />
        )}
      </Field>

      <Field
        id="returnNotes"
        label="Relevant return information"
        optionalHint="Optional"
        hint="Anything worth recording about the hand-over."
      >
        {(props) => (
          <textarea
            {...props}
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="ID checked and photocopied. Item handed over at the OSAS counter."
            className={inputClass()}
          />
        )}
      </Field>

      <button type="submit" disabled={busy} className={buttonClass({ variant: 'primary' })}>
        Record Return
      </button>

      <Dialog
        open={confirming}
        onClose={() => (busy ? undefined : setConfirming(false))}
        busy={busy}
        title="Record this return?"
        description={`“${itemName}” will be marked Returned and ${claimantName} will be notified that it was released on ${returnDate}. This is the final step of the claim.`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className={buttonClass({ variant: 'secondary' })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className={buttonClass({ variant: 'primary' })}
            >
              {busy ? <Spinner /> : null}
              {busy ? 'Recording…' : 'Record Return'}
            </button>
          </>
        }
      >
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </Dialog>
    </form>
  )
}
