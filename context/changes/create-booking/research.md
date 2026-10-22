---
date: 2026-10-21T21:42:28.2431786+02:00
researcher: Codex
git_commit: a9b82799df26c54e200b8e0a236dc3f1238bc6a1
branch: main
repository: cal.diy
topic: "Booking creation: end-to-end flow, test gaps, and blast radius"
tags: [research, bookings, persistence, tests, dependencies]
status: complete
last_updated: 2026-10-21
last_updated_by: Codex
---

# Research: Booking creation flow

## Research question and scope

Analyze the current booking creation process, emphasizing related areas in `context/map/repo-map.md`: booking orchestration, retrieval, event settings, verification/watchlists, persistence, calendars, payments and delivery. Reconstruct the end-to-end path, identify test evidence and gaps, and combine static dependencies with Git co-change evidence. This is a description of the current repository, not an implementation plan.

This report is maintained at `context/changes/create-booking/research.md`; the change identity is `context/changes/create-booking/change.md`.

**Structural verification:** the [claim-by-claim audit](structural-audit.md) inventories the structural assertions below and records confirmed/refined/refuted verdicts with exact source locations. Its [reproducible ast-grep queries](structural-audit.cjs) and [results, including conventional-search cross-checks for every empty query](structural-audit-results.json), distinguish syntax counts from resolved callers and runtime behavior. Prisma/SQL statements are separately labeled as conventional-search evidence. The audit corrects the original source anchors and qualifies absence claims; no application tests were executed.

Three parallel researchers investigated the trace, tests and blast radius. The parent read the map, checked decisive transaction, error-handling, adapter, verification and event-setting evidence, and synthesized their results. Source references below are repository-relative `file:line` anchors at the commit above. No application code was changed. No builds, tests, live provider calls or coverage instrumentation were run.

**Evidence terminology:** **Observed** means source, test assertions or Git patches were inspected. **Inference** means a consequence inferred from those observations, not a reproduced incident. **Unknown** means the available evidence does not establish the claim. Test coverage below means identified assertions in source, not measured execution coverage.

## Feature overview

**Observed.** Booking creation is shared orchestration behind public web and API adapters. Event configuration controls form validation, host selection, availability, limits, email verification, confirmation and payment. The regular service also handles rescheduling and coordinates seats; recurring creation calls it per occurrence. Consequently, a successful-looking response need not represent a newly inserted Booking: an existing valid booking may be returned, a seat may be added to an existing booking, or blocked spam may receive a nonpersisted decoy. See `packages/features/bookings/lib/service/RegularBookingService.ts:523`, `:684`, `:1494`, `:1586`, and `packages/features/bookings/lib/service/RecurringBookingService.ts:74`.

The central persistence operation is a helper using Prisma directly, **not** `BookingRepository.create`. Its transaction can update the old booking during rescheduling and insert the new booking. Calendar operations, payment initiation, email and webhook work cross later boundaries. The normal web success page and API v2 regular adapter independently reload persisted state. Evidence: `packages/features/bookings/lib/handleNewBooking/createBooking.ts:139`, `packages/features/bookings/lib/service/RegularBookingService.ts:1909`, `:2052`, `:2291`, `apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:483`, `packages/features/bookings/lib/getUserBooking.ts:4`.

**Inference.** The principal change risks are state/effect consistency and adapter contract alignment, rather than the insert alone. The current source also reveals a decoy/API mismatch: the shared service can return a UID without a database row, while the API regular adapter requires that row. Runtime behavior under deployed API guards/settings remains unverified.

## End-to-end trace

### Public web request, persistence and return

