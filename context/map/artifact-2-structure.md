# Structure: active-area dependency cycles and testability risks

Analysis date: 2026-10-20  
Repository: `TheOpti/cal.diy`  
Analyzed HEAD: `16d90146466f57f24f0e23efb568021ec1a8f1f7`  
Activity baseline: [artifact-1-territory.md](artifact-1-territory.md), recorded at `7f5c3d2abe22ce5716048fb5220bad980124449f`.

## Summary

- Booking retrieval has a genuine two-file runtime cycle between shared booking logic and its tRPC handler. This aligns with the territory map's strong booking/API co-change relationship.
- Email verification has a four-file runtime cycle through watchlist checking, dependency injection and administrative watchlist operations.
- Large booking-service cycle warnings include type-only edges. The smallest service/DTO loop is two files, both joined by type imports; it is not a runtime architectural problem.
- Booking creation and cancellation are the strongest candidates for integration tests with external-service fakes. Event editing, profile settings and onboarding also need selected browser tests for cache, session, storage and navigation behavior.
- Import counts alone do not establish test difficulty. Constructor injection helps repositories; onboarding's small retained import surface hides persistent browser state. Workflow implementation was absent from the graph and remains unassessed.

## Scope and method

Used installed dependency-cruiser 18.7.0 with `.dependency-cruiser.mjs` and `apps/web/tsconfig.json`:

```powershell
& node_modules/.bin/depcruise.cmd apps/web --output-type json --output-to dependency-report.active.json
& node_modules/.bin/depcruise.cmd apps/web packages --output-type json --output-to dependency-report.web-packages.json
```

The web-entry scan contained 2,804 modules, 11,107 dependency edges and 14 unresolved-import warnings. The package cross-check contained 4,526 modules, 15,845 edges and 77 unresolved-import warnings. Both yielded the same two shortest runtime loops touching active areas. The testability assessment reused these graphs at unchanged HEAD and inspected selected implementations and existing tests.

Reporting was limited to active areas from the territory map: bookings, i18n, event types, Prisma, workflows, settings, direct shared utilities, auth, the booking tRPC router, onboarding, and the tied areas shell and teams. Related modules appear only where they participate in those areas' dependencies.

Type-only imports were included in the initial graph, then removed for runtime-loop analysis. Declaration files and build paths were also excluded from the runtime projection. Shortest return paths through active modules were inspected rather than treating an entire connected group as one loop; longer type-expanded variants were omitted from the summary. This is a focused set of shortest witnesses, not an enumeration of every possible cycle.

External package contents, build outputs (`dist`, `build`, `.next`, etc.) and configured generated files were excluded. Build-output cycles were therefore not assessed or counted as architectural findings. No Graphviz/DOT was generated, no application code was changed, and no tests were run.

## Runtime cycles

| Area | Smallest reported loop and evidence | Why it matters | Territory connection | Next check |
|---|---|---|---|---|
| Bookings / booking tRPC | `packages/features/bookings/lib/getAllUserBookings.ts → packages/trpc/server/routers/viewer/bookings/get.handler.ts → getAllUserBookings.ts`. Both edges are value imports. The helper imports `getBookings`; the handler imports and calls the helper. | Shared retrieval logic depends on the API handler that consumes it. Isolated tests and refactoring pull both layers together. This does not establish infinite recursion. | Bookings: 254 commits. Surviving-file booking/router co-change: 22 shared commits / 42 = 52.4%. | Consider placing query orchestration in a service consumed by both callers. Verify filtering, sorting, pagination and authorization context. |
| Auth / watchlist | Under `packages/features/`: `auth/lib/verifyEmail.ts → watchlist/operations/check-if-email-in-watchlist.controller.ts → di/watchlist/containers/watchlist.ts → watchlist/lib/service/AdminWatchlistOperationsService.ts → auth/lib/verifyEmail.ts`. All four edges are value imports. | Verification loads watchlist composition, which imports administrative operations that call verification. This complicates mocks and independent changes; future module-level initialization could make import order significant. | Auth: 67 commits. Watchlist is included because the loop directly touches auth. | Separate blocking-check composition from administrative operations, or inject the verification sender. Check blocked signup and verification after administrative unlocking. |

These are structural risks, not demonstrated runtime failures.

## Type-only and type-dependent cycles

“Type-dependent” means a mixture of value and type imports whose loop disappears when type-only edges are removed. These are not runtime architectural problems and should not inflate runtime-cycle priorities.

