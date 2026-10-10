import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordButton } from '@/components/admin/ResetPasswordButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { inputClass } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { LedgerList, Panel } from '@/components/ui/Panel'
import { TallyLine } from '@/components/ui/TallyLine'
import { listAccounts, loadAccountCounts } from '@/lib/accounts'
import { requireAdminSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Accounts — OSAS' }

function accountsHref(q: string, page: number): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/admin/accounts?${query}` : '/admin/accounts'
}

/**
 * The counter's account lookup: find a student or personnel member, and hand them a temporary
 * password when they cannot sign in. It is one control on purpose — no editing,
 * no roles, no deletion. The office needs "help this person back in", and every
 * extra power on this screen would be a way to misuse it.
 *
 * The roster is listed before anyone searches, because half the counter
 * questions are "which account is mine?" — someone who cannot remember the
 * email they registered with is better served by browsing names than by being
 * asked to type one. The search is a plain GET form, so it works before
 * JavaScript loads and every view is a URL worth sharing.
 */
export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminSession('/admin/accounts')

  const raw = await searchParams
  const rawQuery = Array.isArray(raw.q) ? raw.q[0] : raw.q
  const query = (rawQuery ?? '').trim()
  const rawPage = Number(Array.isArray(raw.page) ? raw.page[0] : raw.page)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1

  const { accounts, total, page: current, pageCount } = await listAccounts({ q: query, page })
  const counts = await loadAccountCounts()
  const searching = query.length >= 2

  return (
    <div className="page-stack">
      <div className="space-y-6">
        <PageHeader
          title="Student and personnel accounts"
          description="Issue a temporary password when a student or personnel member cannot sign in."
        />

        <div className="border-t border-line pt-6">
          <TallyLine
            items={[
              { label: searching ? 'Matching this search' : 'Accounts on file', value: total },
              {
                label: 'On a temporary password',
                value: counts.onTemporaryPassword,
                emphasis: counts.onTemporaryPassword > 0,
              },
            ]}
          />
        </div>
      </div>

      {/* No card heading: the page is already named above, and repeating it as
          a section title was one competing heading too many. */}
      <Panel>
        <form
          action="/admin/accounts"
          method="get"
          role="search"
          className="border-b border-line px-6 py-6 sm:px-6"
        >
          <label htmlFor="account-search" className="text-sm font-medium text-ink">
            Find an account
          </label>
          <p className="mt-1 text-xs text-ink-muted">
            By name, email address, or student or personnel ID. Ask for their ID before resetting anything.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              />
              <input
                id="account-search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="e.g. Juan Dela Cruz, juan@cvsu.edu.ph, or 2021-12345"
                className={inputClass({ className: 'py-2 pl-8' })}
              />
            </div>
            <button type="submit" className={buttonClass()}>
              Search
            </button>
            {searching ? (
              <Link href="/admin/accounts" className={buttonClass({ variant: 'quiet' })}>
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        {accounts.length === 0 ? (
          <EmptyState
            title={searching ? `No account matches “${query}”` : 'No accounts yet'}
            message={
              searching
                ? 'Check the spelling, or try the email address they registered with. Clear the search to browse the whole roster.'
                : 'Student and personnel accounts appear here as they are created.'
            }
          />
        ) : (
          <LedgerList>
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-medium">
                    {account.name}
                    {account.role !== 'ADMIN' ? (
                      <Badge tone="muted">
                        {account.accountType === 'PERSONNEL' ? 'Personnel' : 'Student'}
                      </Badge>
                    ) : null}
                    {account.role === 'ADMIN' ? <Badge tone="accent">OSAS staff</Badge> : null}
                    {account.mustChangePassword ? (
                      <Badge tone="attention">Temporary password</Badge>
                    ) : null}
                  </p>
                  <p className="mt-1 truncate text-sm text-ink-muted">{account.email}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    ID: {account.studentId ?? 'not on file'} · Contact:{' '}
                    {account.contact ?? 'not on file'}
                  </p>
                </div>

                {account.role === 'ADMIN' ? (
                  <p className="measure text-xs text-ink-muted">
                    Staff accounts cannot be reset from here.
                  </p>
                ) : (
                  <ResetPasswordButton
                    account={{ id: account.id, name: account.name, email: account.email }}
                  />
                )}
              </li>
            ))}
          </LedgerList>
        )}
      </Panel>

      {pageCount > 1 ? (
        <nav
          aria-label="Pages of accounts"
          className="flex items-center justify-between gap-4 border-t border-line pt-6"
        >
          {current > 1 ? (
            <Link
              href={accountsHref(query, current - 1)}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              <Icon name="arrow" className="h-4 w-4 rotate-180" />
              Previous
            </Link>
          ) : (
            <span />
          )}

          <p className="nums text-sm text-ink-muted">
            Page {current} of {pageCount}
          </p>

          {current < pageCount ? (
            <Link
              href={accountsHref(query, current + 1)}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              Next
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  )
}
