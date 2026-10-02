import type { Metadata } from 'next'
import Link from 'next/link'
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'
import { RecoverySection } from '@/components/auth/RecoverySection'
import { PageHeader } from '@/components/layout/PageHeader'
import { SignOutButton } from '@/components/shell/SignOutButton'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/Button'
import { Panel, PanelHeading } from '@/components/ui/Panel'
import { prisma } from '@/lib/db'
import { recoveryPrompt } from '@/lib/security-questions'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Profile — Lost and Found' }

/**
 * The account as OSAS holds it. The details themselves are read-only: the
 * backend exposes no profile update endpoint, and a form that pretended to save
 * would be inventing a capability that does not exist (agents/UX.md §31.5).
 * Name, ID and contact are still corrected at the OSAS office.
 *
 * Two things a person can change here — their password and their recovery
 * questions — and both are self-service by definition: waiting at the counter
 * for either would defeat the point of having them.
 */
export default async function ProfilePage() {
  const user = await requireSession('/profile')

  const answers = await prisma.securityAnswer.findMany({
    where: { userId: user.id },
    select: { questionKey: true },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="page-stack">
      <div>
        <PageHeader title="Profile" description="The details OSAS has on your account." />
      </div>

      <Panel>
        <PanelHeading
          title="Account details"
          description="Contact OSAS if any of this is wrong."
          action={<Badge tone={user.role === 'ADMIN' ? 'accent' : 'neutral'}>{user.role === 'ADMIN' ? 'OSAS staff' : 'Student'}</Badge>}
        />

        <dl className="divide-y divide-line">
          <Row label="Full name" value={user.name} />
          <Row label="Email address" value={user.email} />
          <Row
            label="Student / personnel ID"
            value={user.studentId}
            missing="Not on file — add it at the OSAS office, or supply it when you file a claim."
          />
          <Row
            label="Contact number"
            value={user.contact}
            missing="Not on file — OSAS needs one to reach you about a collection."
          />
        </dl>
      </Panel>

      <Panel>
        <PanelHeading
          title="Password"
          description="Change the one you sign in with. Every other device is signed out when you do."
        />
        <div className="px-6 py-6 sm:px-6">
          <ChangePasswordForm role={user.role} />
        </div>
      </Panel>

      <div id="recovery" className="scroll-mt-24">
        <Panel>
          <PanelHeading
            title="Account recovery"
            description="If you forget your password, these questions are the way back in."
            action={
              answers.length > 0 ? <Badge tone="accent">Set up</Badge> : <Badge>Not set up</Badge>
            }
          />
          <RecoverySection
            current={answers.map((answer) => ({
              questionKey: answer.questionKey,
              prompt: recoveryPrompt(answer.questionKey),
            }))}
          />
        </Panel>
      </div>

      <Panel>
        <PanelHeading
          title="Your records"
          description="Everything tied to this account."
        />
        <div className="flex flex-wrap gap-3 px-6 py-6 sm:px-6">
          <Link href="/my-reports" className={buttonClass()}>
            My Reports
          </Link>
          <Link href="/claims" className={buttonClass()}>
            My Claims
          </Link>
          <Link href="/notifications" className={buttonClass()}>
            Notifications
          </Link>
          {user.role === 'ADMIN' ? (
            <Link href="/admin" className={buttonClass({ variant: 'primary' })}>
              OSAS dashboard
            </Link>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeading title="Session" description="Sign out of this device." />
        <div className="px-6 py-6 sm:px-6">
          <SignOutButton />
        </div>
      </Panel>
    </div>
  )
}

function Row({
  label,
  value,
  missing,
}: {
  label: string
  value: string | null
  missing?: string
}) {
  return (
    <div className="grid gap-1 px-6 py-4 sm:grid-cols-[14rem_1fr] sm:gap-4 sm:px-6">
      <dt className="text-sm font-medium text-ink-muted">{label}</dt>
      <dd className={value ? 'text-sm text-ink' : 'measure text-sm text-ink-muted'}>
        {value ?? missing ?? 'Not on file.'}
      </dd>
    </div>
  )
}
