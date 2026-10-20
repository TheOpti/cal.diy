# Territory: Git activity, corrective work, and co-change coupling

Analysis date: 2026-10-20  
Repository: `TheOpti/cal.diy`  
Analyzed HEAD: `7f5c3d2abe22ce5716048fb5220bad980124449f`  
Window: 2025-10-20 through 2026-10-20 (Europe/Warsaw calendar boundaries).

## Scope and counting

- Local history reachable from HEAD; the repository is not shallow. History starts on 2021-03-10, so the full 12-month window is available.
- Date selection used Git's committer-date filtering. Counts represent distinct commits touching a file or area, including additions and deletions, not changed lines.
- An area receives at most one count per commit. A commit can count toward multiple areas.
- Of 2,029 commits, 1,555 remained after filtering: 26 automation commits, 67 release/version commits, 45 mechanical sweeps, and 336 noise-only commits were excluded.
- File noise included lockfiles, snapshots, generated outputs, dotenv files, configuration, images/assets, documentation and tooling metadata. Handwritten tests, migrations and product translations remained eligible.
- Mechanical exclusions covered formatting, bulk relocations and import rewrites. There was no size cutoff for the initial activity ranking: large substantive changes remained eligible.
- Identifiable AI authors were retained even when their account name contained `[bot]`. Ordinary automation, including automated translation updates, was excluded.
- Git similarity-based rename detection consolidated 1,133 historical path aliases. Unchanged-file renames did not contribute activity.
- `features/<name>` below combines corresponding `packages/features` and `apps/web/modules` paths, including historical `ee/` paths. `eventtypes` and `event-types` are grouped together. These are logical areas, not necessarily literal directories.
- Broad platform, API and web-route areas were subdivided. Shared utilities below refers only to direct files under `packages/lib`.

## Most active areas

AI-credited means an identifiable AI primary author or explicit AI `Co-authored-by` credit.

| Rank | Area | Commits | AI-credited | Product function |
|---:|---|---:|---:|---|
| 1 | `features/bookings` | 254 | 120 | Creates, reschedules, cancels and displays bookings. |
| 2 | `packages/i18n` | 198 | 93 | Supplies translated interface text throughout the product. |
| 3 | `features/event-types` | 109 | 41 | Configures meeting types, durations, hosts and booking rules. |
| 4 | `packages/prisma` | 104 | 60 | Defines and evolves persisted users, bookings and scheduling settings. |
| 5 | `features/workflows` | 73 | 36 | Automates reminders, notifications and follow-up actions. |
| 6 | `features/settings` | 69 | 31 | Provides account and organization settings interfaces. |
| 7 | `packages/lib` — direct shared utilities | 68 | 31 | Supports shared validation, security, dates and scheduling behavior. |
| 8 | `features/auth` | 67 | 24 | Handles sign-in, sessions and account verification. |
| 9 | `packages/trpc/server/routers/viewer/bookings` | 61 | 35 | Exposes authenticated booking-management operations. |
| 10 | `features/onboarding` | 58 | 13 | Guides initial account and scheduling setup. |

Tied for tenth: `features/shell` (58 commits, 23 AI-credited; application navigation) and `features/teams` (58 commits, 27 AI-credited; team membership and shared scheduling). Alphabetical ordering breaks the tie in the table.

## Most active files

Paths reflect the latest observed location, with detected previous names consolidated.

| Rank | File | Commits | AI-credited | Tracked at analyzed HEAD? |
|---:|---|---:|---:|---|
| 1 | `packages/i18n/locales/en/common.json` | 177 | 90 | Yes |
| 2 | `packages/prisma/schema.prisma` | 65 | 41 | Yes |
| 3 | `packages/features/bookings/lib/service/RegularBookingService.ts` | 47 | 23 | Yes |
| 4 | `packages/features/bookings/repositories/BookingRepository.ts` | 32 | 19 | Yes |
| 5 | `packages/features/bookings/lib/handleCancelBooking.ts` | 25 | 15 | Yes |
| 6 | `packages/features/eventtypes/repositories/eventTypeRepository.ts` | 25 | 13 | Yes |
| 7 | `apps/web/app/(use-page-wrapper)/settings/(settings-layout)/SettingsLayoutAppDirClient.tsx` | 24 | 12 | Yes |
| 8 | `apps/web/modules/bookings/views/bookings-single-view.tsx` | 23 | 10 | Yes |
| 9 | `companion/app/(tabs)/(event-types)/event-type-detail.tsx` | 23 | 3 | No |
| 10 | `packages/features/users/repositories/UserRepository.ts` | 23 | 12 | Yes |

