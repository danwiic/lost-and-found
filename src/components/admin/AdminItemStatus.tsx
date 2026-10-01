'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { setItemStatus } from '@/lib/client-api'
import { itemStatusLabel, itemStatusMeaning } from '@/lib/format'

const STATUSES = ['PENDING', 'POSSIBLE_MATCH', 'CLAIM_PENDING', 'RETURNED', 'CLOSED']

/** Statuses that end the ordinary workflow and are worth confirming. */
const CONSEQUENTIAL = new Set(['RETURNED', 'CLOSED'])

/**
 * OSAS correcting a record's state by hand. It exists for the exceptions — a
 * mis-filed report, an item withdrawn from the shelf — not as the normal route
 * to Returned, which is recording a return against an approved claim
 * (agents/UX.md §12, Rule 2). The confirmation for the two terminal states says
 * so, so nobody marks an item Returned instead of releasing it.
 */
export function AdminItemStatus({ itemId, status }: { itemId: string; status: string }) {
  const router = useRouter()
  const { notify } = useToast()

  const [next, setNext] = useState(status)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changed = next !== status
  const consequential = changed && CONSEQUENTIAL.has(next)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await setItemStatus(itemId, next)
      notify(`Status updated to ${itemStatusLabel(next)}.`)
      setConfirming(false)
      router.refresh()
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "We couldn't update that status. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!changed) return
        if (consequential) setConfirming(true)
        else void save()
      }}
      className="space-y-4"
    >
      <Field
        id="item-status"
        label="Item status"
        hint={changed ? itemStatusMeaning(next) : 'What OSAS has recorded about this item.'}
      >
        {(props) => (
          <select
            {...props}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className={inputClass()}
          >
            {STATUSES.map((code) => (
              <option key={code} value={code}>
                {itemStatusLabel(code)}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !changed}
          className={buttonClass({ variant: 'secondary', size: 'sm' })}
        >
          Update Status
        </button>
        {changed ? (
          <button
            type="button"
            onClick={() => {
              setNext(status)
              setError(null)
            }}
            className={buttonClass({ variant: 'quiet', size: 'sm' })}
          >
            Undo
          </button>
        ) : (
          <p className="text-xs text-ink-muted">No change to save.</p>
        )}
      </div>

      {error && !confirming ? <ErrorNote>{error}</ErrorNote> : null}

      <Dialog
        open={confirming}
        onClose={() => (busy ? undefined : setConfirming(false))}
        busy={busy}
        tone={next === 'CLOSED' ? 'danger' : 'default'}
        title={`Mark this item ${itemStatusLabel(next)}?`}
        description={
          next === 'RETURNED'
            ? 'Returned means OSAS handed the item to its owner. If you are releasing an approved claim, record the return on the claim instead — that notifies the claimant and keeps the return history complete.'
            : 'A closed item leaves the open workflow. It can be reopened by setting another status, but no claim can be filed while it is closed.'
        }
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
              onClick={() => void save()}
              disabled={busy}
              className={buttonClass({ variant: next === 'CLOSED' ? 'danger' : 'primary' })}
            >
              {busy ? <Spinner /> : null}
              {busy ? 'Saving…' : `Mark ${itemStatusLabel(next)}`}
            </button>
          </>
        }
      >
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </Dialog>
    </form>
  )
}
