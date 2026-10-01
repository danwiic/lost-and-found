# Design System — Neutral

Ground truth for the built interface, written after the build rather than before it.
Authority order: `PRODUCT.md` (product truth) → `agents/UX.md` (interaction behaviour) →
this file (visual and component decisions) → `.impeccable/surfaces/*.md` (per-surface strategy).

## The direction

A clean, neutral records tool. Near-black ink on an off-white ground, a single accent, neutral
greys for structure, and generous whitespace instead of boxed containers. The feel is a working
SaaS dashboard — Linear, or the shadcn/ui default theme — not an institutional document and not a
decorated one.

The interface refuses two category defaults on purpose: no grid of same-size metric cards as the
page structure, and no hero-metric template (big number, small label, accent). The user's totals
are a **ledger line**: modest tabular figures on one row, no cards, no accent, read left to right
like a records total.

## Type

One typeface for the interface, plus monospace for codes. Both are self-hosted by `next/font` at
build time; no runtime request ever reaches a third-party font host.

| Face | Role | Rules |
| --- | --- | --- |
| Inter | Everything: headings, body, labels, buttons | The only interface face. There is no display face — hierarchy comes from weight and size |
| IBM Plex Mono | Codes only: the similarity reading, the match threshold, the API paths in the interim panel | Applied through `.data` with `font-variant-numeric: tabular-nums`; never a costume for "technical" |

Weights: headings `600` (never bold-black), body `400`, labels and nav `500`.
Unicode arrows and emoji are never used as icons.

Scale and rhythm:

- Page heading `1.5rem` → `1.875rem` at `sm`, `font-semibold`, `tracking-tight`
- Panel heading `1.125rem`, `font-semibold`; record and notice name `0.9375rem`, `font-medium`
- Body `0.9375rem`; secondary and micro labels `0.75rem` / `0.875rem`
- Heading letter-spacing `-0.011em` (base layer); `text-wrap: balance` on headings,
  `text-wrap: pretty` on paragraphs; prose measure capped at `68ch` via `.measure`
- The uppercase, wide-tracked "eyebrow" treatment is not used anywhere. Micro labels are
  sentence case at `font-medium`.

## Colour

Tokens live once, in the `@theme` block of `src/app/globals.css`. Names describe meaning, so
screens added later cannot drift.

| Token | Value | Meaning |
| --- | --- | --- |
| `canvas` / `rail` | `#FAFAFA` / `#FFFFFF` | The page ground, and the navigation rail |
| `surface` / `surface-sunk` | `#FFFFFF` / `#F4F4F5` | Cards, and sunk bands inside them |
| `ink` / `ink-muted` / `ink-subtle` | `#0A0A0A` / `#52525B` / `#71717A` | Text, secondary text, placeholder text |
| `line` / `line-strong` | `#E4E4E7` / `#D4D4D8` | Hairlines, and input borders |
| `accent` / `accent-hover` / `accent-soft` | `#4F46E5` / `#4338CA` / `#EEF2FF` | Primary actions, links, and active states |
| `on-accent` | `#FFFFFF` | Labels sitting on a solid `accent` or `refused` fill |
| `attention` / `attention-soft` | `#92400E` / `#FFFBEB` | Something needs the user: possible match |
| `verified` / `verified-soft` | `#166534` / `#F0FDF4` | Approved, returned |
| `refused` / `refused-hover` / `refused-soft` | `#B91C1C` / `#991B1B` / `#FEF2F2` | Rejected |

Rules:

- Contrast is verified, not assumed: `npm run audit:contrast` reads these values out of the CSS
  and checks 18 text pairs against WCAG AA. All pass (body text 19:1 on the canvas; secondary
  text 7.41:1; placeholder text 4.63:1; link on the canvas 6.02:1; primary button label 6.29:1).
- One accent, and it means one thing: a primary action, a link, or the current state. It is never
  decorative.
- `ink-subtle` is 4.40:1 on `surface-sunk` and **must never carry text there**. It is for
  placeholders on `canvas`/`surface` only.
- **Colour never carries a status alone.** Every status is a word inside a pill badge; tone only
  reinforces it.
- Never hard-code a colour in a component. If a hover state needs one, it gets a token
  (`accent-hover`, `refused-hover`).

