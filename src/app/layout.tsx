import type { Metadata } from 'next'
import { IBM_Plex_Mono, Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'

/*
 * One typeface for the interface, one for codes.
 * - Inter carries everything: headings, body, labels. Hierarchy comes from
 *   weight and size rather than from a second face.
 * - IBM Plex Mono is reserved for measurement and codes — the similarity
 *   reading, the match threshold, API paths. It is not a costume for
 *   "technical".
 * Both are self-hosted by next/font at build time, so the app ships no
 * third-party font requests at runtime.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Lost and Found — OSAS Records Desk',
  description:
    'Report a lost or found item, review possible matches from the matching system, and claim what is yours. OSAS verifies every claim.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
