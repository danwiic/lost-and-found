'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { decideClaim } from '@/lib/client-api'

/**
 * The two decisions OSAS makes on a claim. Each is its own labelled action —
 * never a single ambiguous button (agents/UX.md §11, §21) — and each asks for
 * confirmation first, because both are consequential (§13.1).
 *
 * The note is optional on approval and asked for on rejection, where §11.2
 * wants the reason recorded so the claimant is told why.
 */
export function ClaimDecision({
  claimId,
  claimantName,
  itemName,
}: {
  claimId: string
  claimantName: string
  itemName: string
}) {
  const router = useRouter()
  const { notify } = useToast()

  const [decision, setDecision] = useState<'APPROVE' | 'REJECT' | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    if (busy) return
    setDecision(null)
    setNote('')
    setError(null)
  }

  async function decide(action: 'APPROVE' | 'REJECT') {
    setBusy(true)
    setError(null)
    try {
      const result = await decideClaim(claimId, action, note)
      notify(result.message)
      setDecision(null)
      setNote('')
      router.refresh()
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "We couldn't record that decision. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setDecision('APPROVE')}
          className={buttonClass({ variant: 'primary' })}
        >
          Approve Claim
        </button>
        <button
          type="button"
          onClick={() => setDecision('REJECT')}
          className={buttonClass({ variant: 'danger' })}
        >
          Reject Claim
        </button>
      </div>

      <Dialog
        open={decision === 'APPROVE'}
        onClose={close}
        busy={busy}
        title="Approve claim?"
        description={`Approving this claim allows “${itemName}” to be released to ${claimantName}. Any other pending claim on the same item is rejected, and everyone is notified.`}
        footer={
          <>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className={buttonClass({ variant: 'secondary' })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void decide('APPROVE')}
              disabled={busy}
              className={buttonClass({ variant: 'primary' })}
            >
              {busy ? <Spinner /> : null}
              {busy ? 'Approving…' : 'Approve Claim'}
            </button>
          </>
        }
      >
        <Field
          id="approve-note"
          label="Decision note"
          optionalHint="Optional"
          hint="Recorded with the decision and shown to the claimant."
        >
          {(props) => (
            <input
              {...props}
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="ID verified at the office."
              className={inputClass()}
            />
          )}
        </Field>
        {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
      </Dialog>

      <Dialog
        open={decision === 'REJECT'}
        onClose={close}
        tone="danger"
        busy={busy}
        title="Reject claim?"
        description={`${claimantName} will be notified that the claim on “${itemName}” was rejected, and the item goes back on the list.`}
        footer={
          <>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className={buttonClass({ variant: 'secondary' })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void decide('REJECT')}
              disabled={busy}
              className={buttonClass({ variant: 'danger' })}
            >
              {busy ? <Spinner /> : null}
              {busy ? 'Rejecting…' : 'Reject Claim'}
            </button>
          </>
        }
      >
        <Field
          id="reject-note"
          label="Reason for rejection"
          hint="The claimant is shown this. Say what did not check out."
        >
          {(props) => (
            <textarea
              {...props}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="The proof of ownership did not match the item's distinguishing marks."
              className={inputClass()}
            />
          )}
        </Field>
        {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
      </Dialog>
    </>
  )
}
