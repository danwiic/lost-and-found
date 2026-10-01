---
version: 1
slug: "home-user-dashboard"
primary_target: "src/app/(app)/page.tsx"
related_targets: ["src/app/(app)/layout.tsx", "src/app/globals.css", "src/components/**"]
---

# Home surface — Lost & Found (user dashboard)

## Scope and visitor mode

The signed-in user's home route, inside the application shell. **Operate** flow: see what
needs attention, review possible matches, start a report. Not a marketing surface.

## Audience and job

Students and school personnel using the OSAS lost & found desk, often on a phone while
standing in a corridor, and staff on a desktop in the office. They need to answer three
questions in seconds: *is anything waiting on me*, *did my report find a match*, and *what do
I do now*.

## Action / task

1. Read the tally: my reports, my claims, unread notices.
2. Open a possible match and compare the two photos side by side.
3. Report a lost item or a found item.
4. Filter my own records by type / attention.

## Proof / content

- Live backend only (`src/app/api/**`): `/api/auth/session`, `/api/notifications`,
  `/api/items?mine=1`, `/api/items/:id/matches`, `/api/claims?scope=mine`,
  `PATCH /api/notifications/:id`.
- One seeded account (`admin@cvsu.test`, OSAS staff) and nothing else: the surface is painted from
  real data, so a fresh install shows the empty state and the first report fills it.
- No fabricated metrics, no testimonials.

## Constraints

- `agents/UX.md` governs behavior: explicit action labels, status vocabulary, drawer (not
  modal) for quick match inspection, similarity is **not** ownership, opening a notification
  marks it read.
- Backend-supported actions only — nothing in the UI may invent a state or a step.
- Impeccable craft floor: no hero-metric template, no eyebrow/kicker, no icon+heading+text
  card grid, no nested cards, no gradient text, no colored `border-left`, contrast ≥4.5:1,
  browser surfaces themed, one authored motion moment.
- Responsive 1440 → 390 (nav becomes a bottom bar), keyboard complete.

## Chosen direction

**Neutral** — a clean, quiet records tool in the spirit of Linear or the shadcn/ui default theme.
Off-white ground, near-black ink, one indigo accent for primary actions and active states, and
neutral greys for structure. Tallies sit on one ledger line rather than in stat cards. The
memorable moment is the **match drawer**: statuses read as soft-tinted pill badges, and a possible
match opens a drawer that sets the two photographs side by side with an honest mono similarity
readout.

## Memorable moment

The match drawer: my item and the candidate item as two photographs, the similarity readout in
tabular mono, and the sentence that keeps the product honest — *this score represents visual
similarity between the uploaded photos; it does not confirm ownership*.

## Unresolved decisions

- Every surface in the product is now built: registration, both report forms, Browse, item
  details, the claim form, My Reports, My Claims, Profile, and the OSAS side (dashboard, lost and
  found records, the claim queue, claim review, and the return history). Nothing renders an
  interim panel any more.
- Real item photography does not exist yet — the verification scripts draw their photographs.

## Direction contract

THESIS: The home route is a records desk, not a dashboard of stat cards. Hierarchy comes from
type weight and size, hairline rules and status badges; the page's job is to put what needs the
user's attention first and keep OSAS's verification semantics intact.
OWN-WORLD: Off-white canvas (#FAFAFA) with white cards and a white navigation rail, near-black
ink #0A0A0A, a single indigo accent #4F46E5 for primary actions, links and active states,
amber #92400E for "needs attention", green #166534 for verified/returned, red #B91C1C for
refused. One typeface — Inter — with hierarchy from weight (600 headings, 500 labels, 400 body);
IBM Plex Mono strictly for codes (similarity, threshold, API paths). Sentence-case micro labels,
never uppercase eyebrows. One 8px radius, 1px hairlines, border or shadow but never both, shadows
only for the popover, drawer and toast. Every status label carries words, never colour alone.
STORY: A student opens the desk and immediately sees one possible match on the backpack they
lost, opens it, compares the photographs, and believes the score is a lead — not a verdict —
because the interface says so.
FIRST VIEWPORT: shell navigation on the left → the desk heading with the two report actions
and one ledger line of tallies → the attention queue of unread notices, each with its item
and a `View Match` action → my records beneath.
FORM: Neutral; whole-surface scope.
FINISH: typecheck, lint, production build, contrast audit, and a real login→dashboard pass
before this is called done.