1. **Entry and form.** `apps/web/app/(booking-page-wrapper)/[user]/[type]/page.tsx:18` loads the public view; `apps/web/modules/users/views/users-type-public-view.tsx:6` imports `BookerWebWrapper`. The wrapper wires booking hooks at `apps/web/modules/bookings/components/BookerWebWrapper.tsx:169`; form submission is in `apps/web/modules/bookings/components/Booker.tsx:248`.
2. **Client adapter.** `packages/platform/atoms/hooks/bookings/useHandleBookEvent.ts:110` includes verification input, then maps form data and invokes the booking handler at `:122`. `apps/web/modules/bookings/hooks/useBookings.ts:137` uses the mutation whose helper posts to `/api/book/event` at `packages/features/bookings/lib/create-booking.ts:13`.
3. **HTTP boundary.** `apps/web/pages/api/book/event.ts:17` checks conditional Turnstile at `:20`, bot detection at `:32`, rate limits at `:37`, and session at `:42`; it supplies WEBAPP creation source at `:46` and calls the regular service at `:50`. `defaultResponder` wraps the handler at `:63`. These are web-adapter checks, not proof that another entry point has identical guards.
4. **Configuration and parsing.** `packages/features/bookings/lib/service/RegularBookingService.ts:2653` delegates to its handler at `:486`. The handler loads event configuration at `:523`, validates reschedule restrictions at `:529`, builds the booking-field schema at `:540` and parses input at `:545`. The event lookup performs `prisma.eventType.findUniqueOrThrow` in `packages/features/bookings/lib/handleNewBooking/getEventTypesFromDB.ts:204`.
5. **Identity and policy gates.** Email blocking runs at `RegularBookingService.ts:581`, spam checking starts at `:601`, active-booking limits apply to fresh bookings at `:603`, and configured booker email verification applies to non-reschedules at `:612`. Confirmation flags and existing-booking reuse are handled at `:668` and `:684`; the existing-booking return is at `:710`.
6. **Scheduling.** Date/bounds validation at `RegularBookingService.ts:764`, host loading at `:791`, limits at `:817`, availability branches at `:902`, `:917`, `:936`, `:962`, and round-robin selection at `:1034` precede persistence. Organizer credentials are loaded at `:1159` and team event information is assembled at `:1352`.
7. **Early success branches.** The spam result is awaited at `RegularBookingService.ts:1494`. A blocked result returns an accepted-looking decoy at `:1506`, with `id: 0` at `:1507`, before the insert. Seats enter `handleSeats` at `:1586`; an existing-seat result can return at `:1634`.
8. **Database write.** The non-dry-run fresh/replacement branch calls `createBooking` at `RegularBookingService.ts:1707`. `packages/features/bookings/lib/handleNewBooking/createBooking.ts:76` builds the data; status and attendees are mapped at `:192` and `:198`. The transaction at `:139` updates the original rescheduled booking at `:141` and creates the booking at `:144`. The projection includes attendees/payment/references at `:115`. The surrounding service maps a wrapped P2002 cause to HTTP 409 at `RegularBookingService.ts:1821`.
9. **External effects after insertion.** Credentials refresh at `RegularBookingService.ts:1831`; provider reschedule executes at `:1909`, or eligible new calendar/conference creation at `:2052`. Branch-specific email/SMS calls appear at `:2031`, `:2153`, `:2197`. Internal booking events fire at `:2217`.
10. **Paid versus remaining completion.** When the payment predicate at `RegularBookingService.ts:2183` holds, payment initiation at `:2291` leads to the payment-required response at `:2343`. On the later non-payment-return path, confirmed-booking webhook scheduling uses `Promise.allSettled` at `:2417`, followed by the creation/reschedule webhook at `:2433`. These are conditional paths, not effects guaranteed for every create request.
11. **Follow-up persistence and response.** The later update writes location, metadata and integration references at `RegularBookingService.ts:2446`; its catch logs and continues at `:2461`. Pending-booking webhook queuing follows at `:2466`, no-show scheduling at `:2496`, and analytics at `:2516`. The normal response at `:2562` includes booking/seat/video/previous-booking information, with organizer email nulled at `:2557`.
12. **Client routing and readback.** The web hook stores decoy data and navigates to `/booking-successful/{uid}` at `apps/web/modules/bookings/hooks/useBookings.ts:178`. Payment redirection is at `:239`; normal success redirection at `:267` uses `packages/features/bookings/lib/bookingSuccessRedirect.ts:246`. The normal `/booking/[uid]` page loads server props at `apps/web/app/(booking-page-wrapper)/booking/[uid]/page.tsx:41`, through `apps/web/modules/bookings/views/bookings-single-view.getServerSideProps.tsx:69`, `packages/features/bookings/lib/getBookingInfo.ts:6`, and Prisma `findUnique` in `packages/features/bookings/lib/getUserBooking.ts:4`. The decoy route instead uses client-held data: `apps/web/app/(booking-page-wrapper)/booking-successful/[uid]/page.tsx:13`.

### API v2 and alternate paths

**API v2.** `apps/api/v2/src/platform/bookings/2024-08-13/controllers/bookings.controller.ts:105` declares POST; `:149` handles input and `:155` delegates. Its service resolves the event at `services/bookings.service.ts:112`, checks authentication requirements at `:125`, parent managed-event restrictions at `:127`, team hosts at `:133` and required responses at `:142`. Dispatch selects recurring+seated, recurring, seated or regular at `:144`–`:154`. The regular adapter constructs shared input at `:464`, calls `RegularBookingService` at `:465`, reloads by UID at `:483`, throws if absent at `:485`, and formats output at `:488`. The read repository uses `dbRead.prisma.booking.findUnique` at `repositories/bookings.repository.ts:150`. A deployed read replica or its consistency guarantees were not established.

