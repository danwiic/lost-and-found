# Lost & Found — OSAS Records Desk

A lost and found system for a school OSAS office. Students report lost or found items with
photos; every new report is compared against open items of the opposite type with CLIP image
matching, and both sides are notified of a possible match. OSAS staff verify claims against
proof of ownership and record the physical hand-over — approval and release are separate,
recorded events.

The app and database run locally with one command. The CLIP embedder runs as a
separate HTTPS service and is configured through `.env`.

```bash
cp .env.example .env
docker compose up --build
# open http://localhost:3000
```

Set `EMBEDDER_URL` to the deployed embedder domain and `EMBEDDER_API_KEY` to
the same key configured on that service before starting Compose. The local
Compose stack runs only the Next.js app and PostgreSQL; it does not download or
build the 1.7 GB model.

The seed creates exactly one account — the OSAS admin (`admin@cvsu.test` / `admin123`).
Students register themselves, and every item in the system comes from a real report.

---

## Features

### Students

- **Register / sign in / sign out.** Registration signs the new account straight in.
- **Password & recovery.** Change your password from the profile. Forgot it? Set security
  questions there (a dashboard prompt reminds you), then reset it from the *Forgot your
  password?* link on the sign-in page by answering them — no email is sent. A staff-issued
  temporary password must be replaced at the next sign-in.
- **Dashboard.** Tallies of your reports and claims, the unread notice queue, and shortcuts to
  both report forms.
- **Report a lost or found item.** Name, description, colour, date, location, photo (required —
  matching runs on it) and optional details. Dates cannot be in the future, in the picker or on
  the server; every bounded field is length-capped in both places. The confirmation screen shows
  the possible matches found the moment the report landed, and a found report tells the finder
  to hand the physical item to OSAS.
- **Browse & search.** Filter by text, type, status and colour (a plain GET form that works
  before JavaScript loads), search by photo without filing a report, and paginate through
  results.
- **Item details.** The full record with its status, a `Submit Claim` action when the item is
  genuinely claimable, and copy that explains why an action is absent rather than leaving a gap.
- **Claims.** Claimant name, student/personnel ID, contact, extra details and proof of
  ownership. A claim starts Pending; the claimant is notified at every step.
- **Possible match notifications** with a `View Match` comparison drawer: both photos side by
  side, the similarity reading, and the statement that similarity is not ownership.
- **My Reports / My Claims.** Every report and claim with its current state:
  Pending → Possible Match → Claim Pending → Returned / Closed.

### OSAS staff

- **Dashboard.** Total lost, total found, pending claims, possible matches, returned and open
  items, plus the queues that need attention.
- **Record management.** Searchable, filterable, paginated lists of lost reports, found reports
  and the claims queue; hand-correct an item's status when needed.
- **Claim verification.** The item as reported beside the item as claimed, with the proof.
  Approve or reject — each its own labelled action with a confirmation — with a decision note
  that is shown to the claimant. Approving rejects competing pending claims.
- **Record the return.** The physical hand-over is recorded separately from approval: return
  date (bounded to after the claim was filed, never in the future), notes, and the staff member
  recording it. Only a return record marks an item **Returned**.
- **Returns register.** Every item released, newest first, with claimant and recorder.
- **Counter intake.** Log an item handed in at the office, recording who found it — the
  found-item form completed on the office's behalf, running through the same match-and-notify
  pipeline as any other report.
- **Account desk.** Find a student by name, email or student ID and issue a temporary password
  when they cannot sign in; the account stays flagged until they replace it at next sign-in.
  Staff accounts cannot be reset from this screen.

---

## How matching works

1. A report's photo is normalised (EXIF rotation, size cap) and sent to the **embedder
   sidecar** — a single-purpose Python service that loads **CLIP ViT-L/14** once at boot and
   answers one endpoint, `POST /embed`, with a 768-dim L2-normalised vector.
2. The vector is stored on the `Item` row (pgvector `vector(768)`).
3. New reports query open items of the **opposite type** by cosine distance
   (top 10 candidates). Two items whose names clearly describe different objects are excluded
   outright.
