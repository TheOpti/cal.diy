# Architectural Summary Report: Module 4 (10xArchitect Track)

Executive summary synthesizing the architectural analysis of the **Cal.diy** codebase across Module 4 artifacts: Repository Mapping (L2), Feature Research & Structural Audit (L3), Refactoring Planning (L4), and Domain-Driven Design (L5).

---

## 1. Described Projects

All artifacts in Module 4 originated from a single monorepo repository:

| Repository Name | Primary Stack | Scale (Approximate) | Associated Artifacts |
|---|---|---|---|
| **Cal.diy** (`TheOpti/cal.diy`) | **Monorepo**: Yarn 4.12.0, Turborepo, TypeScript (strict), Next.js 16.2.3 (React 18.2.0, Tailwind CSS), tRPC, NestJS (`apps/api/v2`), PostgreSQL with Prisma ORM (`schema.prisma` >2,600 lines), Vitest, Playwright, Biome. | **Large Enterprise Monorepo**: 2 applications (`apps/web`, `apps/api/v2`), 15+ shared packages (`packages/features`, `packages/prisma`, `packages/trpc`, `packages/platform`, `packages/lib`, `packages/app-store`, etc.). Annual activity in sample: 254 commits in bookings, 67 in auth; >100 database models. | **L2**: [repo-map.md](context/map/repo-map.md)<br>**L3**: [research.md](context/changes/create-booking/research.md)<br>**L4**: [plan.md](context/changes/refactor/plan.md)<br>**L5**: [01-domain-distillation.md](context/domain/01-domain-distillation.md), [02-invariant-aggregate-refactor.md](context/domain/02-invariant-aggregate-refactor.md), [03-anti-corruption-layer.md](context/domain/03-anti-corruption-layer.md) |

---

## 2. Project Map (from L2)

Synthesized from the one-year repository scan in [context/map/repo-map.md](context/map/repo-map.md):

1. **Booking Orchestration Risk Zone (Highest Churn)**: Bookings dominated the year's activity with 254 commits across [`RegularBookingService.ts`](packages/features/bookings/lib/service/RegularBookingService.ts), [`handleCancelBooking.ts`](packages/features/bookings/lib/handleCancelBooking.ts), and [`processPaymentRefund.ts`](packages/features/bookings/lib/payment/processPaymentRefund.ts). Git history documents recurring corrections for seats, refunds, and meeting URLs where persistence is deeply coupled to external calendar, payment, and notification side effects with only partial dependency injection.
2. **Local Hub & Value-Import Cycle**: A circular dependency crosses the shared feature logic and tRPC API boundary: [`getAllUserBookings.ts`](packages/features/bookings/lib/getAllUserBookings.ts) imports [`get.handler.ts`](packages/trpc/server/routers/viewer/bookings/get.handler.ts) which imports back into `getAllUserBookings.ts`. Git evidence confirms tightly coordinated changes (22 shared commits, 52.4% of the router sample).
3. **Verification & Watchlist Runtime Cycle**: Under `packages/features`, [`verifyEmail.ts`](packages/features/auth/lib/verifyEmail.ts) loads [`check-if-email-in-watchlist.controller.ts`](packages/features/watchlist/operations/check-if-email-in-watchlist.controller.ts) → [`watchlist.ts`](packages/features/di/watchlist/containers/watchlist.ts) → [`AdminWatchlistOperationsService.ts`](packages/features/watchlist/lib/service/AdminWatchlistOperationsService.ts) → `verifyEmail.ts`. As a result, blocking email checks dynamically load administrative operations that call verification back.
4. **Public Entry Points & Cache Invalidation Boundaries**: Public booking forms enter via [`apps/web/app/(booking-page-wrapper)/[user]/[type]/page.tsx`](apps/web/app/(booking-page-wrapper)/[user]/[type]/page.tsx) and `/api/book/event`. Event settings span Web wrappers ([`EventTypeWebWrapper.tsx`](apps/web/modules/event-types/components/EventTypeWebWrapper.tsx)), embedded atoms (`packages/platform/atoms`), and tRPC mutations, coordinating client caches with server path revalidation (`revalidatePath`).
5. **Major Unknowns & Analysis Limits**: Dependency-cruiser analysis under a single web `tsconfig.json` left 77 unresolved imports; no dedicated dependency graph existed for API v2, database runtime/SQL constraints, or the workflow engine.