**Seats.** `packages/features/bookings/lib/handleSeats/handleSeats.ts:43` looks up an existing seated booking and adds a seat at `:100`. `packages/features/bookings/lib/handleSeats/create/createNewSeat.ts:44` starts the transactional seat-addition path with locking. Existing booking reuse differs from first-seat creation, which continues through the regular insert and seat handling at `RegularBookingService.ts:1777`.

**Rescheduling.** The old-row update and replacement insert share the helper transaction, while provider deletion/rescheduling occurs afterwards at `RegularBookingService.ts:1898` and `:1909`. Existing payment can be reconnected at `createBooking.ts:125`. Cancellation/refund behavior is an adjacent lifecycle contract, not re-traced here as an independent feature.

**Recurrence.** `apps/web/pages/api/book/recurring-event.ts:47` calls the recurring service. There are exactly two regular-creation call expressions in `packages/features/bookings/lib/service/RecurringBookingService.ts`: `:63` creates the special first round-robin occurrence; `:106` starts each loop occurrence and `:115` awaits its promise. The loop at `:74` starts at index 1 for round-robin and 0 otherwise. Only loop results are appended at `:117`; the first round-robin result supplies lucky users but is not appended to the returned array. Both create and reschedule methods delegate to this handler (`:153`, `:169`). **Inference:** per-occurrence persistence creates a partial-series consistency boundary if a later call fails. Series-wide compensation and runtime consequences of the returned-array asymmetry were not established.

**Other callers and entry methods.** Web and API v2 are examples, not an exhaustive caller list. `packages/features/calendar-subscription/lib/sync/CalendarSyncService.ts:212` also calls regular creation for rescheduling; older API v2 adapters call it at `apps/api/v2/src/platform/bookings/2024-04-15/controllers/bookings.controller.ts:210`. The regular class has three delegations to its common handler: create at `RegularBookingService.ts:2654`, reschedule at `:2664`, and the deprecated API v1 entry at `:2681`. Repository-wide same-name expression counts include unrelated methods and test helpers; they are not resolved service caller counts.

### Sequence diagram

This diagram condenses the regular web path; alternate callers and early returns are labeled. It does not imply a transaction across providers or a direct browser-to-database connection.

```mermaid
sequenceDiagram
    participant U as Public Booker
    participant W as Web HTTP adapter
    participant A as API v2 adapter
    participant S as RegularBookingService
    participant D as Prisma / PostgreSQL
    participant X as Calendar, mail, payment, webhooks
    participant P as Server booking page
    U->>W: Mapped booking form
    W->>W: Bot, rate and session checks
    W->>S: createBooking
    Note over A,S: API v2 separately adapts DTOs and calls this service
    S->>D: Load event settings, hosts and existing bookings
    S->>S: Validate schema, identity, limits, availability
    alt Existing valid attendee booking
        S-->>W: Existing booking result
    else Spam blocked
        S-->>W: Decoy ACCEPTED, id=0, no inserted row
        W-->>U: Client-held decoy success page
        Note over A,D: API regular adapter reloads UID; absent row throws
    else Existing seated booking
        S->>D: Transactional seat addition
        S-->>W: Seat result
    else Fresh or replacement booking
        S->>D: Transaction: update old if rescheduling, create new
        D-->>S: Persisted booking projection
        S->>X: Conditional calendar and message effects
        alt Payment required
            S->>X: Initiate payment
            S-->>W: Payment-required response
            W-->>U: Payment redirect
        else Later completion path
            S->>X: Conditional webhooks and scheduled triggers
            S->>D: Update references, location and metadata
            Note over S,D: Update failure is logged; processing continues
            S-->>W: Booking result
            W-->>U: Normal success redirect
            U->>P: Load /booking/uid
            P->>D: getBookingInfo / getUserBooking
            D-->>P: Persisted booking
            P-->>U: Booking view
        end
    end
    Note over A,D: API regular success rereads persisted UID and formats its output DTO
```

## Related areas from the repository map

**Host listing is a separate retrieval path.** `packages/trpc/server/routers/viewer/bookings/get.handler.ts:61` calls the feature helper; `packages/features/bookings/lib/getAllUserBookings.ts:6` imports the handler's `getBookings`, called at `:47`. The exported query begins at `get.handler.ts:93`, builds accessibility unions at `:169`, executes Kysely SQL at `:440`, hydrates results at `:455`, and uses additional Prisma reads at `:907`. This confirms a value-import cycle, not recursive invocation of the same function. API listing also consumes the helper at `apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:650`.

**Event settings govern creation but editor success does not prove public-cache visibility.** The editor updates through tRPC at `apps/web/modules/event-types/components/EventTypeWebWrapper.tsx:127`, resets form state at `:138`, requests revalidation at `:139`, and invalidates editor queries at `:147`. The server action calls `revalidatePath('/event-types/' + id)` at `apps/web/app/(use-page-wrapper)/event-types/[type]/actions.ts:6`. The team-slug conditional at wrapper `:140` contains a stale-cache comment but no action. Creation reads event configuration from the database (`getEventTypesFromDB.ts:204`). **Unknown:** public page cache visibility after an edit; the inspected revalidation alone is neither proof of correctness nor proof of a stale-page defect.