4. Every raw score is **calibrated** before it is thresholded or displayed, because unrelated
   photos sit at raw cosine 0.55–0.65 from shared composition and lighting alone:

   ```
   calibrated = max(0, (raw - MATCH_BASELINE) / (1 - MATCH_BASELINE))
   ```

5. Candidates above `MATCH_THRESHOLD` (currently 0.45 calibrated — deliberately low while real
   photo pairs are collected, so the final bar can be placed where true and false matches land)
   become `Match` rows. The match notifies **both owners** of the pair in either arrival
   order — a finder hears about a match too — and each notice points at the other report, so it
   opens the item that matched rather than the one the owner already knows about.
6. A score is a lead, never a verdict: the UI shows candidates with their similarity and lets a
   person decide ownership.

### Tuning the threshold — the matching lab

MATCH_BASELINE and MATCH_THRESHOLD are environment variables, not constants in the code: change
one and restart the app container (`docker compose up -d app`) — no rebuild. Both are read at
startup and reported in every log line, so the values in force are never a guess.

To set them from measurements, measure labelled pairs and keep the results:

```bash
npm run match:lab -- --a photo1.jpg --b photo2.jpg --label same      --category wallet
npm run match:lab -- --a photo3.jpg --b photo4.jpg --label different --category wallet
npm run match:lab -- --summary        # distribution, gap, and the threshold that splits them
```

Each pair is measured through the **real** pipeline (same embedder, same cosine, same
calibration) and appended as one JSONL row to `matching-lab/results.jsonl` on the host, so the
dataset accumulates across sessions instead of living in a chat log. Nothing is written to the
database and the photos are not stored. The summary reports the mean/min/max of the SAME and
DIFFERENT sets, whether they separate (and by how much), the threshold that splits them when
they do, and which stored pairs the current threshold gets wrong. When the sets overlap it says
so instead of inventing a number.

Every score line — `[match]`, `[photo-search]` and `[matching-lab]` — carries `raw=`,
`calibrated=`, `type=` and `category=`, so a later batch can test whether category filtering
separates true from false matches better than similarity alone.

