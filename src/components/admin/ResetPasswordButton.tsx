'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorNote } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { issueTemporaryPassword } from '@/lib/client-api'

type Issued = { name: string; email: string; temporaryPassword: string }

/**
 * Issue a temporary password for one account. Two states, one dialog: confirm
 * the reset, then read the password out.
 *
 * Once the password is on screen the dialog cannot be dismissed by Escape or a
 * backdrop click — only by the explicit Done button. The value is shown once and
 * never stored in readable form, so an accidental dismissal would mean issuing
 * another one; the guard is for the hand-off, not for ceremony.
 */
export function ResetPasswordButton({
  account,
}: {
  account: { id: string; name: string; email: string }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function close() {
    setOpen(false)
    // The row's badge may have changed while the dialog was open.
    if (issued) router.refresh()
    setIssued(null)
    setError(null)
    setCopied(false)
  }

  async function issue() {
    setBusy(true)
    setError(null)
    try {
      const result = await issueTemporaryPassword(account.id)
      setIssued({
        name: result.account.name,
        email: result.account.email,
        temporaryPassword: result.temporaryPassword,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not reset that password.')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.temporaryPassword)
      setCopied(true)
    } catch {
      // Clipboard access can be refused; the password stays selectable on screen.
      setCopied(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass({ variant: 'secondary', size: 'sm' })}
      >
        Reset password
      </button>

      <Dialog
        open={open}
        onClose={close}
        busy={issued !== null}
        title={issued ? 'Temporary password issued' : 'Issue a temporary password?'}
        description={
          issued
            ? undefined
            : `For ${account.name} (${account.email}). Their current password stops working immediately, and every device signed in to that account is signed out. Nothing else in the app opens until they choose a password of their own.`
        }
        footer={
          issued ? (
            <button type="button" onClick={close} className={buttonClass({ variant: 'primary' })}>
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                data-dialog-dismiss
                className={buttonClass({ variant: 'secondary' })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={issue}
                disabled={busy}
                className={buttonClass({ variant: 'primary' })}
              >
                {busy ? <Spinner /> : null}
                {busy ? 'Issuing…' : 'Issue temporary password'}
              </button>
            </>
          )
        }
      >
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {issued ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-sunk px-4 py-3">
              <p className="nums font-mono text-lg tracking-[0.2em] text-ink select-all">
                {issued.temporaryPassword}
              </p>
              <button
                type="button"
                onClick={copy}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                <Icon name="copy" className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <p className="measure text-sm text-ink-muted">
              Shown once — it cannot be looked up again, and it stops working as soon as{' '}
              {issued.name} chooses a password. Read it to them or write it down before closing
              this.
            </p>
          </div>
        ) : (
          <p className="measure text-sm text-ink-muted">
            Ask for their student ID first, and check it matches the account on screen. This is
            recorded against your name.
          </p>
        )}
      </Dialog>
    </>
  )
}