---

## 3. Feature Analysis (from L3)

Synthesized from [context/changes/create-booking/research.md](context/changes/create-booking/research.md) and [context/changes/create-booking/structural-audit.md](context/changes/create-booking/structural-audit.md):

- **Target Flow & Map Link**: Investigated the **Booking Creation Flow** (`RegularBookingService.ts`), directly targeting **Risk Zone #1** (Booking creation, rescheduling, and refunds) due to its high churn and broad blast radius across persistence, credentials, calendars, payments, and webhooks.
- **Feature Overview**: Booking inputs arrive from public Booker web forms (`/api/book/event`) or API v2 controllers (`/v2/bookings`) and pass bot, rate-limiting, and schema validation. [`RegularBookingService`](packages/features/bookings/lib/service/RegularBookingService.ts) orchestrates event policies, availability, and host selection, delegating core state mutations to a raw Prisma transaction in [`createBooking.ts:139`](packages/features/bookings/lib/handleNewBooking/createBooking.ts#L139) that inserts the new `Booking` row and updates the predecessor if rescheduling. Subsequent external side effects (calendar event generation via `EventManager`, payment initiation, and asynchronous webhooks/emails) execute conditionally outside the database transaction, followed by a metadata/reference update. The service returns a booking result DTO, a payment redirect, an existing reused booking, or an unpersisted decoy (`id: 0`) if blocked by spam filters.
- **Technical Debt & Risks**:
  1. **Defective Fail-Open Test & False Confidence (*ast-grep confirmed*)**: In [`spam-booking.integration-test.ts:365`](packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts#L365), `vi.spyOn` targets an isolated `SpamCheckService` instance created inside the test file, while `RegularBookingService:594` instantiates a separate instance via `getSpamCheckService()`. Ast-grep query group 19 and 20 confirmed that `expect(isBlockedSpy)` is entirely missing; the test passes unconditionally without exercising or verifying the fail-open error path.
  2. **Decoy Contract Mismatch Across Adapters (*ast-grep confirmed*)**: Blocked spam returns a nonpersisted decoy result with `id: 0` (`RegularBookingService.ts:1506`). Web clients handle this gracefully via client-held state at `/booking-successful/[uid]` (`useBookings.ts:178`). However, API v2 (`services/bookings.service.ts:483`, ast-grep group 9) unconditionally reloads the booking by UID from PostgreSQL (`dbRead.prisma.booking.findUnique`), throwing an unhandled 404/500 error for blocked bookers.
  3. **Split Transaction and Integration Boundaries**: Database insertion completes at `createBooking.ts:139`, but provider calendar events (`EventManager:1835`), payment dispatch (`:2291`), and webhooks (`:2417`) run afterwards. Errors during the follow-up reference update (`:2461`) or webhook delivery are caught and logged, risking persisted database bookings with missing external integration state.

---

## 4. Refactoring Plan (from L4)

Synthesized from [context/changes/refactor/plan.md](context/changes/refactor/plan.md) and [context/changes/refactor/plan-brief.md](context/changes/refactor/plan-brief.md):

- **What Is Being Refactored**: Candidate **C10: Acyclic Watchlist Composition**. Refactoring the dependency injection and module composition of the watchlist and spam check services to eliminate the circular module dependency between `watchlist.ts`, `AdminWatchlistOperationsService.ts`, `verifyEmail.ts`, and `check-if-email-in-watchlist.controller.ts`.
  - **Target Shape**: Extract a dedicated, lightweight [`BlockingWatchlist.container.ts`](packages/features/di/watchlist/containers/BlockingWatchlist.container.ts) providing `getSpamCheckService()` binding only core logger/Prisma loaders and repositories, completely free of administrative or auth dependencies. Move admin factory functions to [`AdminWatchlist.container.ts`](packages/features/di/watchlist/containers/AdminWatchlist.container.ts). Retain [`SpamCheckService.container.ts`](packages/features/di/watchlist/containers/SpamCheckService.container.ts) as a `@deprecated` delegating facade.
- **What We Consciously Do NOT Do**:
  - We do **NOT** address C5 (the ~900-line retrieval cycle in `getAllUserBookings.ts` / `get.handler.ts`) to avoid massive multi-package diffs.
  - We do **NOT** rewrite Prisma `include` to `select` projections (C7) or remove `as unknown as PrismaClient` in API v2 (C9).
  - We do **NOT** alter spam filtering rules, business thresholds, or the fail-open policy (`isBlocked: false` on error).
- **Phases and Verification**:
  - **Phase 1: Test Characterization & N3 Gap Repair** — Fix failure-injection spy in `spam-booking.integration-test.ts` to intercept the container factory and assert `expect(isBlockedSpy).toHaveBeenCalled()`.  
    *Verification*: Automated (`yarn test packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts`) + Manual (code review of spy assertion and rejection execution).
  - **Phase 2: Acyclic Container Extraction** — Extract `BlockingWatchlist.container.ts` and `AdminWatchlist.container.ts`, pruning admin imports from `watchlist.ts`.  
    *Verification*: Automated (`yarn test BlockingWatchlist.container.test.ts`, `yarn biome check`, `yarn type-check:ci --force`) + Manual (code review confirming zero admin/auth imports in the blocking container).
  - **Phase 3: Consumer Migration & Verification** — Rewire `RegularBookingService.ts` to the blocking container, point 6 tRPC admin handlers to the admin container, and deprecate the legacy container facade.  
    *Verification*: Automated (`yarn test RegularBookingService.test.ts`, tRPC handler tests, full repo type check `yarn type-check:ci --force`, `yarn biome check`) + Manual (`git diff --stat` confirming <500 lines changed across <10 files).

---

## 5. Domain per DDD (from L5)

Synthesized from [context/domain/01-domain-distillation.md](context/domain/01-domain-distillation.md), [02-invariant-aggregate-refactor.md](context/domain/02-invariant-aggregate-refactor.md), and [03-anti-corruption-layer.md](context/domain/03-anti-corruption-layer.md):

- **Ubiquitous Language (Core Concepts)**:
  1. **Event Type (`EventType`)**: Reusable bookable offering defining duration, ownership, and booking policies; distinct from individual appointments or calendar events.
  2. **Booking & Booking Status (`Booking`, `BookingStatus`)**: A specific scheduled appointment with participants and lifecycle state (`ACCEPTED`, `PENDING`, `CANCELLED`, `REJECTED`, `AWAITING_HOST`), decoupled from payment state.
  3. **Booking Seat (`BookingSeat`)**: An attendee's reserved place in a capacity-limited appointment; distinct from organization subscription billing seats (`SeatChangeLog`).
  4. **Booking Window / Limits (`minimumBookingNotice`, `periodType`, `ROLLING_WINDOW`)**: Server-enforced rules governing how far in advance or into the future an appointment may be scheduled.
  5. **Selected vs Destination Calendar (`SelectedCalendar` vs `DestinationCalendar`)**: Connected provider calendars read for busy-time calculation vs the target calendar receiving the created appointment.
- **Major Model-vs-Code Discrepancies**:
  - **D1 (Cancellation Policy Exemption)**: Specification mandates platform users obey cancellation reason rules (`specs/cancellation-reason-requirement/design.md:70`), but code explicitly bypasses validation when `platformClientId` is present (`handleCancelBooking.ts:161`).
  - **D2 / D4 (Booking Window Evaluator Fail-Open)**: UI promises strict future booking limits (`common.json:2257`), but unexpected evaluator errors in `validateBookingTimeIsNotOutOfBounds.ts:48` log a warning and default `timeOutOfBounds = false`, silently admitting illegal booking times.
  - **D3 (Calendar Sync Guarantee Contradiction)**: Documentation claims calendar sync "Guarantees updates through webhook event delivery" (`calendar-subscription/README.md:14`), but in code (`CalendarSubscriptionService.ts:319`, `CalendarSyncService.ts:146`), the sync cursor advances *before* changes are applied, and failed booking cancellations are caught and logged without retry.
- **Invariant #1 and Its Guardian Aggregate**:
  - **Aggregate**: `BookingAggregate` (supported by immutable `BookingWindowPolicy` and `BookingWindowEvidence` value objects).
  - **Invariant #1 (Booking-Window Admission)**: An appointment start instant may be admitted for creation or movement only after the server proves it satisfies the event type's minimum notice (`start >= now + minimumNotice`) and future window boundaries (`ROLLING`, `RANGE`, `ROLLING_WINDOW`). Missing, invalid, or failed evaluation must stop the operation with a typed `BookingTimeOutOfBounds` error; `ROLLING_WINDOW` must never be bypassed on direct API/command paths.
- **Anti-Corruption Layer (ACL)**:
  - **Leaking Dependency**: **`rrule` (v2.7.1)** (RFC 5545 recurrence engine).
  - **Leakage Across 4 Architectural Layers**:
    1. *Domain / Contracts*: Leaks `Frequency` type into shared [`Calendar.d.ts:134`](packages/types/Calendar.d.ts#L134) (`RecurringEvent`).
    2. *Persistence*: Stored JSON validation in [`zod-utils.ts:81, 233`](packages/prisma/zod-utils.ts#L81) mirrors vendor options and numeric enums (`YEARLY=0` .. `SECONDLY=6`).
    3. *Application / Infrastructure*: Helpers [`parse-dates.ts:99`](packages/lib/parse-dates.ts#L99) and [`getCalendarLinks.ts:78`](packages/features/bookings/lib/getCalendarLinks.ts#L78) directly instantiate `new RRule(...)`, apply manual DST corrections, and serialize string formats.
    4. *Presentation*: Directly bundled into client views ([`bookings-single-view.tsx:182`](apps/web/modules/bookings/views/bookings-single-view.tsx#L182)) and email components ([`WhenInfo.tsx:23`](packages/emails/src/components/WhenInfo.tsx#L23)).
  - **Target ACL**: Server-only boundary under `packages/lib/recurrence/` featuring a pure `RecurrencePattern` value object, `RecurrencePort`, and `RecurrenceCodec` to isolate vendor conversions and ensure zero vendor types leak into UI, DTOs, or database models.

---

## 6. Decisions Belonging to Me

1. **Strict PR Scoping over Broad Refactoring (L4)**: When the AI proposed resolving both the complex tRPC retrieval cycle (C5, ~900 lines of Kysely SQL queries) and watchlist circular imports in a single initiative, I rejected C5 and scoped the refactoring plan exclusively to C10 (Acyclic Watchlist Composition) to strictly uphold Cal.diy's <500-line PR boundary.
2. **Prioritizing Booking-Window Admission over Cancellation Rules (L5)**: While the AI initially recommended refactoring cancellation reason policies (A1/I2), I redirected the primary invariant focus to Invariant #1 (Booking-Window Admission) after discovering that `isOutOfBounds.tsx:374` explicitly skipped rolling-window checks on command paths and swallowed evaluator errors, representing a more critical scheduling integrity defect.
3. **Preserving Database Column Compatibility in ACL Design (L5)**: Rather than accepting an AI suggestion to migrate database columns and immediately eradicate all legacy numeric frequency constants, I enforced the retention of the existing JSON format via a dedicated `RecurrenceCodec` adapter, avoiding breaking schema migrations across production databases.
4. **Uncovering the Ineffective Fail-Open Test (L3/L4)**: While the AI initially treated the fail-open test suite as passing evidence, I scrutinized the mock wiring to discover that `spam-booking.integration-test.ts` was spying on an unlinked instance without an assertion, mandating the test repair in Phase 1 before touching production containers.