**Verification and watchlists are distinct gates.** The creation helper at `packages/features/bookings/lib/handleNewBooking/checkIfBookerEmailIsBlocked.ts:20` considers environment-blocked emails, at `:28` looks up verified user/secondary email policy, and at `:57` exempts rescheduling from the user-setting portion of that check. Configured event email verification is separate (`RegularBookingService.ts:612`). `packages/features/auth/lib/verifyCodeUnAuthenticated.ts:12` rate-limits verification and `:23` checks the token, throwing when invalid. Creation uses `SpamCheckService`, not a direct call to `verifyEmail`.

The map's verification/watchlist import concern remains relevant indirectly: `packages/features/di/watchlist/containers/SpamCheckService.container.ts:5` imports the watchlist composition module; `packages/features/di/watchlist/containers/watchlist.ts:16` imports administrative operations, whose `packages/features/watchlist/lib/service/AdminWatchlistOperationsService.ts:1` imports `verifyEmail`; `packages/features/auth/lib/verifyEmail.ts:10` imports the blocking controller, which imports that container at `packages/features/watchlist/operations/check-if-email-in-watchlist.controller.ts:1`. **Inference:** this couples creation's blocking service to broader module initialization. It does not show administrative operations being executed during booking.

**Paid completion and workflows must not be conflated.** `packages/app-store/_utils/payments/handlePaymentSuccess.ts:115` updates payment/booking transactionally; `:160` dispatches BOOKING_PAID webhooks. The current booking-event handler's task list is private-link usage at `packages/features/bookings/lib/onBookingEvents/BookingEventHandlerService.ts:44`. Historical workflow fixes do not establish active workflow dispatch in these current hooks. Alternative workflow consumers and their delivery guarantees remain outside the verified path.

## Test coverage and gaps

The following inventory records representative branch assertions along the inspected path. It is not an exhaustive branch-coverage report. Paths abbreviated within a row retain the directory stated in that row.

| Area / production seam | Identified test evidence | What it does not establish |
| --- | --- | --- |
| Public booking and readback | `apps/web/playwright/booking-pages.e2e.ts:106` books a slot; `:124` asserts success, followed by duplicate behavior; reschedule `:148`, cancel/rebook `:193`, confirmation `:246` | Current pass status or live integration behavior across providers |
| API v2 regular/recurring DTOs | `apps/api/v2/src/platform/bookings/2024-08-13/controllers/e2e/user-bookings.e2e-spec.ts:216` metadata validation; `:345` POST, `:371` HTTP 201, `:381` output fields; recurrence `:441`, retrieval after reschedule `:1463` | Real authorization enforcement: PermissionsGuard is overridden at `:87`. One attendee-address variant uses `xit` at `:2269`; another remains active at `:2233` |
| Regular orchestration | `packages/features/bookings/lib/handleNewBooking/test/fresh-booking.test.ts:213` service invocation, `:232` stored booking expectation, `:254` meeting URL; confirmation `:2294`, paid `:2937`, duplicate reuse `:3502`, `:3560`, blocked users `:3622` | Header `:3` describes Prismock/mocked fetch/apps: these assertions do not prove PostgreSQL constraints or live delivery |
| Availability, limits, bypasses | `packages/features/bookings/lib/handleNewBooking/test/booking-flags.test.ts:28`, `:123`, `:211`, `:302`; `booking-validations.test.ts:214`, `:307`, `:407`; `packages/features/bookings/lib/conflictChecker/checkForConflicts.test.ts:17`, `:36`, `:67`, `:154` cover seat exceptions, empty periods, overlaps and boundaries | Concurrent ordinary non-seat inserts, actual provider busy-time/cache consistency; no targeted assertion for the P2002 conversion at `RegularBookingService.ts:1821` was identified in the bounded test search |
| Booker verification policy | `packages/features/bookings/lib/handleNewBooking/test/booking-validations.test.ts:529`, `:598`, `:672`, `:753`, `:823`, `:1006`, `:1187`: blocked/unverified, authenticated, valid code, secondary email, guests, plus addressing, invalid code | Verification is mocked at `:28`; token delivery and external verification behavior are not established |
| Seat operations | `packages/features/bookings/lib/handleSeats/test/handleSeats.test.ts:390`, `:642`, `:751`, `:873`, `:1052`, `:1726`, `:2318`, `:2525`: add, duplicate, full, attendee/seat count, move, final attendee, merge, capacity | Mocked scenarios alone do not prove lock semantics |
| Seat concurrency | `packages/features/bookings/lib/handleSeats/create/createNewSeat.integration-test.ts:64` races for the final seat; `:166`, `:242`, `:340`, `:403` cover enough/full/zero/unlimited capacity; real Prisma import `:3`, actual helper `:7` | Source depends on seeded DB at `:33`; pass status unknown. This is evidence for seat addition, not every regular create race |
| Recurrence | `packages/features/bookings/lib/service/RecurringBookingService.test.ts:43` recurrence scenario; API tests above | No partial-series failure/rollback assertion identified in this service test or inspected fresh/reschedule scenarios, despite per-occurrence awaits at `RecurringBookingService.ts:115` |
| Payment initiation | `packages/features/bookings/lib/handlePayment.test.ts:89`, `:104`, `:119`, `:149`, `:179`, `:212`, `:259`: dry-run and add-on variants; mocked Stripe webhook in `fresh-booking.test.ts:3057` | External provider retry/delivery, or atomic completion across provider and database |
| Post-booking tasks | `packages/features/bookings/lib/handleNewBooking/test/post-booking-handling.test.ts:76`, `:172`, `:284`, `:367` cover private-link updates/error tolerance; `packages/features/bookings/lib/handleNewBooking/scheduleNoShowTriggers.integration-test.ts:96`, `:127`, `:199` cover task/payload/handler | A complete booking-to-workflow-to-provider delivery proof |
| Repository reads and host list | `packages/features/bookings/repositories/BookingRepository.test.ts:21`–`:58` test duration totals/null/reschedule input using mocked raw queries. `packages/trpc/server/routers/viewer/bookings/get.handler.test.ts:41`, `:159`, `:184`, `:207`, `:243`, `:260` cover delegation, access/filter/query shape | Helper and Kysely mocked at handler test `:8`/`:9`; actual SQL result semantics and unmocked cycle initialization are not established. Direct repository tests do not exercise detail lookup at `BookingRepository.ts:635` or original-reschedule lookup at `:1170` |