## Space, radius, depth

**One scale: 4 · 8 · 12 · 16 · 24 · 32 · 48px.** Tailwind's numeric utilities land exactly on it
(1, 2, 3, 4, 6, 8, 12), and those seven steps are the only values used for padding, margin, gap and
space-between anywhere in the interface. `npm run audit:spacing` reports anything off the scale and
`npm run audit:spacing -- --fix` snaps it back, so the standard cannot quietly erode.

**One page container** — `src/components/layout/PageContainer.tsx`, rendered by the app shell and by
the auth shell, so no page decides its own width or gutters: **1080px** max width, centred, widening
with the viewport — **1240px** at 1280px, **1400px** at 1536px, **1520px** at 1900px — so a wide
monitor is filled rather than left as empty margin. The ladder lives in `.page-measure`
(`globals.css`), written as plain media queries because Tailwind emits breakpoint variants in
`@theme` order, which put a wider step before a narrower one and let the narrower one win.

Gutters never change: **20px** on mobile (`px-5`) and **32px** from `sm` (`sm:px-8`), 32px above the
first section and 48px below the last (96px on mobile, to clear the fixed bottom navigation). Only
the measure grows, and prose stays inside 65–75ch via `.measure`, so widening the container never
widens the reading line. Content never reaches the viewport edge.

**One card padding: 24px.** `.card-pad` is that shared value, used by every white or bordered card —
grid cards, panel bodies, the sign-in panel. A panel that opens with `PanelHeading` takes its 24px
from the heading (`px-6 pt-6`) and from its rows (`px-6`), with 8px under the last row so the card's
bottom is 24px as well.

**Sections are always further apart than the elements inside them.** `.page-stack` spaces top-level
sections by 32px. Inside a section: 24px between sub-blocks, 16px between blocks, and 4/8/12px for
tight clusters such as a label and its field or a row of chips. A heading gets more space above it
than below it.
- **One radius: `8px`** (`rounded-lg`) across buttons, cards, inputs, nav items, and thumbnails.
  `rounded-full` is reserved for pills — status badges, filter chips, and the unread count.
- **A border or a shadow, never both.** Cards and inputs carry a 1px hairline and no shadow.
  Shadows are elevation only, and there are two: `--shadow-lift` (popover, toast) and
  `--shadow-drawer`. There is no shadow on buttons, on the active nav item, or on photographs.
- Panels are never nested. Inside a panel, separate content with hairline rules and sunk bands.

## Motion

One authored moment: `.reading-in` on the similarity reading when a match drawer opens — it
settles from `scale(1.06) blur(1.5px)` into its final state, so it is never invisible.
Supporting transitions: the drawer arrives as a record being pulled out (`.drawer-panel`:
clip-path edge, 10px travel, blur settling) over a `.drawer-overlay` that blurs in; hover
transitions change colour and border only. `prefers-reduced-motion` collapses all of it.

## Components

`src/components/ui` — the primitives every surface reuses:

| Component | Purpose | Notes |
| --- | --- | --- |
| `Button`, `buttonClass`, `Spinner` | Actions, and links that look like actions | `primary` is solid accent; `secondary` and `quiet` are both ghost (transparent until hover), so a toolbar of actions never reads as a row of boxes; `danger` is solid refused; a loading button keeps its label and blocks a second submission |
| `Badge` | The status pill | Tone map shared with `src/lib/format.ts`; soft-tinted, `rounded-full`, and always contains words |
| `Panel`, `PanelHeading`, `LedgerList` | The card and its hairline list | One level deep only; border, no shadow |
| `PhotoFrame` | Item photograph | `thumb` / `card` / `feature`; renders "No photo" rather than an empty box |
| `Field`, `inputClass` | Labelled form control | Render-prop hands the control its ids and `aria-describedby`; labels are real `<label>`s; the global focus outline is never suppressed |
| `Icon` | One icon set at one stroke width | Lucide's 24×24 outlines, vendored (see the file header); `currentColor`, stroke 2, no fills, no emoji |
| `TallyLine` | The ledger line of the user's totals | Tabular sans figures; no cards, no accent |
| `EmptyState`, `RowSkeleton`, `ErrorNote` | Empty, loading, and inline failure states | Every async area has all three |
| `Drawer` | Quick contextual inspection | Focus moves in, is trapped, and returns to the trigger; Escape closes; the backdrop is out of the tab order |
| `Dialog` | A short, consequential confirmation | Same focus contract as the drawer; a title, one sentence of consequence, and a way out. Never used to hold a long form |
| `Toast`, `useToast` | Confirmation of a finished action | `aria-live="polite"`, auto-dismiss, dismissible |

