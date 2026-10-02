# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Students and school personnel** — the owners and finders of items. They report a lost item, report a found item, browse what has been turned in, review visual matches, and file a claim for an item they believe is theirs. Reports are usually made soon after the loss or the find, frequently from a phone between classes. *(Confirmed by `agents/PRODUCT.md`; supported by the seeded accounts and the report/claim endpoints.)*

**OSAS administrators** — the school office that takes custody of found items and settles ownership. They review lost and found reports, verify claims and their proof, approve or reject them, and record the physical release of an item. *(Confirmed by `agents/PRODUCT.md` and the admin endpoints.)*

The relationship between the two is the product: a student proposes ownership, OSAS disposes of it.

## Product Purpose

Give a school OSAS office one place to take in found items, publish them, and return them to the
right person. Students report what they lost and what they found; the system looks for visually
similar items of the opposite type and tells the person who owns the other side. OSAS then
verifies claims and records the hand-over.

Success is an item that leaves the office with its actual owner, with fewer items unclaimed at the
end of term than a paper logbook would manage. *(Inferred from the workflow in `agents/UX.md`
§28–30; not yet a stated metric.)*

## Positioning

The mechanism is photo-led: an uploaded photograph is embedded with CLIP into a 512-dimension
vector, and each new report is compared by cosine similarity against open items of the **opposite**
type. A found item is matched against lost items and the reverse. Matches are surfaced as
*possible*, with a similarity score, and they trigger a notification to the other side.

What a plain listings board could not truthfully copy is the pairing of that assistive search with
an explicit human verification step and a recorded physical release. The product never claims that
a match establishes ownership.

## Operating Context

- Physical setting: a school office holding items handed in around campus; a student comes to the
  office to collect an item in person.
- Items arrive as physical objects and are turned over to OSAS by the finder; the app records the
  report, not the custody.
- Ownership is settled by OSAS with the claimant present, using the claim's proof of ownership.
- Claim approval and the physical return are **separate events**: an approved claim is not a
  completed return, and only a return record closes an item.
- Single institution, internal audience, no public listing.
- Runs entirely on local infrastructure (`docker compose up`); a school presentation is a real
  usage context, so everything on screen must be produced by the product itself: the seed
  creates only the OSAS admin account, and every other account and item comes from a real
  registration or report.
- Terminology is fixed by the domain and reused by the interface: `Pending`, `Possible Match`,
  `Claim Pending`, `Returned`, `Closed` for items; `Pending`, `Approved`, `Rejected` for claims.

## Capabilities and Constraints

Confirmed, and backed by implemented endpoints:

- Register / sign in / sign out; every data endpoint requires a session. Photos are private to
  signed-in users.
- Report a lost item and report a found item, each with a required photo, name, description,
  colour, relevant date, location, and optional extra details.
- Automatic image matching on report, with a similarity score and a stored match, returned to the
  reporter so the candidates appear on their confirmation. The stored notification goes to
  **both owners** of the pair, in either arrival order — a finder hears about a match too — and
  each notice points at the other report, so opening it shows the item that matched rather than
  the one the reader already knows about.
- Browse and search items by type, status, colour and free text; reports, matches and claims are
  visible to their owner and to OSAS staff.
- Submit a claim (claimant name, student or personnel ID, contact, extra item details, proof of
  ownership) which moves the item to `Claim Pending`.
- OSAS runs the claim queue, approves or rejects with a decision note, and records the return
  (date, claimant, notes) which closes the item as `Returned`.
- Notifications are in-app and stored: possible match, claim submitted, claim approved, claim
  rejected, item returned.

Constraints and undecided facts:

- Image matching is assistive and threshold-based; a high score is a lead, never a verdict, and
  colour is only a soft ranking nudge.
- Domain rule: a user may not claim an item they reported themselves.
- One approved claim per item; competing pending claims are closed when one is approved.
- **Undecided:** whether students self-register or receive accounts from OSAS (the backend supports
  both).
- **Undecided:** whether unclaimed items expire or close on a hold period (no such rule exists in
  the backend).
- **Undecided:** whether the interface needs Filipino/Tagalog alongside English.
- Out of scope by the original brief: cloud hosting, a public web presence, or shipping items
  between campuses.

## Brand Commitments

- No school or external brand identity is binding. The user confirmed that the interface may
  define its own identity and must not adopt school colours.
- The product name in use is descriptive: "Lost and Found System".
- The seeded `@cvsu.test` admin account is a placeholder, not a brand commitment.
- Visual identity decisions are owned by `DESIGN.md`; the behavioral authority is `agents/UX.md`.

## Evidence on Hand

- A real, runnable backend at `src/app/api/**`. The seeded database holds one row — the OSAS
  staff account (`admin@cvsu.test` / `admin123`) — and nothing else: no demo student, no sample
  item, no pre-made match. Students register and report for real.
- `npm run verify:match` posts two real registrations and two reports (one lost with a
  photograph, one found with a **different** photograph of the same object) and verifies that a
  `Match` row and a `POSSIBLE_MATCH` notification are created.
- Item photographs in tests are flat illustrations drawn on demand
  (`scripts/lib/fixtures.mjs`, SVG rasterised with sharp). **No real photography exists** —
  future work must not present these as documentary evidence of a real item.
- No testimonials, usage statistics, press, or institutional endorsement exist, and none may be
  fabricated.
- Measured matching behaviour (`npm run verify:match`; `npm run match:matrix -- <dir> --pair a,b`):
  the true pair scores 0.913 and the best unrelated pair 0.837, so the configured threshold is
  0.87. Both scripts print those numbers, and every candidate score is written to the server log
  as a `[match]` line.

## Product Principles

1. **A match is a lead, not a verdict.** The system narrows the search; a person decides ownership.
   No wording may imply otherwise.
2. **State is always legible.** Every item and claim shows its current state in words, and the
   interface never offers an action that contradicts that state.
3. **Verification belongs to OSAS.** Students report and claim; staff verify and release.
4. **Approval is not possession.** The physical return is its own recorded step, and only it closes
   an item.
5. **Nothing is fabricated.** No demo accounts, no sample items, no invented proof: the system
   starts empty and everything in it was registered or reported by a person. Thresholds are
   measured and reported, never asserted.

## Accessibility & Inclusion

- `agents/UX.md` §24 binds the implementation: keyboard reachable controls, visible focus, dialogs
  that trap and restore focus, labelled inputs (never placeholder-as-label), meaningful alternative
  text for item photographs, and status that never relies on colour alone.
- Target baseline: WCAG 2.1 AA for contrast and interaction.
- Users include students with disabilities on personal phones in bright corridors; small text,
  low-contrast tinting, and colour-only status are treated as defects, not style choices.