### Spam and adapter coverage

The currently tracked `packages/features/bookings/lib/handleNewBooking/test/spam-booking.integration-test.ts:57` asserts decoy shape; the database-absence helper begins at `:64` and asserts at `:74`. Email/domain cases are at `:82` and `:226`. The case at `:158` checks that availability failure can precede the decoy response, consistent with the service awaiting spam after availability work. AST and text searches found no decoy/short-circuit/spam/watchlist markers in the 2024-08-13 API controller E2E files or `apps/web/modules/bookings/components/Booker.test.tsx`. This is bounded evidence of a gap in explicit assertions, not proof that no adapter test indirectly exercises the behavior.

**The apparent fail-open test is weaker than its name suggests.** At `spam-booking.integration-test.ts:361` it obtains an instance and spies on that instance's `isBlocked` at `:365`. However, `packages/features/bookings/lib/handleNewBooking/test/getNewBookingHandler.ts:4` delegates to the regular service, which obtains another instance at `RegularBookingService.ts:594`; `packages/features/di/watchlist/containers/SpamCheckService.container.ts:10` constructs a new instance per call. No factory/singleton override was identified in this test, its helper, booking scenario/setup/fixtures or global Vitest setup. The assertions at `spam-booking.integration-test.ts:374` check accepted/nonzero booking output but do not assert that the rejection spy ran. **Inference:** the injected failure targets an unused instance, so ordinary successful creation can satisfy the intended fail-open test. The exception branch has intended, but defective, coverage evidence; runtime execution remains unmeasured.

### Runner and historical boundaries

`vitest.config.mts:32` explicitly selects `*.integration-test.ts` in integration mode; the default pattern at `:39` does not select that naming pattern. API v2 specs are excluded at `:45` and have separate Jest commands in `apps/api/v2/package.json:29`. Browser coverage uses Playwright. A default root unit run therefore cannot establish the seat-race, spam integration and API v2 E2E outcomes described here.