| Active area | Compact loop | Classification |
|---|---|---|
| Booking service | Under `packages/features/bookings/`: `lib/dto/types.d.ts ↔ lib/service/RegularBookingService.ts` | Both edges type-only. Larger booking-event type paths expand this two-file core. The service has 47 commits in the territory map. |
| Booking repository | Under `packages/features/`: `bookings/repositories/BookingRepository.ts → bookings/repositories/IBookingRepository.ts → CalendarEventBuilder.ts → BookingRepository.ts` | All three edges type-only. Repository: 32 commits. |
| Cancellation | Under `packages/features/bookings/`: `lib/handleCancelBooking.ts ↔ lib/handleSeats/cancel/cancelAttendeeSeat.ts` | Forward edge value import; return edge type-only. Cancellation file: 25 commits. |
| Calendar/cancellation | `packages/app-store/_utils/getCalendar.ts → packages/features/calendar-subscription/lib/CalendarSubscriptionService.ts → packages/features/calendar-subscription/lib/sync/CalendarSyncService.ts → packages/features/bookings/lib/handleCancelBooking.ts → packages/features/bookings/lib/EventManager.ts → getCalendar.ts` | Subscription-service to sync-service edge is type-only; other edges are value imports. No complete runtime loop. |
| Event-type host selection | `packages/features/eventtypes/components/CheckedTeamSelect.tsx ↔ packages/features/eventtypes/components/dialogs/HostEditDialogs.tsx` | One value and one type-only edge. |
| Event-type availability | Under `apps/web/modules/event-types/components/tabs/availability/`: `EventAvailabilityTab.tsx ↔ EventAvailabilityTabWebWrapper.tsx` | One type-only and one value edge. |
| Settings OAuth | Under `apps/web/modules/settings/oauth/`: `create/OAuthClientCreateModal.tsx ↔ view/OAuthClientFormFields.tsx` | One value and one type-only edge. |
| Settings travel | `apps/web/components/settings/TravelScheduleModal.tsx ↔ apps/web/modules/settings/my-account/general-view.tsx` | One type-only and one value edge. |
| Settings email | `apps/web/components/settings/CustomEmailTextField.tsx ↔ apps/web/modules/settings/my-account/profile-view.tsx` | One type-only and one value edge. |
| Shell | Under `apps/web/modules/shell/navigation/`: `NavigationItem.tsx ↔ useShouldDisplayNavigationItem.ts` | Component-to-hook is a value import; return edge is type-only. |

These contracts can require coordinated type edits, but that is distinct from runtime initialization coupling. Extract shared types only when it improves an actual change.

## Test risks

| Area | Evidence and isolation risk | Suitable test boundary | Changes that warrant selected E2E coverage |
|---|---|---|---|
| Booking creation/rescheduling | `RegularBookingService` reaches availability, credentials, payments, calendars, notifications and webhooks. It accepts injected dependencies but also constructs `EventManager` directly and reads environment settings. | Test orchestration and persistence together; fake external calendar/payment/delivery boundaries and control time/environment. Avoid mocking every internal helper. | Create/reschedule flow, payment handoff, seated-booking selection and displayed meeting details. |
| Cancellation | `handleCancelBooking` imports Prisma, refunds, no-show fees, video/calendar management, email and webhook delivery. Existing scenario tests already use booking fixtures plus provider/payment mocks. | Assert persisted cancellation state and refund/webhook intent, including seated bookings and the last attendee. | Permissions, confirmation dialogs and resulting booking-page state. |
| Booking retrieval | Runtime helper/handler cycle makes an isolated test load both layers or mock across their shared contract. | Exercise handler, helper and query semantics together, including authorization context, statuses, sorting and pagination. | List filtering, pagination or navigation changes. |
| Event editor | `EventTypeWebWrapper` combines tRPC queries/mutations, atoms form/navigation hooks and `revalidateEventTypeEditPage`; `EventAdvancedTab` reads platform context. | Use realistic form/query/platform providers for component tests; test update persistence separately. Mocked action success does not establish cache correctness. | Save a setting, then open the public booking page to detect stale server/client caches. |
| Booking details | `bookings-single-view` combines session, payment state, tRPC mutations, embed support, local storage and `apps/web/lib/clock.ts`. The clock has mutable module state. | Control session, time/timezone and API responses; clear browser storage and shared state. Keep presentation utilities real where practical. | Timezone preference after reload, cancellation/rescheduling links and embed/popup behavior. |
| Auth | `next-auth-options` reaches database repositories, OAuth/calendar integration, rate limiting, encryption and environment settings. Its existing test contains 36 `vi.mock(...)` calls. Verification also has the watchlist runtime cycle. | Integrate credential callbacks, database changes and watchlist decisions; fake identity/mail boundaries and control clock/rate limits. | Session cookies, verification links, login/logout redirects and onboarding routing. |
| Profile settings | `profile-view` coordinates session, profile/email/account mutations, query invalidation and `revalidateSettingsProfile`. | Test validation/persistence plus UI success/error states with realistic query behavior. Isolated rendering needs session/query providers and action/upload/editor substitutes. | Profile persistence after reload; email/account changes that affect session or navigation. |
| Onboarding / shell | Persisted Zustand store uses IndexedDB, a cached connection promise and local-storage fallback. Submission creates default event types, refetches the user, sets welcome flags and redirects. | Reset store/storage/module state. Test submission sequencing, partial failure and storage-adapter behavior. | Resume after reload, completion, stored redirect and correct welcome modal. |
| Prisma / repositories | Prisma initialization reads environment settings and constructs its adapter/client at module load. `BookingRepository` accepts an injected client. | Prefer injected clients for unit tests and a real database for SQL, constraints, filters and extensions. Existing duration tests mock `$queryRaw`, so they do not establish SQL correctness. | Only when persistence changes alter a user journey. |

