# Booking Creation Refactor (C10: Acyclic Watchlist Composition) Implementation Plan

## Overview

Refactor the dependency injection and module composition of the watchlist and spam check services to eliminate a circular module dependency between [watchlist.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/watchlist.ts), [AdminWatchlistOperationsService.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/watchlist/lib/service/AdminWatchlistOperationsService.ts), [verifyEmail.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/auth/lib/verifyEmail.ts), and [check-if-email-in-watchlist.controller.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/watchlist/operations/check-if-email-in-watchlist.controller.ts). This resolves priority candidate **C10** identified in [context/changes/refactor/research.md](file:///c:/Users/opti/Desktop/projects/cal.diy/context/changes/refactor/research.md), decoupling lightweight spam checking during booking orchestration from heavyweight administrative operations and email verification, while maintaining fail-open semantics and staying strictly under Cal.diy's 500-line PR limit.

## Current State Analysis

During booking creation in [RegularBookingService.ts:594](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/bookings/lib/service/RegularBookingService.ts#L594), spam checking invokes `getSpamCheckService()` from [SpamCheckService.container.ts:7](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/SpamCheckService.container.ts#L7). This helper imports `getGlobalBlockingService` and `getOrganizationBlockingService` from [watchlist.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/watchlist.ts#L5).

However, `watchlist.ts:16` imports `AdminWatchlistOperationsService`, which in turn imports `sendEmailVerification` from [verifyEmail.ts:1](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/auth/lib/verifyEmail.ts#L1). `verifyEmail.ts:10` imports `checkIfEmailIsBlockedInWatchlistController` from [check-if-email-in-watchlist.controller.ts:10](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/watchlist/operations/check-if-email-in-watchlist.controller.ts#L10), which imports `getWatchlistFeature` from `watchlist.ts:1` — closing a value-import and module-loading loop.

Furthermore, existing test coverage for fail-open behavior in [spam-booking.integration-test.ts:365](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts#L365) is defective (gap N3): it spies on an isolated instance of `SpamCheckService` created in the test, rather than the instance constructed inside `RegularBookingService`, allowing tests to pass without ever executing or verifying the fail-open error-recovery path.

## Desired End State

1. **Acyclic Module Graph**: Booking creation imports a dedicated, lightweight [BlockingWatchlist.container.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/BlockingWatchlist.container.ts) with zero imports of admin operations or email verification. Administrative factories reside in `AdminWatchlist.container.ts`, breaking the circular dependency.
2. **Deterministic Fail-Open Shield**: [spam-booking.integration-test.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts) reliably mocks the container factory and asserts that the failure-handling path executes as expected (`expect(isBlockedSpy).toHaveBeenCalled()`).
3. **Full Backward Compatibility**: The existing [SpamCheckService.container.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/SpamCheckService.container.ts) is maintained as a thin, `@deprecated` delegating facade, ensuring zero breakage for external or unindexed consumers.
4. **Strict Scope & Quality**: All changes pass `yarn type-check:ci --force`, `yarn biome check`, and relevant unit/integration tests within a single focused diff under 500 lines of code across fewer than 10 files.

### Key Discoveries:

- `packages/features/di/watchlist/modules/Watchlist.module.ts:12`: The core IoC module binds only repositories and blocking services (`GLOBAL_BLOCKING_SERVICE`, `ORGANIZATION_BLOCKING_SERVICE`). It has no admin or auth dependencies.
- `packages/features/di/watchlist/containers/watchlist.ts:83`: Admin factory functions (`getAdminWatchlistOperationsService`, `getAdminWatchlistQueryService`) are not IoC container bindings; they are standalone helper functions instantiating classes directly with Prisma.
- `packages/trpc/server/routers/viewer/admin/watchlist/*.handler.ts`: Only 6 tRPC admin handlers consume the admin factories from `watchlist.ts`.
- `packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts:365`: Spy targets an unlinked instance because `getSpamCheckService()` instantiates `new SpamCheckService(...)` on each call without a factory override.

## What We're NOT Doing

- **NOT addressing C5 (Listing Query Layer Inversion)**: Refactoring `getAllUserBookings.ts` and `get.handler.ts` involves ~900 lines of complex SQL and hydration queries, which will be planned as a separate dedicated multi-phase change to respect PR limits.
- **NOT touching C7 (Prisma Include vs Select)**: Replacing query shapes in `createBooking.ts` and API reload repositories is deferred to an independent query-optimization task.
- **NOT touching C9 (`as unknown as PrismaClient`)**: API v2 regular booking service type assertion is left untouched to maintain single responsibility.
- **NOT changing fail-open policy or authentication rules**: The business logic of spam checking (`isBlocked: false` on error) and watchlist filtering remains 100% identical.

## Implementation Approach

1. **Step-by-step TDD / Verification First**: Fix test gap N3 first so that `spam-booking.integration-test.ts` genuinely executes and verifies fail-open error tolerance before any container changes are made.
2. **Extract & Isolate**: Create `BlockingWatchlist.container.ts` loading only `prismaModuleLoader`, `loggerModuleLoader`, and the blocking bindings. Move admin factories to `AdminWatchlist.container.ts`.
3. **Migrate with Safety Seam**: Rewire `RegularBookingService.ts` to `BlockingWatchlist.container.ts`, retain `SpamCheckService.container.ts` as a deprecated delegating re-export, and update tRPC admin handler import paths.

## Critical Implementation Details

- **Timing & lifecycle**: The IoC container module loaders (`prismaModuleLoader`, `loggerModuleLoader`) must be loaded into the new blocking container upon creation before resolving tokens.
- **Debug & observability**: The new container and factory must maintain existing sub-logger prefixes (`[WatchlistService]`) and logging behavior.

---

## Phase 1: Test Characterization & N3 Gap Repair

### Overview

Repair the defective failure-injection test in [spam-booking.integration-test.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts#L365) (gap N3) by ensuring the mock or spy intercepts the actual `SpamCheckService` instance used by `RegularBookingService`, and asserting that the error-handling branch is genuinely executed.

### Changes Required:

#### 1. Spam Booking Integration Test

**File**: `packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts`

**Intent**: Intercept `getSpamCheckService` at the module level using `vi.spyOn` or module mock before `handleNewBooking` is executed, configure `isBlocked` on that returned service to reject, and assert that `isBlocked` was called during booking creation while verifying the booking succeeds fail-open.

**Contract**: 
The test case `"should not short-circuit booking when watchlist check fails (fail-open behavior)"` must verify that when `isBlocked` throws:
1. `isBlockedSpy` was called at least once.
2. `createdBooking` has `status: BookingStatus.ACCEPTED`, valid ID (`!= 0`), and no `isShortCircuitedBooking` property.

### Success Criteria:

#### Automated Verification:

- Mock container in spam integration test: `yarn test packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts`
- Verify fail-open rejection spy was called: `yarn test packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts`
- Existing booking integration test suite passes: `yarn test packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts`

#### Manual Verification:

- Code review of spy assertion in spam-booking.integration-test.ts confirms rejection branch is genuinely executed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Acyclic Container Extraction

### Overview

Create a dedicated [BlockingWatchlist.container.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/BlockingWatchlist.container.ts) providing `getSpamCheckService()` and `getBlockingWatchlistContainer()`. Extract admin factory functions out of [watchlist.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/watchlist.ts) into [AdminWatchlist.container.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/AdminWatchlist.container.ts). Add a dedicated unit test verifying acyclic initialization.

### Changes Required:

#### 1. Blocking Watchlist Container

**File**: `packages/features/di/watchlist/containers/BlockingWatchlist.container.ts`

**Intent**: Dedicated container for spam check and blocking services, loading only `prismaModuleLoader`, `loggerModuleLoader`, and the blocking bindings from `Watchlist.module.ts`. Exports `getSpamCheckService` and `getBlockingWatchlistContainer`.

**Contract**:
```typescript
export const blockingWatchlistContainer: Container;
export function getSpamCheckService(): SpamCheckService;
```

#### 2. Admin Watchlist Container

**File**: `packages/features/di/watchlist/containers/AdminWatchlist.container.ts`

**Intent**: Move `getAdminWatchlistOperationsService`, `getAdminWatchlistQueryService`, `getOrganizationWatchlistOperationsService`, and `getOrganizationWatchlistQueryService` here.

**Contract**:
Preserves exact signatures of the admin factory functions previously in `watchlist.ts`.

#### 3. Core Watchlist Container Cleanup

**File**: `packages/features/di/watchlist/containers/watchlist.ts`

**Intent**: Remove imports of `AdminWatchlistOperationsService`, `AdminWatchlistQueryService`, `OrganizationWatchlistOperationsService`, and `OrganizationWatchlistQueryService`, as well as their factory functions. Retain core `watchlistContainer` and `getWatchlistFeature()`.

**Contract**:
`watchlist.ts` no longer imports anything from `@calcom/features/watchlist/lib/service/Admin*` or `@calcom/features/auth`.

#### 4. Container Unit & Cycle Test

**File**: `packages/features/di/watchlist/containers/BlockingWatchlist.container.test.ts`

**Intent**: Unit test verifying `getSpamCheckService()` initializes cleanly and returns an instance of `SpamCheckService` without triggering circular module loads.

### Success Criteria:

#### Automated Verification:

- Unit test for BlockingWatchlist.container passes: `yarn test packages/features/di/watchlist/containers/BlockingWatchlist.container.test.ts`
- Static circular dependency check confirms no cycle between watchlist and auth: `yarn biome check packages/features/di/watchlist`
- Type checking passes for packages/features: `yarn type-check:ci --force`

#### Manual Verification:

- Code review confirms zero imports of AdminWatchlistOperationsService or verifyEmail in BlockingWatchlist.container.ts and watchlist.ts

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Consumer Migration & Verification

### Overview

Update [RegularBookingService.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/bookings/lib/service/RegularBookingService.ts) to import from `BlockingWatchlist.container.ts`. Retain [SpamCheckService.container.ts](file:///c:/Users/opti/Desktop/projects/cal.diy/packages/features/di/watchlist/containers/SpamCheckService.container.ts) as a deprecated delegating facade. Update the 6 tRPC admin handlers to import from `AdminWatchlist.container.ts`. Perform full type checks, linting, and PR diff size verification.

### Changes Required:

#### 1. Regular Booking Service

**File**: `packages/features/bookings/lib/service/RegularBookingService.ts`

**Intent**: Update import on line 33 from `SpamCheckService.container` to `BlockingWatchlist.container`.

#### 2. Deprecated Delegating Facade

**File**: `packages/features/di/watchlist/containers/SpamCheckService.container.ts`

**Intent**: Re-export `getSpamCheckService` from `BlockingWatchlist.container.ts` with a `@deprecated` annotation.

#### 3. tRPC Admin Watchlist Handlers

**Files**:
- `packages/trpc/server/routers/viewer/admin/watchlist/addToWatchlist.handler.ts`
- `packages/trpc/server/routers/viewer/admin/watchlist/bulkDelete.handler.ts`
- `packages/trpc/server/routers/viewer/admin/watchlist/bulkDismiss.handler.ts`
- `packages/trpc/server/routers/viewer/admin/watchlist/create.handler.ts`
- `packages/trpc/server/routers/viewer/admin/watchlist/delete.handler.ts`
- `packages/trpc/server/routers/viewer/admin/watchlist/dismissReport.handler.ts`
- `packages/trpc/server/routers/viewer/admin/watchlist/pendingReportsCount.handler.ts`
- `packages/trpc/server/routers/viewer/admin/watchlist/listReports.handler.ts`
- `packages/trpc/server/routers/viewer/admin/watchlist/list.handler.ts`
- `packages/trpc/server/routers/viewer/admin/watchlist/getDetails.handler.ts`

**Intent**: Update import source from `./containers/watchlist` to `./containers/AdminWatchlist.container`.

### Success Criteria:

#### Automated Verification:

- RegularBookingService imports BlockingWatchlist.container: `yarn test packages/features/bookings/lib/service/RegularBookingService.test.ts`
- Deprecated facade SpamCheckService.container delegates correctly: `yarn test packages/features/bookings/lib/handleNewBooking/test/buildDryRunBooking.test.ts`
- tRPC admin watchlist handlers pass with AdminWatchlist.container: `yarn test packages/trpc/server/routers/viewer/admin/watchlist/addToWatchlist.handler.test.ts`
- Full type checking passes across repo: `yarn type-check:ci --force`
- Biome check passes on all touched files: `yarn biome check packages/features/di/watchlist packages/features/bookings packages/trpc/server/routers/viewer/admin/watchlist`

#### Manual Verification:

- PR diff size check confirms changes are under 500 lines and fewer than 10 files

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `packages/features/di/watchlist/containers/BlockingWatchlist.container.test.ts`: Verify container instantiates, registers `GLOBAL_BLOCKING_SERVICE` and `ORGANIZATION_BLOCKING_SERVICE`, and creates `SpamCheckService` without loading admin operations or auth services.

### Integration Tests:

- `packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts`: Verify that fail-open behavior genuinely works when spam checking rejects, with spy assertion `expect(isBlockedSpy).toHaveBeenCalled()`.
- `packages/features/bookings/lib/handleNewBooking/test/buildDryRunBooking.test.ts`: Ensure dry run booking mock of `SpamCheckService.container` continues to function.

### Manual Testing Steps:

1. Inspect git status and diff using `git diff --stat` to verify lines changed < 500 and files touched <= 10.
2. Verify dependency graph from `BlockingWatchlist.container.ts` contains zero edges pointing to `AdminWatchlistOperationsService` or `verifyEmail`.

## Performance Considerations

Eliminating the circular dependency avoids unnecessary class loading and module evaluation of administrative repositories and email auth logic whenever booking creation or spam checking executes.

## Migration Notes

`SpamCheckService.container.ts` is retained as a delegating re-export marked `@deprecated`, ensuring zero runtime disruption for any external caller.

## References

- Related research: [context/changes/refactor/research.md](file:///c:/Users/opti/Desktop/projects/cal.diy/context/changes/refactor/research.md)
- Circular dependency audit: [context/changes/create-booking/research.md:122-125](file:///c:/Users/opti/Desktop/projects/cal.diy/context/changes/create-booking/research.md#L122-L125)
- Repository PR guidelines: [AGENTS.md](file:///c:/Users/opti/Desktop/projects/cal.diy/AGENTS.md)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test Characterization & N3 Gap Repair

#### Automated

- [ ] 1.1 Mock container in spam integration test
- [ ] 1.2 Verify fail-open rejection spy was called
- [ ] 1.3 Existing booking integration test suite passes

#### Manual

- [ ] 1.4 Code review of spy assertion in spam-booking.integration-test.ts confirms rejection branch is genuinely executed

### Phase 2: Acyclic Container Extraction

#### Automated

- [ ] 2.1 Unit test for BlockingWatchlist.container passes
- [ ] 2.2 Static circular dependency check confirms no cycle between watchlist and auth
- [ ] 2.3 Type checking passes for packages/features

#### Manual

- [ ] 2.4 Code review confirms zero imports of AdminWatchlistOperationsService or verifyEmail in BlockingWatchlist.container.ts and watchlist.ts

### Phase 3: Consumer Migration & Verification

#### Automated

- [ ] 3.1 RegularBookingService imports BlockingWatchlist.container
- [ ] 3.2 Deprecated facade SpamCheckService.container delegates correctly
- [ ] 3.3 tRPC admin watchlist handlers pass with AdminWatchlist.container
- [ ] 3.4 Full type checking passes across repo
- [ ] 3.5 Biome check passes on all touched files

#### Manual

- [ ] 3.6 PR diff size check confirms changes are under 500 lines and fewer than 10 files