Examples of consolidated paths:

- `apps/web/public/static/locales/...` → `packages/i18n/locales/...`.
- `packages/features/bookings/lib/handleNewBooking.ts` → `packages/features/bookings/lib/service/RegularBookingService.ts`.
- Components moved between `packages/features` and `apps/web/modules`.

### AI attribution

- AI primary author: **14/1,555 commits (0.9%)**, attributed to Devin, Mendral or CodeRabbit.
- AI author or co-author credit: **579/1,555 commits (37.2%)**, including those 14.
- These measure recorded attribution, not the proportion of AI-written code. Uncredited AI assistance is unknown.

## Corrective activity in the five leading areas

Subjects of fix commits were read before interpreting these rates. Relevant rollback changes were inspected to identify the actual concern.

| Area | All commits | Fix/hotfix, excluding rollbacks | Attributed reverts | Combined corrective share |
|---|---:|---:|---:|---:|
| Bookings | 254 | 110 | 1 | 43.7% |
| i18n | 198 | 62 | 0 | 31.3% |
| Event types | 109 | 51 | 0 | 46.8% |
| Prisma | 104 | 17 | 0 | 16.3% |
| Workflows | 73 | 34 | 1 | 47.9% |

Fix classification uses case-insensitive subjects beginning with `fix` or `hotfix`. Explicit rollbacks, including subjects beginning `fix: revert`, are classified separately. The i18n figure includes one hotfix. Denominators retain the original activity totals; rollback numerators include only the area actually concerned. Ordinary fixes can still count in multiple areas.

### Interpretation