`src/components/shell` — `SideNav` (the active item is an `accent-soft` pill with accent text),
`MobileNav` (five destinations in the bottom bar; Profile stays reachable from the account menu),
`TopBar` (GET-based search that works before any JavaScript loads; bell and account are ghost
buttons), `AccountMenu` (popover, Escape and outside click), `SignOutButton` (the standalone
sign-out on Profile).

`src/components/dashboard` — `NoticeList` (shared by the desk and the Notifications page),
`MatchDrawer` (the possible-match comparison), `RecordLedger` (records, filters, and the claims
the user filed). `src/components/auth/LoginForm` owns sign-in and `RegisterForm` registration.

`src/components/records` — `RecordGrid` (the Browse card grid), `MatchButton` (the single
"View Match" control, used by the desk, My Reports and the item page so the action always opens
the same context), `WithdrawReport`.

`src/components/report/ReportForm` renders both report forms from one component, differing only
in labels and in the "turn the item over to OSAS" note the found flow carries.
`src/components/claims/ClaimForm` is the claim request. `src/components/admin` holds the staff
controls: `ClaimDecision` (approve / reject, each its own labelled action with its own
confirmation), `RecordReturn` (the physical hand-over, deliberately separate from approval),
`AdminItemStatus` (correcting a record by hand), and `AdminItemList` (the shared OSAS record
list behind `/admin/lost` and `/admin/found`).

## Patterns

- **Ledger row:** thumbnail, name at `0.9375rem` medium, one muted meta line (`Lost · Library ·
  21 Sep 2026`), status badge, and the row's real primary action. The whole row navigates through
  a stretched link, with actions layered above it so nothing nests inside a link.
- **Status badges** carry their plain-language meaning in `title`, sourced from
  `src/lib/format.ts`, so the same words describe the same state everywhere.
- **Match review** happens in a drawer: two photographs side by side, the similarity reading and
  the active threshold in mono, then the sentence that keeps the product honest — *this score
  represents visual similarity between the uploaded photos. It does not confirm ownership.*
  A score is never phrased as a probability of ownership.
- **Notices:** unread rows are tinted and badged "Unread"; opening one marks it read
  (`PATCH /api/notifications/:id`); a notice with nowhere to go offers only "Mark as read".
- **Filters** are chips with `aria-pressed`, and `Clear Filters` appears whenever a filter is
  active. A filtered-to-empty list explains itself and offers the way back.
- **States never lie:** no action is offered that contradicts a record's status, and viewing a
  page never changes a status.
- **Search by photo** is the card grid again, with one addition: each card states its `Visual
  similarity` in measurement type and the attention tone, because that score is why the card is on
  screen. The band above the grid carries the honesty line once — the score is a resemblance, not
  proof of ownership — and the results sit *above* the browse list rather than replacing it, so the
  page keeps its place (agents/UX.md §1.3). Nothing about the search is persisted: no report, no
  match row, no notification, and the uploaded photo is never written to disk.

## Voice

Controls name the action they perform (`View Match`, `Report Found Item`, `Mark as read`, `Clear
Filters`, `Try Again`). Errors name the problem and the recovery, and an expired session says so
instead of failing silently. The rail carries the product principle in the interface's own
voice: *matching suggests, OSAS verifies*.

## Extending it

1. Add a token to `@theme` in `src/app/globals.css`; never hard-code a colour in a component.
2. Reach for an existing primitive before writing a new component, and never nest a panel.
3. Use one radius (`rounded-lg`) and reserve `rounded-full` for pills. A card gets a border or a
   shadow, not both.
4. After UI changes run `npm run audit:contrast` (colour), `npm run check:render` (what actually
   renders, including accessible labels and the honesty copy), `npm run typecheck`,
   `npm run lint`, and `npm run build`.