**Seeing both scores in the UI:** add `?debug=1` to any page with a score on it (Browse, an item
page, or a report's confirmation) and each reading shows the raw cosine and the calibrated value
next to the threshold and baseline. Without the flag the interface shows only the calibrated
number it always did.

The model is **baked into the separately deployed embedder image at build time** from
`embedder/model-cache/` (pinned HuggingFace revision). The local app does not download or
build the model; it calls the configured HTTPS embedder service.

---

## Running it

### With Docker Compose (recommended)

```bash
cp .env.example .env          # AUTH_SECRET must be changed from the placeholder
docker compose up --build
```

Two containers:

| Service    | Image                     | Role                                                       |
| ---------- | ------------------------- | ---------------------------------------------------------- |
| `app`      | built from `Dockerfile`   | Next.js app; runs migrations + idempotent seed on start     |
| `db`       | `pgvector/pgvector:pg16`  | PostgreSQL 16 with pgvector; not exposed to the host        |
`app` waits for the database healthcheck before starting. Photos and database data live in named
volumes (`uploads`, `pgdata`) and survive `docker compose down`.

Set `EMBEDDER_URL` to the HTTPS embedder domain and `EMBEDDER_API_KEY` to the matching secret
before starting the stack. The Compose file requires both values.

### Without Docker (host dev server)

The database runs in a container; the embedder remains the separately deployed HTTPS service:

```bash
docker run -d --name laf-pg -e POSTGRES_USER=lostfound -e POSTGRES_PASSWORD=lostfound \
  -e POSTGRES_DB=lostfound -p 5433:5432 pgvector/pgvector:pg16
cp .env.example .env
# In .env:  DATABASE_URL=postgresql://lostfound:lostfound@127.0.0.1:5433/lostfound
#           EMBEDDER_URL=https://embedder.danpirante.dev
#           EMBEDDER_API_KEY=the-aws-embedder-key
#           EMBEDDER_API_KEY=              # set if the embedder requires a key

npm install
npm run db:generate          # Prisma 7 requires an explicit generate
npm run db:migrate           # CREATE EXTENSION vector + the schema
npm run db:seed
npm run dev                  # http://localhost:3000
```

> **Windows note:** use `127.0.0.1`, not `localhost`, for the database URL on the host.
> `localhost` can resolve to IPv6 first and produce intermittent `P1017` connection errors.

### Remote embedder

The app can use an embedder hosted separately by setting `EMBEDDER_URL` in
`.env`. Use a private VPN address where possible; otherwise expose the service
only through HTTPS and set the same high-entropy `EMBEDDER_API_KEY` on both
hosts. The key is sent as the `X-API-Key` header on embedder requests.

```dotenv
EMBEDDER_URL=https://embedder.example.com
EMBEDDER_API_KEY=replace-with-a-long-random-secret
```

Do not expose an unauthenticated embedder directly to the public internet.
> If port 3000 is taken, run `npm run dev -- -p 3100`.

### Resetting for a demo

```bash
npm run demo:reset                   # clear reports, matches, claims, returns and notices
npm run demo:reset -- --dry-run      # list what would go, change nothing
```

The reset empties every report and everything hanging off it — matches, claims, return records
and notifications — plus the stored photos, while leaving **every account untouched**: sign-ins,
security questions and password-reset history all survive, so the desk can be cleared without
re-registering anyone. It never runs on its own; it is a deliberate, one-way action.

Inside the Compose stack the database has no published host port, so run it in the app
container:

```bash
docker compose exec app node scripts/clear-demo-data.mjs
```

Add `--keep-photos` or `--keep-notifications` to leave either in place.

---

## Verification

```bash
npm run typecheck            # TypeScript, strict
npm run lint                 # eslint 9, flat config
npm run build                # production build
npm run audit:contrast       # every text token pair vs WCAG AA
npm run audit:spacing        # every spacing utility vs the 4·8·12·16·24·32·48 scale
npm run audit:headers        # every page title through PageHeader; descriptions stay one line
npm run check:render         # drives the real UI journeys over HTTP
```

End-to-end suites (run against a running server; each creates its own accounts and data, and
photo-search proves it writes nothing):

```bash
npm run smoke                # full API journey: register → report → match → claim → decide → return, plus 401/403/409/422 and path-traversal cases
npm run verify:match         # both arrival orders produce a Match row + a notice to each owner, pointing at the other item
npm run check:photo-search   # search by photo honours threshold/type/limit and persists nothing
npm run match:matrix -- <dir> --pair <photoA>,<photoB>   # measured similarity + suggested threshold
```

Point a suite at a non-default server with `SMOKE_BASE_URL=http://127.0.0.1:3100`.

---

## Tech stack

| Layer          | Choice                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| App            | Next.js 16 (App Router, Route Handlers, server components), React 19       |
| UI             | Tailwind CSS v4, custom primitives in `src/components/ui`                  |
| Database       | PostgreSQL 16 + pgvector, via Prisma 7 (`$queryRaw` for the vector search) |
| Auth           | Session JWT in an httpOnly cookie (`jose`), `bcryptjs`, `USER`/`ADMIN` roles |
| Image matching | CLIP ViT-L/14 in a FastAPI + sentence-transformers sidecar, 768-dim        |
| Photos         | `sharp` (normalise, resize variants), stored on a Docker volume            |
| Notifications  | In-app, stored in a table, unread state per user                           |
| Packaging      | Docker Compose — `db`, `embedder`, `app`                                   |

## Architecture

```
Browser
   │
   ▼
Next.js app ── container: app (port 3000)
   ├─ Route Handlers: auth, items, photo-search, claims, returns,
   │                  notifications, files, admin, health
   ├─ server components read through lib/records.ts (same tables, no HTTP hop)
   ├─ /uploads volume: original + resized photo variants
   ├──────────────────────────┬───────────────────────────
   ▼                          ▼
PostgreSQL 16 + pgvector   HTTPS embedder service
container: db              embedder.danpirante.dev
vectors, records           CLIP ViT-L/14, /embed
```

## Data model (summary)

- **User** — name, email, password hash, studentId, contact, role (`USER` | `ADMIN`)
- **Item** — type (`LOST` | `FOUND`), name, description, colour, dateEvent, location,
  additionalDetails, photo path, `embedding vector(768)`, status, reporter
  - Statuses: `PENDING`, `POSSIBLE_MATCH`, `CLAIM_PENDING`, `RETURNED`, `CLOSED`
- **Claim** — item, claimant (name, studentId, contact), additionalDetails, proof,
  status (`PENDING` | `APPROVED` | `REJECTED`), decisionNote, decidedBy
- **Match** — lostItem, foundItem, similarity
- **Notification** — user, type, message, optional match/claim link, read state
- **ReturnRecord** — item, claim, returnDate, notes, releasedBy

Domain rules enforced server-side: you cannot claim your own report; one approved claim per
item (competing pendings are closed); only a return record closes an item; photos are private
to signed-in users; dates cannot be in the future and a return cannot precede its claim.

## Project structure

```
├── docker-compose.yml         # db + app; healthchecks and wait conditions
├── Dockerfile                 # 3-stage node:22 build; entrypoint migrates + seeds
├── docker-entrypoint.sh
├── .env.example               # every tunable, with comments
├── prisma/
│   ├── schema.prisma          # vector(768) via Unsupported("vector")
│   ├── migrations/
│   └── seed.ts                # the OSAS admin account, and nothing else
├── embedder/
│   ├── main.py                # FastAPI: /embed, /health, /docs, and API-key auth
│   ├── Dockerfile             # model baked at build, pinned HF revision
│   └── model-cache/           # build context for the weights; npm run model:fetch
├── scripts/                   # verification suites, audits, and the demo reset
├── src/
│   ├── app/
│   │   ├── (auth)/            # /login, /register, /forgot-password, /change-password
│   │   ├── (app)/             # dashboard, browse, reports, claims, notifications,
│   │   │                      # profile, items, and the /admin/** surfaces
│   │   └── api/               # auth, items (+ photo-search), claims (+ return),
│   │                          # returns, notifications, files, admin/stats, health
│   ├── components/            # ui/ primitives, shell/, records/, report/, claims/,
│   │                          # admin/, dashboard/
│   ├── lib/                   # api, auth, config, db, embed, match, records,
│   │                          # serialize, uploads, validation, format, client-api
│   └── generated/prisma/      # Prisma client output (gitignored)
├── DESIGN.md                  # the visual system, as built
├── PRODUCT.md                 # product truth: users, capabilities, constraints
└── .impeccable/surfaces/      # per-surface design strategy
```

## Environment variables

`.env.example` is the annotated list. Highlights:

```
DATABASE_URL=postgresql://lostfound:lostfound@db:5432/lostfound
AUTH_SECRET=change-me-in-env       # the app refuses to sign sessions with the placeholder
SESSION_TTL_DAYS=7
COOKIE_SECURE=0                    # keep 0 for http://localhost; 1 only behind HTTPS
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_MB=8
EMBEDDER_URL=https://embedder.danpirante.dev
EMBEDDER_API_KEY=the-aws-embedder-key
MATCH_BASELINE=0.6                 # raw cosine noise floor (calibration)
MATCH_THRESHOLD=0.45               # calibrated units; provisional while pairs are collected
MATCH_TOP_K=10
MATCH_COLOR_BOOST=0.02
PHOTO_SEARCH_NEAR_MISSES=3         # optional: below-threshold leads shown by photo search
PHOTO_SEARCH_NEAR_MISS_FLOOR=0.6   # optional: lowest calibrated near-miss score
MATCHING_LAB_DIR=/app/matching-lab # optional: where the matching lab appends its dataset
```

Inside Compose the app container gets its values from `docker-compose.yml`; tuning the
threshold is a one-line change plus a restart.

## Scope

Everything described above is implemented and verified. Deliberately out of scope: cloud
hosting, email/push delivery, multi-campus logistics, and public (unauthenticated) listings.
