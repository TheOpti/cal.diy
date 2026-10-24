# Booking Creation Refactor (C10: Acyclic Watchlist Composition) — Plan Brief

> Full plan: `context/changes/refactor/plan.md`
> Research: `context/changes/refactor/research.md`

## What & Why

Refactor the dependency injection and module composition of the watchlist and spam check services to eliminate a circular module dependency between [watchlist.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/watchlist.ts), [AdminWatchlistOperationsService.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/watchlist/lib/service/AdminWatchlistOperationsService.ts), [verifyEmail.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/auth/lib/verifyEmail.ts), and [check-if-email-in-watchlist.controller.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/watchlist/operations/check-if-email-in-watchlist.controller.ts). This eliminates coupling between booking creation and administrative verification, isolates spam check instantiation, and hardens fail-open test coverage.

## Starting Point

Booking orchestration calls `getSpamCheckService()` from [SpamCheckService.container.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/SpamCheckService.container.ts), which imports from `watchlist.ts`. `watchlist.ts` imports `AdminWatchlistOperationsService`, which imports `verifyEmail`, which imports `checkIfEmailIsBlockedInWatchlistController`, which imports back into `watchlist.ts`. Furthermore, test gap N3 in [spam-booking.integration-test.ts:365](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts#L365) spies on an unlinked instance, masking fail-open verification.

## Desired End State

A dedicated, lightweight [BlockingWatchlist.container.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/BlockingWatchlist.container.ts) provides `getSpamCheckService()` without admin or auth imports. Admin factory functions reside in [AdminWatchlist.container.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/AdminWatchlist.container.ts), permanently breaking the circular loop. [spam-booking.integration-test.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts) reliably verifies fail-open execution, and the old container is kept as a `@deprecated` facade.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Target Candidate | C10 (Acyclic Watchlist Composition) | Solves the highest-ranked cycle issue while staying comfortably within Cal.diy's <500 lines PR limit. | Research / Plan |
| Container Architecture | Dedicated `BlockingWatchlist.container.ts` | Eliminates value-import cycles statically without changing consuming service interfaces. | Plan |
| Test Gap N3 Strategy | Mock container factory in integration test | Guarantees the fail-open error path in `RegularBookingService` is genuinely exercised and verified. | Plan |
| Backward Compatibility | Transitional `@deprecated` facade | Keeps `SpamCheckService.container.ts` re-exporting the new container to prevent breaking external callers. | Plan |
| PR Scope & Slicing | Single self-contained PR (<500 lines) | Strict focus on C10 prevents PR bloat; adjacent cleanups (C5, C7, C9) remain in separate changes. | Plan |

## Scope

**In scope:**
- Fix failure-injection spy in [spam-booking.integration-test.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts) (gap N3).
- Create `BlockingWatchlist.container.ts` and `BlockingWatchlist.container.test.ts`.
- Extract admin factories into `AdminWatchlist.container.ts`.
- Update `RegularBookingService.ts`, tRPC admin handlers, and deprecate `SpamCheckService.container.ts`.

**Out of scope:**
- C5 (Listing query inversion in `get.handler.ts` / `getAllUserBookings.ts`).
- C7 (Prisma `include` vs `select` query projections).
- C9 (`as unknown as PrismaClient` in API v2).
- Altering business logic, spam filtering rules, or fail-open policies.

## Architecture / Approach

Extract blocking DI bindings into an independent container `BlockingWatchlist.container.ts` that only loads repositories and logger/Prisma providers. Admin operations factories are moved to `AdminWatchlist.container.ts`. The resulting graph is strictly one-directional: Admin/Auth → Core Watchlist ← Blocking Container, with zero reverse edges.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Test Characterization & N3 Repair | Reliable fail-open test execution in integration suite | Test setup timing or unmocked singleton instances |
| 2. Acyclic Container Extraction | `BlockingWatchlist.container.ts` and `AdminWatchlist.container.ts` | Missing IoC module bindings for logger/Prisma |
| 3. Consumer Migration & Verification | Rewired services, deprecated facade, passed type-check & lint | Unindexed external imports of legacy container |

**Prerequisites:** Node/Yarn environment with Vitest and Biome.
**Estimated effort:** ~1 implementation session, ~200 lines changed across 8-10 files (1 PR).

## Open Risks & Assumptions

- **Assumption**: Existing tRPC admin handlers are the sole consumers of `getAdminWatchlistOperationsService` and `getAdminWatchlistQueryService` (verified via AST/grep).
- **Risk**: Any unindexed dynamic imports of `SpamCheckService.container.ts` are mitigated by preserving it as a delegating facade.

## Success Criteria (Summary)

- Circular dependency between watchlist, admin operations, auth, and controller is eliminated.
- Fail-open integration test passes with verified spy invocation on error.
- All unit, integration, and CI type-checks (`yarn type-check:ci --force`) pass cleanly under 500 lines diff.
