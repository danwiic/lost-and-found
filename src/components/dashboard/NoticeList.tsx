'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { buttonClass, Spinner } from '@/components/ui/Button'
import { EmptyState, ErrorNote } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { LedgerList } from '@/components/ui/Panel'
import { PhotoFrame } from '@/components/ui/PhotoFrame'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { markAllNotificationsRead, setNotificationRead } from '@/lib/client-api'
import type { NoticeRow } from '@/lib/dashboard'
import { formatRelative } from '@/lib/format'

const HEADINGS: Record<string, string> = {
  POSSIBLE_MATCH: 'Possible match found',
  MATCH_CONFIRMED: 'Match confirmed',
  PASSWORD_RESET: 'Password reset',
  CLAIM_SUBMITTED: 'Claim submitted',
  CLAIM_APPROVED: 'Claim approved',
  CLAIM_REJECTED: 'Claim rejected',
  ITEM_RETURNED: 'Item returned',
}

/**
 * Notices as a ledger. Opening one marks it read (agents/UX.md §8.1); a notice
 * that has somewhere to go offers that action, and one that is informational
 * only offers "Mark as read" rather than a button that leads nowhere (§8.2).
 *
 * A match notice carries the OTHER item of the pair (see lib/match.ts), so the
 * row previews the item that matched — not the report the reader already knows
 * about — and the action opens that item's page.
 */
export function NoticeList({
  notices,
  allowMarkAll = false,
}: {
  notices: NoticeRow[]
  allowMarkAll?: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const unreadCount = notices.filter((notice) => !notice.read).length
  const mixed = unreadCount < notices.length

  async function markRead(id: string, options: { silent?: boolean } = {}) {
    setBusyId(id)
    setListError(null)
    try {
      await setNotificationRead(id, true)
      if (!options.silent) notify('Notification marked as read.')
      router.refresh()
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'We could not update that notice.')
    } finally {
      setBusyId(null)
    }
  }

  async function markAll() {
    setMarkingAll(true)
    setListError(null)
    try {
      await markAllNotificationsRead()
      notify('All notifications marked as read.')
      router.refresh()
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'We could not update your notices.')
    } finally {
      setMarkingAll(false)
    }
  }

  if (notices.length === 0) {
    return (
      <EmptyState
        title="You're all caught up."
        message="Possible matches, claim decisions, and returns will appear here as they happen."
      />
    )
  }

  return (
    <>
      {allowMarkAll && unreadCount > 0 ? (
        <div className="flex justify-end border-b border-line px-6 py-3 sm:px-6">
          <button
            type="button"
            onClick={markAll}
            disabled={markingAll}
            className={buttonClass({ variant: 'secondary', size: 'sm' })}
          >
            {markingAll ? <Spinner /> : null}
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        </div>
      ) : null}

      {listError ? (
        <div className="border-b border-line px-6 py-3 sm:px-6">
          <ErrorNote>{listError}</ErrorNote>
        </div>
      ) : null}

      <LedgerList>
        {notices.map((notice) => {
          const unread = !notice.read
          // A confirmed match still points at the counterpart item, but the
          // action it exists for is the claim: send the reader straight to the
          // claim form. If the item is no longer claimable the claim page
          // redirects back to the item, so the direct link is safe.
          const isMatch =
            notice.type === 'POSSIBLE_MATCH' || notice.type === 'MATCH_CONFIRMED'
          const isConfirmed = notice.type === 'MATCH_CONFIRMED'
          const canViewMatch = isMatch && Boolean(notice.itemId)

          return (
            <li key={notice.id} className={unread ? 'bg-accent-soft/60' : undefined}>
              <div className="flex items-start gap-4 px-6 py-4 sm:px-6">
                {notice.item ? (
                  <PhotoFrame src={notice.item.photoUrl} alt={notice.item.name} size="thumb" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-line bg-surface-sunk text-ink-muted"
                  >
                    <Icon name="bell" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-[0.9375rem] leading-snug font-medium">
                      {HEADINGS[notice.type] ?? 'Notice'}
                    </p>
                    <p className="text-xs text-ink-muted">{formatRelative(notice.createdAt)}</p>
                    {unread && mixed ? <Badge tone="attention">Unread</Badge> : null}
                  </div>

                  <p className="measure mt-1 text-sm text-ink-muted">{notice.message}</p>

                  {notice.item ? (
                    <p className="mt-2 text-xs text-ink-muted">
                      {isMatch ? 'Matched item' : 'Record'}: {notice.item.name}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canViewMatch ? (
                      <Link
                        href={
                          isConfirmed
                            ? `/items/${notice.itemId}/claim`
                            : `/items/${notice.itemId}`
                        }
                        onClick={() => {
                          // Opening the notice is what clears it. The PATCH is
                          // kept alive across the navigation by the client API.
                          if (unread) void markRead(notice.id, { silent: true })
                        }}
                        className={buttonClass({ variant: 'secondary', size: 'sm' })}
                      >
                        {isConfirmed ? 'File a Claim' : 'View Matched Item'}
                        <Icon name="arrow" className="h-4 w-4" />
                      </Link>
                    ) : unread ? (
                      <button
                        type="button"
                        onClick={() => void markRead(notice.id)}
                        disabled={busyId === notice.id}
                        className={buttonClass({ variant: 'quiet', size: 'sm' })}
                      >
                        {busyId === notice.id ? <Spinner /> : null}
                        Mark as read
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </LedgerList>
    </>
  )
}