The historical deletion commits `c2c95b371a` (#29019), `6a2b84ab02` (#29020) and `84815a9d2f` (#29021) are not a current coverage inventory. The spam integration test exists in this HEAD (verified against the Git object), whereas the named `getLuckyUser.integration-test.ts` and `BookingRepository.integration-test.ts` are absent from the tracked inventory. This qualifies the map's historical warning individually rather than treating it as proof that integration testing disappeared.

## Blast radius: contracts that move together

“Move together” below means conditional consistency obligations when that contract changes, not a requirement to edit every listed file for every booking change.

| Changed contract | Current static evidence | Coordinated surface |
| --- | --- | --- |
| Booking input / validation | `packages/features/bookings/lib/getBookingDataSchema.ts:3`, `lib/dto/types.d.ts:10`; public hook and API input adapter in the trace | Form mapping, extended input schema, regular/recurring DTOs, web/API adapters, validation tests |
| Shared result | `packages/features/bookings/lib/dto/types.d.ts:48` derives result from the concrete regular service; API rereads at `apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:483` | Early-return semantics, web redirects/store, API output projection and adapter tests; a UID alone does not guarantee persistence for the decoy branch |
| API bridge / dependency injection | `packages/platform/libraries/bookings.ts:10` exports the shared class; `apps/api/v2/src/lib/services/regular-booking.service.ts:18` extends it and supplies dependencies at `:30` | Shared service, platform bridge, Nest wrapper and injected dependencies; historical `ee/bookings` paths map to present `platform/bookings` |
| Stored booking data | `packages/prisma/schema.prisma:801` BookingReference, `:826` Attendee, `:851` Booking, `:1095` Payment, `:1330` BookingSeat, `:1527` BookingDenormalized; creation helper transaction `:139` | Schema, authored SQL migrations, nested writes/selects, fixtures, payment/seat relations and read projections |
| Generated data contracts | Prisma generators at `packages/prisma/schema.prisma:10`, `:19`, `:32`, `:38`; generation command in `packages/prisma/package.json:20` | Derived Prisma client, Zod schemas, Kysely types and enums must agree with authored schema. Generated output is not a separate manually maintained model |
| Database-side projection | `packages/prisma/migrations/20250502130843_setup_triggers_for_booking_denormalized/migration.sql:10` refresh function; booking triggers `:102`/`:107`, EventType triggers `:148`, User trigger `:181` | Booking/EventType/User changes may affect listing data without a TypeScript import. Later migration overrides and deployed trigger state were not exhaustively reconstructed |
| Host listing and details | Feature↔tRPC value cycle in the retrieval section; separate success-page and API projections | Kysely queries, denormalized model, Prisma hydration, authorization/filter tests and API output types |
| Calendar / messages / payment | `RegularBookingService.ts:1835` constructs EventManager, `:2052` creates events, `:2291` initiates payment; payment completion at `handlePaymentSuccess.ts:115` | Provider payloads/references, email fields, completion entry point, booking/payment state and integration tests |
| Public webhook shape | `packages/features/webhooks/lib/sendPayload.ts:81` omits `assignmentReason` from CalendarEvent and explicitly redeclares its public shape at `:99` | Serializer and payload producers across creation, confirmation, cancellation, seats and payment; domain event shape is not automatically a public API contract |
| Event settings | Wrapper mutation/cache actions and direct creation lookup described above | Editor/atoms, tRPC persistence, event projections and public-booking expectations. User-visible copy also couples to authored English translations |

### Static graph combined with Git co-change

**Method.** Reused `context/map/artifact-2-structure.md` as a bounded import-graph snapshot and verified decisive current edges directly. No full dependency graph was regenerated. For fresh historical examples, inspected the latest 35 commits touching `RegularBookingService` with author/co-author metadata, excluded identifiable agent/bot contributions and mechanical changes, then inspected substantive human-attributed patches. This is a purposive sample, not a co-change frequency ranking; absence of an identifiable agent credit does not prove no AI assistance.

- **Calendar fallback + orchestration tests:** `617cdea68358f09434ac9f52c8bef00f41e0b167` (#27630, Anik) changes `RegularBookingService.ts` together with `handleNewBooking/test/fresh-booking.test.ts` for Google Meet/default-calendar fallback. The current EventManager edge at `RegularBookingService.ts:1835` independently establishes the calendar seam. **Inference:** tests asserting generated meeting behavior are part of a provider-selection change's practical impact.
- **Privacy setting across reschedule/calendar/mail:** `851aa30829c8938be8bec211645bb8c7a3c4041c` (#25945, Rajiv) changes the regular service, `packages/features/calendars/lib/CalendarManager.ts`, `packages/emails/email-manager.ts`, and authored English copy for `hideCalendarNotes`. No test file appears in that patch. The service's reschedule effect at `RegularBookingService.ts:1909` grounds the runtime seam. **Inference:** changing event description/privacy timing can cross calendar and message contracts despite a locally small service edit.
- **Reschedule policy across model and adapters:** `b46fb82695ae58ec83985319de133b81cf062596` (#25575, sean-brydon) adds `EventType.minimumRescheduleNotice` through schema/SQL migration, read projections, helper/service, web/atoms, tRPC and reschedule tests. The current gate at `RegularBookingService.ts:435` and event-setting projection connect that historical pattern to present behavior. Its broad substantive patch is an illustrative contract change, not a low-breadth ranking datum.

The map's aggregate counts remain **inherited historical context**, not a newly compliant activity analysis: its territory method retained identifiable AI authors and its raw bookings/tRPC pair differs from the surviving-file-adjusted map. No inherited count is used here as a probability of breakage or as a fresh ranking. Existing graph coverage is also limited by the web tsconfig, unresolved imports, excluded generated artifacts, absent SQL/provider internals, and incomplete API v2/workflow coverage (`context/map/repo-map.md`, Limitations; `context/map/artifact-2-structure.md`).

Separate historical contract evidence: `4585d7402d70a371f6d417fe22cbd4a7291bc7bb` (#26044) changed paid completion, confirmation, selected booking fields and tests; `3a7122d613b00a1d425ce2d61ff09f3238801a34` (#27891) adjusted assignment-reason webhook payload producers/serialization. These agent-coauthored patches were excluded from the fresh human-attributed sample above. Their diffs explain past contract coordination, not current workflow execution or incident rates.

## Technical debt

1. **Persistence and external effects have different success boundaries.** **Observed:** the creation transaction ends in `createBooking.ts:139`; later provider work runs at `RegularBookingService.ts:2052`, and the reference update catches errors at `:2461`. Requested-webhook errors are caught at `:2478`; booking-event errors at `:2648`; private-link failures at `BookingEventHandlerService.ts:63`. **Inference:** successful booking responses can coexist with incomplete follow-up state, and errors can occur after insertion. **Unknown:** operational retries, reconciliation and incident frequency; no blanket claim that effects lack recovery.
2. **Decoy success is not a uniform adapter contract.** **Observed:** nonpersisted `id: 0` result at `RegularBookingService.ts:1506`, explicit web decoy route at `useBookings.ts:178`, mandatory API row reload at API `bookings.service.ts:483`. **Inference:** a blocked request reaching the API regular path fails the reload rather than returning the web decoy experience. **Unknown:** deployed reachability and API exception mapping; no runtime reproduction was performed.
3. **The common booking interface weakens type enforcement.** **Observed:** `packages/features/bookings/lib/interfaces/IBookingService.ts:4` declares argument and result `any` for create/reschedule; the comment explains that regular and recurring signatures differ. Result types are derived from the concrete implementation at `lib/dto/types.d.ts:48`. **Inference:** method presence is enforced, but compatible input/result semantics depend on concrete consumers and adapter tests.
4. **Dependency isolation is partial and persistence is fragmented.** **Observed:** the service has injected dependencies but has two direct EventManager constructions (`RegularBookingService.ts:1835`, `:1869`, the latter for original-host cleanup) and calls the singleton-backed creation helper; reads use separate Prisma/Kysely projections. The helper uses `include` at `createBooking.ts:104`, contrary to the repository's preferred `select` convention. **Inference:** changing BookingRepository or injecting its mock alone cannot describe or isolate the full create/read flow. This is not evidence of credential exposure.
5. **Retrieval imports invert the layer boundary.** **Observed:** `getAllUserBookings.ts:6` and `get.handler.ts:2` form a value-import cycle. **Inference:** listing changes couple feature/API consumers to tRPC module loading and complicate isolated testing. The map's type-only DTO/service loops are a different issue and do not prove runtime cycles or failures.
6. **Recurrence has a broader consistency question than a single booking.** **Observed:** per-occurrence awaits at `RecurringBookingService.ts:63` and `:115`; no partial-series rollback assertion identified in the inspected tests. **Inference:** a later failure can leave earlier committed occurrences unless another mechanism compensates. **Unknown:** complete series compensation behavior.
7. **Test confidence is fragmented across runners and mocks.** **Observed:** root unit patterns omit integration-test names and API v2 specs; raw-query and handler tests mock SQL/delegation. Seat-concurrency integration tests exist, while targeted P2002 and adapter-decoy assertions were not identified in the bounded search. **Inference:** a green unit run alone offers narrower assurance than the feature's runtime boundaries require. No numeric coverage claim is made.
8. **Spam-check failure is an explicit fail-open policy.** **Observed:** `packages/features/watchlist/lib/service/SpamCheckService.ts:23` catches a failed check, logs it, and returns `isBlocked: false`. **Inference:** the availability of the blocking backend and the enforcement of blocking policy are coupled; a backend failure permits the checked request to proceed past this gate. This describes current behavior, not an assertion that fail-open is an unintended product decision.
9. **A failure-injection test spies on the wrong instance.** **Observed:** the spam test's instance spy at `spam-booking.integration-test.ts:365` is separate from the fresh instance created inside `RegularBookingService.ts:594`, with no identified override joining them. **Inference:** its success assertions can pass without exercising fail-open handling, creating false confidence in that branch. See the explicit factory/helper evidence in the spam coverage section.
10. **Prisma queries violate repo convention by using `include` instead of `select`.** **Observed:** `packages/features/bookings/lib/handleNewBooking/createBooking.ts:104` and `apps/api/v2/src/platform/bookings/2024-08-13/repositories/bookings.repository.ts:154` both query Prisma via `include` (`include: { attendees: true, user: true, eventType: true }`). **Inference:** this conflicts directly with Cal.diy's established performance and security rule (*"Use select instead of include in Prisma queries"*), creating unnecessary overfetching and risk of leaking sensitive user fields into memory before filtering.
11. **Inconsistent error classes across service boundaries.** **Observed:** `packages/features/bookings/lib/handleNewBooking/getEventTypesFromDB.ts:212` and `apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:480` throw generic JavaScript `new Error()`; `packages/features/bookings/lib/handleSeats/create/createNewSeat.ts:64` throws `new HttpError()`. **Inference:** non-tRPC services and repositories do not uniformly follow the repository requirement to throw `ErrorWithCode`, complicating unified error code propagation and HTTP response translation.
12. **Type safety circumvention in API regular booking adapter.** **Observed:** `apps/api/v2/src/lib/services/regular-booking.service.ts:32` injects Prisma via `prismaClient: prismaWriteService.prisma as unknown as PrismaClient`. **Inference:** double type assertion (`as unknown as ...`) circumvents TypeScript's type checker, conflicting with Cal.diy's rule against unsafe type casting.

### Recommended action items for implementation planning (`10x-plan`)

1. **Correct the spam fail-open integration test:** Update `spam-booking.integration-test.ts` to mock the container helper `@calcom/features/di/watchlist/containers/SpamCheckService.container` using `vi.mock()` (similar to `buildDryRunBooking.test.ts:22`) or inject a mock factory, and add an explicit `expect(isBlockedSpy).toHaveBeenCalled()` assertion.
2. **Harmonize API v2 decoy contract with Web:** In `apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:483`, detect short-circuited/decoy bookings (e.g. `booking.id === 0` or `isShortCircuitedBooking`) prior to database reload and return an accepted output DTO without throwing a 404/500 error.
3. **Refactor Prisma queries to `select` projections:** Replace `include` in `createBooking.ts:104` and `bookings.repository.ts:154` with explicit `select` shapes, eliminating overfetching and aligning with repository guidelines.
4. **Fix Recurring Booking round-robin return array:** In `RecurringBookingService.ts:63`–`:117`, ensure the initial round-robin booking (`firstBookingResult`) is included in the returned `createdBookings` array rather than being omitted.
5. **Type `IBookingService` with generics:** Replace `(...args: any[]) => Promise<any>` in `IBookingService.ts` with parameter and return generics to restore type safety across `RegularBookingService` and `RecurringBookingService`.
6. **Standardize on `ErrorWithCode`:** Replace `throw new Error(...)` and `throw new HttpError(...)` in domain and persistence services with typed `ErrorWithCode`.

## Historical context and related research

The earlier change identity is `context/changes/create-booking/change.md`; no prior implementation plan or research for this topic was present in the inspected changes/archive inventory. The broader baseline is `context/map/repo-map.md`, with `artifact-1-territory.md`, `artifact-2-structure.md`, and `artifact-3-contributors.md` as its sources. Their historical snapshots are not this report's HEAD, so current source checks take precedence for behavior and test presence. No production telemetry or external discussion was consulted.

## Unknowns and limits

- Runtime pass/fail results, executed branch coverage, real database/provider latency and deployment-specific flags are unknown; the requested analysis was static.
- Existing-booking reuse is not proof of comprehensive idempotency. Regular non-seat concurrency and retry behavior were not established by the seat-addition test.
- Actual DB read-replica topology, all migration overrides and deployed triggers were not reconstructed.
- Public cache visibility after event edits and full downstream workflow/provider delivery were not verified.
- Test-absence statements are bounded to the query scopes recorded in the structural audit. P2002 searches found production comparisons but no named test assertion; tests could assert an error without spelling P2002. Failure-mocking searches and text review found no partial-series compensation scenario in the three named recurrence/fresh/reschedule tests, but do not exhaust all failure mechanisms. A spam factory mock exists in the unrelated `buildDryRunBooking.test.ts:22`; no connecting override was identified in the spam integration test or its shared setup. None of these searches proves a branch can never be exercised indirectly.
- Static imports show dependency/load relationships; Git co-change shows historically coordinated edits. Neither establishes production incidents, causation or an obligatory edit list for an unspecified future change.

## Verification of this artifact

The original report was synthesized after three research tracks. The subsequent structural audit ran ast-grep against the current source, cross-checked every empty query with rg, and corrected language-selection and query-form false negatives before interpreting the results. The audit artifacts contain the claim inventory, verdicts, exact file/line evidence, query scopes and raw matches. No application tests, type checks, builds or E2E suites were run for this documentation-only revision.
