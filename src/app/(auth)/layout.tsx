import type { ReactNode } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'

/**
 * Sign-in and registration use the same page container as the rest of the
 * application, so the two surfaces that sit outside the shell still share its
 * width and gutters. They centre their single panel within it.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-center">
      <PageContainer className="items-center">{children}</PageContainer>
    </div>
  )
}
