import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { MobileNav } from '@/components/shell/MobileNav'
import { SideNav } from '@/components/shell/SideNav'
import { TopBar } from '@/components/shell/TopBar'
import { ToastProvider } from '@/components/ui/Toast'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'

/**
 * The application shell for every signed-in surface. Unauthenticated visitors
 * are redirected to sign in, because the backend requires a session for all data
 * endpoints (see PRODUCT.md, Capabilities).
 *
 * The page container lives here, not in the pages: width, gutters and the gap
 * between sections are decided once for the whole application.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireSession()

  // A temporary password issued at the counter ends here and nowhere else: no
  // screen, no shell, no report form. The page outside this layout is the way
  // out, and it is the only one.
  if (user.mustChangePassword) redirect('/change-password')

  const unread = await prisma.notification.count({ where: { userId: user.id, read: false } })

  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:border focus:border-line-strong focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <div className="lg:grid lg:grid-cols-[16rem_1fr]">
        <SideNav role={user.role} unread={unread} />
        <div className="flex min-h-screen flex-col">
          <TopBar user={user} unread={unread} />
          <main id="main" className="flex-1">
            <PageContainer>{children}</PageContainer>
          </main>
        </div>
      </div>

      <MobileNav role={user.role} unread={unread} />
    </ToastProvider>
  )
}