- **Bookings:** strongest candidate for investigating recurring correctness problems. Subjects repeatedly concern paid-seat refunds (#29685), missing meeting URLs after seated rescheduling (#26914), payment events failing to trigger workflows/webhooks (#26044), round-robin 500 errors (#25369), and recurring-booking timezone conversion (#25235). Test flakes, styling and copy also contribute.
- **i18n:** primarily coordination and editorial work. Missing translations, typos, spacing and hardcoded text dominate many subjects; some commits merely add messages for fixes elsewhere. The hotfix restores an English banner translation (#24922). The rate is not strong evidence of an unstable translation subsystem.
- **Event types:** mixed signal. Alignment, padding, scrollbars, badges, empty states and loading skeletons contribute substantially. Functional issues include cancellation-setting persistence (#29282), UTC date ranges (#26900), host selection and calendar behavior. Prioritize those functional paths rather than interpreting the whole percentage as breakage.
- **Prisma:** foundational evolution and targeted maintenance. Subjects include validation, indexes, deletion behavior, setting propagation, test flakes, generator paths and CI migration configuration. No strong evidence here of repeated database failures.
- **Workflows:** a strong candidate for delivery-correctness review. Subjects include email not sending on form submission (#25722), seated-event email/SMS/WhatsApp reminders (#26136, #25294), missing reply-to values (#25867), meeting URLs (#25620), and reminders reaching all round-robin hosts (#25597). UI and dependency fixes also contribute.

These are corrective-activity rates, not production incident rates or measured failure severity.

### Rollback attribution

| Commit | Actual concern | Treatment |
|---|---|---|
| `1f102bf3b4` (#25172) | Booking redesign rollback across 35 files | Count once for bookings, not translations/shared UI. |
| `e3c0e11eb1` (#27289) | Removal of workflow link-cloaking restrictions | Count once for workflows; reversal of a restriction does not itself establish a reliability failure. |
| `a4d4626319` (#26759) | Cal Sans/shared typography rollback across 74 files | Attribute to shared UI, not every touched feature. |
| `227ed64b49`, `f5a813f531` (#27933, #27938) | Onboarding v3 rollout rollback and restoration | Attribute to onboarding, not Prisma merely because a migration changed. |
| `4228f576b1` | CSV-download cancellation rollback | Attribute to shared export functionality. |
| `31c6bbb5ba` (#27626) | User-level branding rollback | Attribute to branding. |
| `3a7122d613` (#27891) | `assignmentReason` webhook compatibility rollback | Attribute to webhook compatibility. |

## Co-change coupling

For this analysis only, commits touching **more than 10 distinct areas** were excluded. This removed 67 additional commits from the 1,555-commit activity sample, leaving **1,488**. This deliberately excludes broad feature commits as well as repository-wide sweeps to avoid artificial links.

For a pair A/B:

`share = commits touching both / min(commits touching A, commits touching B)`

Numerator and denominator use the same breadth-filtered sample. This is historical co-change, not proof of direct code dependency.

### Leading historical pairs

| Pair | Shared commits | Less-active denominator | Share |
|---|---:|---:|---:|
| `companion/app` ↔ `companion/components` | 38 | 46 | 82.6% |
| `features/bookings` ↔ `packages/i18n` | 34 | 174 | 19.5% |
| `packages/i18n` ↔ `packages/prisma` | 25 | 80 | 31.3% |
| `features/bookings` ↔ booking tRPC router | 23 | 43 | 53.5% |
| `features/bookings` ↔ `packages/prisma` | 21 | 80 | 26.3% |
| `companion/components` ↔ `companion/utils` | 19 | 20 | 95.0% |
| `features/bookings` ↔ booking API v2 | 18 | 48 | 37.5% |
| `features/event-types` ↔ `packages/i18n` | 18 | 89 | 20.2% |

Booking tRPC router: `packages/trpc/server/routers/viewer/bookings`.  
Booking API v2: `apps/api/v2/src/platform/bookings`.

### Leading historical triples

| Areas touched together | Commits |
|---|---:|
| `companion/app` + `companion/components` + `companion/utils` | 17 |
| `companion/app` + `companion/components` + `companion/hooks` | 16 |
| `companion/app` + `companion/components` + `companion/services` | 14 |
| `features/bookings` + `packages/i18n` + `packages/prisma` | 13 |
| `companion/app` + `companion/hooks` + `companion/utils` | 11 |
| `companion/components` + `companion/hooks` + `companion/utils` | 11 |

Triple counts require all three areas, but may include additional areas within the breadth limit. The last two tie.

### Findings for the top three areas

- **Bookings (213 breadth-filtered commits):** coordinated service/API work is common. Booking audit propagation, attendee operations, assignment reasons and rescheduling permissions recur in shared subjects. The bookings/i18n/Prisma triple suggests feature delivery across behavior, storage and user-facing text.
- **i18n (174):** co-change often represents feature delivery, not architectural dependence. Its 25 shared Prisma commits include cancellation settings, reports, permissions and billing: features naturally requiring stored data and translated labels.
- **Event types (89):** shared changes include bookings (15/89, 16.9%), the event-type tRPC router (12/29, 41.4%), and `packages/platform/atoms/event-types` (8/11, 72.7%). The embedded editor relationship is concentrated but has a small sample. Subjects cover cancellation-setting persistence, managed-event payloads and editor hooks; check both web and embedded editors when changing settings.

Sensitivity checks at breadth limits of 8 and 12 areas preserved the main relationships, although exact ordering and counts changed.

## Shared individual files: authored inputs versus generated outputs

Configs and generated files were restored as candidate shared files within the same 1,488-commit sample. This does not restore excluded automation or noise-only commits.

“Other surviving areas” counts distinct co-changed logical areas represented by files still tracked at analyzed HEAD, excluding the candidate's own area. It measures diversity, not repeated strength of each individual relationship.

| File | Commits in sample | Other surviving areas | Update mechanism |
|---|---:|---:|---|
| `packages/i18n/locales/en/common.json` | 153 | 120 | Authored translation keys and English copy |
| `packages/prisma/schema.prisma` | 44 | 53 | Authored schema; generator input |
| `yarn.lock` | 24 | 49 | Package-manager-maintained output |
| `packages/features/bookings/lib/service/RegularBookingService.ts` | 34 | 46 | Authored booking logic |
| `docs/api-reference/v2/openapi.json` | 43 | 37 | Generated API documentation |
| `turbo.json` | 15 | 30 | Build configuration; no generator identified |

All six files remain tracked. These are sample counts, not total historical edits.

The English translation file is the clearest common denominator. Before restricting co-changed files to surviving paths it connected to 160 historical areas; the current-file restriction reduces that to 120.

Evidence for update mechanisms:

- [`i18n.json`](../../i18n.json) declares English as the source locale and `packages/i18n/locales/[locale]/common.json` as the translation bucket.
- [`.github/workflows/i18n.yml`](../../.github/workflows/i18n.yml) runs Lingo on main pushes when its API-key secret is configured, requesting translation PRs. The workflow definition was verified; its current execution status was not.
- Commit `e3a9f54ba5` (#26872) directly changes English keys/copy for cancellation-reason settings. English is authored content, not a normal build-generated output. Authored content can still be AI-assisted.
- [`apps/api/v2/src/swagger/generate-swagger.ts`](../../apps/api/v2/src/swagger/generate-swagger.ts) constructs the OpenAPI specification from the API application and writes the checked-in JSON under its development-mode condition. `apps/api/v2/package.json` exposes `generate-swagger`.
- [`packages/prisma/schema.prisma`](../../packages/prisma/schema.prisma) declares generators for clients and derived types: the schema itself is an input.

Interpretation: English copy creates deliberate editing/review and potential merge coordination; generated translations/OpenAPI/lockfiles create regeneration and output-review work. These should not be treated as equivalent implementation coupling. Schema changes carry modeling and migration costs.

## Current-repository validation

Tracked paths were checked with `git ls-files` at analyzed HEAD.

- Nine of the initial top ten files survive at their consolidated paths.
- `companion/app/(tabs)/(event-types)/event-type-detail.tsx` does not survive. The next-ranked companion event-type `index.tsx` is also absent.
- All reported `companion/app`, `components`, `utils`, `hooks` and `services` directories have zero tracked files.
- Commit `f8a93414a5` (#27957) explicitly says the companion app moved to `calcom/companion`. Its historical coupling should not guide changes in the current repository. Subsequent external-repository history was not analyzed.
- Bookings, i18n, Prisma, booking APIs and embedded event-type editor paths remain.
- `features/event-types` is a logical label: current physical paths include `packages/features/eventtypes` and `apps/web/modules/event-types`.

### Pairs recalculated using only surviving files

The original breadth exclusion was retained, then deleted file paths were removed from each commit before computing area touches. This leaves 1,173 commits touching at least one surviving eligible file. Both pair numerators and area denominators were recalculated.

| Pair | Shared commits | Less-active denominator | Share |
|---|---:|---:|---:|
| Bookings ↔ i18n | 33 | 174 | 19.0% |
| i18n ↔ Prisma | 25 | 80 | 31.3% |
| Bookings ↔ booking tRPC router | 22 | 42 | 52.4% |
| Bookings ↔ Prisma | 21 | 80 | 26.3% |
| Event types ↔ i18n | 18 | 85 | 21.2% |
| Bookings ↔ booking API v2 | 18 | 48 | 37.5% |

Booking service/API coupling remains substantial after removing deleted paths. Companion relationships disappear entirely. The historical triples above were not recalculated as surviving-file triples.

## Unknowns and limitations

- `gh` is installed, but `gh auth status` reported no authenticated GitHub hosts. Closed-unmerged PRs and open bug reports were not obtained; their counts are unavailable, not zero. No GitHub changes were made.
- Local history does not establish runtime dependencies, incident frequency, severity, ownership quality or uncredited AI use.
- Subject-based fix classification includes maintenance and polish; it can miss corrections without a fix-like subject.
- Rename consolidation relies on Git similarity detection. Heavily rewritten moves may be missed, and the logical grouping is an analysis choice.
- Breadth thresholds and exclusion decisions are heuristics. The original activity ranking intentionally includes large substantive work; the coupling analysis intentionally excludes broadly spanning commits.
- Current-path survival is not a guarantee that historical behavior still exists unchanged.
- This document records the session's aggregates and evidence references. Temporary analysis scripts/data were not added to the repository.

## Suggested focus

1. Investigate booking correctness around seated bookings, rescheduling, payments and external side effects; review service and API changes together.
2. Investigate workflow delivery correctness, especially recipient selection and seated-event notifications.
3. Check web and embedded editors together when changing event-type settings.
4. Treat English translations as shared editorial coordination and generated outputs as downstream maintenance.
5. Exclude the removed companion app from current architectural priorities.