## Most suspicious modules

Counts are retained dependency-cruiser edges: “value” means not marked `type-only`, not a verified count of executed dependencies. External packages and excluded generated/build files are absent; unresolved edges may inflate the value column. A module can have both value and type edges to the same target.

| Module | Value / type edges | Interpretation |
|---|---:|---|
| `packages/features/bookings/lib/service/RegularBookingService.ts` | 65 / 23 | Largest retained import surface among the active modules examined; partial injection does not remove direct side effects. |
| `apps/web/modules/bookings/views/bookings-single-view.tsx` | 43 / 4 | API/session/browser/payment/embed coordination; 23 historical commits. |
| `packages/features/bookings/lib/handleCancelBooking.ts` | 31 / 6 | Persistence plus multiple external effects. |
| `packages/features/auth/lib/next-auth-options.ts` | 31 / 3 | Existing extensive mocks corroborate isolation overhead. |
| `apps/web/modules/settings/my-account/profile-view.tsx` | 29 / 1 | Account mutations plus cache/session coordination; an unresolved router-types edge needs classification. |
| `apps/web/modules/event-types/components/tabs/advanced/EventAdvancedTab.tsx` | 29 / 9 | Runtime atoms/platform hooks require providers. Prisma and `RouterOutputs` types require fixtures, not runtime mocks. |
| `apps/web/modules/event-types/components/EventTypeWebWrapper.tsx` | 21 / 3 | Mutation success crosses client-cache and server-revalidation boundaries. |
| `packages/features/eventtypes/repositories/eventTypeRepository.ts` | 11 / 5 | Injected Prisma client provides a seam, but related repository dependencies still need consideration. |
| `packages/features/bookings/repositories/BookingRepository.ts` | 3 / 3 | Important historical hotspot with a comparatively narrow import surface and constructor injection; do not equate activity with mocking difficulty. |
| `apps/web/modules/onboarding/hooks/useSubmitPersonalOnboarding.ts` | 5 / 0 | Small retained graph still coordinates mutations, storage, welcome flags and routing. |
| `apps/web/modules/onboarding/store/onboarding-store.ts` | 1 / 0 | External Zustand imports are excluded; persistent browser state is the meaningful risk. |

Within scanned active feature/router sources, excluding test/spec files, `packages/lib/constants.ts` has 56 incoming value edges and `packages/lib/webstorage.ts` has 15. Environment-dependent constants and browser storage can contaminate tests. Pure formatting/error utilities generally should remain real rather than receive blanket mocks.

The territory map's 198 i18n commits mainly indicate editorial coordination. They are not evidence that translation code needs extensive mocking. Likewise, type-only Prisma, tRPC and platform contracts increase fixture/compile-time coupling without introducing runtime side effects.

## What to check next

1. Start with booking creation and cancellation scenario coverage, reusing existing fixtures. Assert database outcomes and external-effect intent rather than internal call choreography.
2. Review auth's 36 mocks: distinguish necessary external substitutions from behavior better exercised through integration tests.
3. Cover selected browser boundaries: event-setting save to public page, timezone preference to reload, onboarding completion to redirect/welcome state, and profile changes to session state.
4. Test raw queries and Prisma extensions against a database; mocked query results cannot prove their semantics.
5. Locate the current workflow implementation and classify unresolved imports before making completeness claims. Historical workflow delivery concerns remain a priority from the territory map.
6. If visualization is later useful, limit it to booking creation/cancellation or event-editor save boundaries, distinguishing runtime imports, injected collaborators, external effects and type contracts. No graph was generated in this session.

## Evidence and limitations

- Local ignored outputs: `dependency-report.active.json`, `dependency-report.web-packages.json`, `dependency-report.loops.json`; extraction helper: `dependency-report.analyze.cjs`. These are session-local evidence and are not versioned with this report. The commands above reproduce the graph, subject to the same checkout and installation.
- Inspected implementations include the modules in the tables, `packages/prisma/index.ts`, `packages/lib/webstorage.ts`, `apps/web/lib/clock.ts`, and onboarding's store, storage adapter and submission hook.
- Existing tests inspected: `packages/features/auth/lib/next-auth-options.test.ts`, `packages/features/bookings/lib/handleCancelBooking/test/handleCancelBooking.test.ts`, and `packages/features/bookings/repositories/BookingRepository.test.ts`.
- Static imports indicate potential coupling, not which branches execute, how many mocks every test requires, or whether a production failure exists. Proposed test boundaries are reasoned recommendations, not measured test results.
- The graph uses one web tsconfig; other applications' aliases may not resolve correctly. Generated files and build output are excluded; 77 unresolved imports prevent a complete architectural verdict.
- The territory map and structural scan reference different commits. Activity counts are historical prioritization signals, not measurements of current runtime dependencies. No broad test-coverage or reliability verdict was attempted.
