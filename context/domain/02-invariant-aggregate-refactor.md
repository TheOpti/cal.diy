---
title: Enforce booking-window admission through a Booking aggregate
created: 2026-10-24
type: refactor-plan
---

# Enforce booking-window admission through a Booking aggregate

## Outcome and scope

**Chosen invariant:** an appointment start may be admitted for creation or movement only after the server establishes that it satisfies the applicable event type's booking window and minimum notice. An unavailable or failed evaluation must stop the operation. For `ROLLING_WINDOW`, a date beyond the computed window must not become bookable merely because a request bypassed the slot picker.

This is a refactoring plan, not an implementation. Existing paths and line references were inspected at repository HEAD `856cbf7eee15d34cfeb7f9ce8ae314a220bce913`. Names and signatures labelled **proposed** do not exist merely because they appear here. No production code, schema, dependencies or tests were modified or executed for this plan.

The work follows discovery → identification → classification → diagnosis → design. It builds on `context/domain/01-domain-distillation.md`, but reselects the invariant after deeper source inspection. That inspection found an explicit rolling-window bypass, making booking-window admission a stronger first target than the earlier cancellation recommendation.

## 0. Context discovered

### Product intent and requirements

The README calls the product a “scheduling platform” (`README.md:16`) and says it is “designed for individuals and self-hosters who want full control over their scheduling infrastructure” (`README.md:43`). Those goals make control over admissible appointment times core, irrespective of enterprise features retained in the repository. The README excludes teams, organizations and workflows (`README.md:47`); their presence in code is not evidence that they should define this plan's priority.

Filename discovery in the root, `context/foundation/`, `docs/` and `specs/` found no product-wide `prd.md`, `tech-stack.md` or quantified success criteria. `context/foundation/README.md` is a document convention, not a requirements specification. Requirements therefore come from README intent, the existing cancellation feature specification, UI wording, source comments and executable rules. This source mix is a limitation: code-derived rules are identified as such rather than presented as approved PRD requirements.

Relevant requirement evidence:

- “Limit how far in the future this event can be booked.” — `packages/i18n/locales/en/common.json:2257`.
- “Automatically moves the {{x}}-day booking window forward each day, ensuring your calendar always shows the next {{x}} days of available slots.” — `packages/i18n/locales/en/common.json:3308`.
- “But for the booking that happen through API, we absolutely need to check the ROLLING_WINDOW limits.” — `packages/lib/isOutOfBounds.tsx:41`.
- “It ensures that the time isn't in the past and also checks if the time is within the minimum booking notice.” — `packages/lib/isOutOfBounds.tsx:240`.
- Cancellation requirements remain a comparator: “Platform users: Should respect the setting” — `specs/cancellation-reason-requirement/design.md:70`. Its decision log selects a dedicated enum/column (`specs/cancellation-reason-requirement/decisions.md:16`); it does not settle exemptions.
- Calendar sync promises “Guarantees updates through webhook event delivery” — `packages/features/calendar-subscription/README.md:14`. That is a separate convergence obligation, not the chosen synchronous admission invariant.

### Stack and rule locations

| Layer | Verified stack / role |
|---|---|
| UI | Next.js `16.2.3`, React `18.2.0` (`apps/web/package.json:110`, `:123`); event settings and Booker components. |
| API | tRPC slot queries under `packages/trpc/server/routers/viewer/slots/`; Next.js booking route at `apps/web/pages/api/book/event.ts:50`; NestJS API v2 (`apps/api/v2/package.json:55`). |
| Application | Shared `RegularBookingService` (`packages/features/bookings/lib/service/RegularBookingService.ts:2653`), called by web and inherited by API v2 (`apps/api/v2/src/lib/services/regular-booking.service.ts:18`). |
| Domain-like helpers | Window math in `packages/lib/isOutOfBounds.tsx:26`; command validation in `packages/features/bookings/lib/handleNewBooking/validateBookingTimeIsNotOutOfBounds.ts:24`. There is no aggregate guarding time admission today. |
| Persistence | PostgreSQL (`packages/prisma/schema.prisma:5`), Prisma, policy in `EventType` (`:196`, `:219`), appointments in `Booking` (`:851`); direct transaction helper at `packages/features/bookings/lib/handleNewBooking/createBooking.ts:139`. |
| Verification | Yarn (`package.json:234`), Vitest (`package.json:122`), Playwright (`package.json:97`), Biome (`package.json:92`). `agents/commands.md:73` and `:81` document unit/integration runners. No repository-wide mandatory test-first policy was established; this plan explicitly uses test-first phases. |

## 1–2. Invariant inventory, classification and choice

Spread counts below are **minimum observed distinct files**, not exhaustive repository counts. Layers are counted by responsibility, even where two responsibilities share a package. “Enforced” is scoped to the path inspected, not a guarantee across all callers.

| ID | Rule and source quote | Core value against product goals | Observed spread | Enforcement assessment |
|---|---|---|---|---|
| I1 | Admit appointment starts only within booking-window/notice rules; “absolutely need to check the ROLLING_WINDOW limits” (`packages/lib/isOutOfBounds.tsx:41`). | **Highest:** host control over appointment times is intrinsic to self-hosted scheduling (`README.md:43`). | **At least 10 files / 5 layers:** settings UI, Booker, slot API, shared service, validator, time helper, policy query, schema, create helper, web route; detailed ledger below. | **Violable:** slot listing filters it, command helper explicitly skips rolling-window evaluation; unexpected evaluator errors also continue. |
| I2 | A configured mandatory cancellation reason must be supplied by the relevant actor; “Platform users: Should respect the setting” (`specs/cancellation-reason-requirement/design.md:70`). | **High:** accountability, explicitly requested at `design.md:9` in that specification. | **At least 5 files / 4 layers:** spec, `cancellationReason.ts:7`, `handleCancelBooking.ts:161`, `CancelBooking.tsx:167`, schema `:287` (full paths in the domain map). | **Inconsistent:** actor mapping exists, platform/report exemptions remain. Whether some exemptions are intentional needs an owner decision. |
| I3 | Concurrent seat additions must not exceed capacity; “concurrent requests could exceed the seat limit” (`packages/features/bookings/lib/handleSeats/create/createNewSeat.ts:39`). | **Highest:** booking capacity is core scheduling correctness. | **At least 3 files / 3 responsibilities:** create helper `:47`, schema `BookingSeat` at `packages/prisma/schema.prisma:1330`, concurrency test at `packages/features/bookings/lib/handleSeats/create/createNewSeat.integration-test.ts:64`. | **Enforced for existing-booking seat addition:** row lock, fresh count, same-transaction insertion. Other capacity mutation paths need separate assessment, but this is stronger than I1. |
| I4 | Replacing a regular booking and cancelling its predecessor must be atomic. Code-derived transaction contract: “return prisma.$transaction” (`packages/features/bookings/lib/handleNewBooking/createBooking.ts:139`), old update `:141`, new insert `:144`. | **Highest:** a move must not strand the appointment. | **At least 3 files / 2 layers:** service `RegularBookingService.ts:1707`, create helper, schema `fromReschedule` at `packages/prisma/schema.prisma:888`. | **Enforced in inspected regular replacement transaction.** External providers are not atomic with it; all-seat/series atomicity is not claimed. |
| I5 | Already-cancelled appointments must not be cancelled again: “We prevent cancelling an already cancelled booking” (`packages/features/bookings/lib/handleCancelBooking.ts:130`). | **High:** protects rescheduled meetings and lifecycle integrity. | **At least 3 files / 3 layers:** cancellation handler `:135`, API controller `apps/api/v2/src/platform/bookings/2024-04-15/controllers/bookings.controller.ts:254`, schema status at `packages/prisma/schema.prisma:875`. | **Enforced sequentially; concurrency unknown.** Initial guard is separated from the update. |
| I6 | Eligible paid seats each receive a refund attempt: “refund every successful (not-yet-refunded) payment” (`packages/features/bookings/lib/payment/processPaymentRefund.ts:29`). | **Supporting/generic:** important financial obligation, not the product's scheduling advantage. | **At least 4 files / 3 responsibilities:** refund helper `:31`, cancellation caller `handleCancelBooking.ts:411`, schema payment `:1095`, refund tests `processPaymentRefund.test.ts:119` under the same payment directory. | **Attempts enforced; completion not guaranteed:** provider failures aggregate, then cancellation logs them. |
| I7 | A sync update acknowledged as applied must not disappear before the booking changes; narrative “Guarantees updates” (`packages/features/calendar-subscription/README.md:14`). | **High supporting value:** external consistency feeds scheduling. | **At least 4 files / 3 responsibilities:** README, `CalendarSubscriptionService.ts:319`, `sync/CalendarSyncService.ts:146` under calendar-subscription/lib, schema calendar state. | **Weak:** cursor advances before sync; failed cancellation is swallowed. Eventual convergence is a process obligation, not a single aggregate transaction invariant. |
| I8 | A provider identity has at most one local account link: “@@unique([provider, providerAccountId])” (`packages/prisma/schema.prisma:1234`). | **Generic enabling value:** access infrastructure. | **1 directly verified file / persistence layer** for this rule. | **Enforced by declared database uniqueness.** Migration deployment not tested. |

**Choose I1.** It combines the product's central promise with a concrete bypass and a documented reliance on the presentation flow. I3/I4 have stronger transactional enforcement; I2 has a clear mismatch but more unresolved product exceptions; I7 concerns eventual consistency rather than an immediate illegal booking command. I1 also has a bounded preservation target: retain existing window semantics, eliminate command bypasses and log-and-continue acceptance.

### Precise invariant and exclusions

At the admission point for each appointment start, using a single server evaluation time `t`, authoritative event policy and server-produced availability evidence:

1. The start is a valid instant, not before `t`, and not before `t + minimumBookingNotice`.
2. `UNLIMITED` imposes no future-period bound but still obeys notice/past rules.
3. `ROLLING` and `RANGE` obey their existing calendar/business-day and timezone interpretations.
4. `ROLLING_WINDOW` obeys the bound computed from server-produced bookable dates; there is no command option to skip that rule.
5. Missing, invalid, mismatched or failed required evidence produces an error and no appointment-time mutation. It never becomes an unbounded policy.

The invariant concerns the **start instant**: current period predicates compare `time`, not the whole appointment interval (`packages/lib/isOutOfBounds.tsx:327`). Extending it to require the end inside the window would be a new requirement. Duration validation, conflict detection, seat limits, authorization and event-frequency limits remain separate safeguards. Historical bookings are not invalidated when time passes; enforcement occurs on admission, not every aggregate load.

Scope covers event-type-backed creation and time moves through the shared booking service, including seated and recurring occurrences and calendar-originated moves. A dynamic booking without a persisted event type must receive its existing server-resolved policy explicitly; it must not gain an implicit exemption. Full recurring-series all-or-nothing persistence, cancellation-policy redesign, provider delivery guarantees and a general booking rewrite are out of scope.

## 3. Diagnosis: evidence across layers

| Location | Verified quote / behavior | What it establishes |
|---|---|---|
| Settings UI | “ROLLING_WINDOW reuses the same `periodDays` field and `periodCountCalendarDays` fields” (`packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx:77`); checkbox maps back to `periodType` at `:278`. | Host intent is persisted as a real policy, not merely a visual filter. |
| Policy storage/query | “periodType … @default(UNLIMITED)” (`packages/prisma/schema.prisma:196`), “minimumBookingNotice … @default(120)” (`:219`); “periodType: true” (`packages/features/bookings/lib/handleNewBooking/getEventTypesFromDB.ts:60`). | Commands already have policy data. Schema does not constrain `Booking.startTime` against changing event-type settings. |
| Slot API | “allDatesWithBookabilityStatusInBookerTz: allDatesWithBookabilityStatus” (`packages/trpc/server/routers/viewer/slots/util.ts:1317`); “isTimeViolatingFutureLimit” at `:1336`, filtering at `:1361`. | The server enforces the window on the **read/display** path using date evidence. This is not command enforcement. |
| Slot computation | “isBookable: availableDatesSet.has” (`packages/trpc/server/routers/viewer/slots/util.ts:328`); calendar-month lookback for rolling windows at `:934`. | A requested date alone is insufficient to establish the rolling window. A complete bounded date range is needed. Do not invoke the fully window-filtered slot endpoint recursively from the domain. |
| Booker UI | “return !isTimeSlotAvailable” (`apps/web/modules/bookings/components/Booker.tsx:234`), gated by a feature flag at `:232`; selected query-param slot at `:245`. Helper says “false positives are fine” (`packages/features/bookings/Booker/utils/isTimeslotAvailable.ts:68`). | The picker is a UX guard, not proof of admission. Its data may be stale or bypassed. No claim that it alone computes the window: calculation occurs server-side for display. |
| Web mutation route | “bookingData: req.body” (`apps/web/pages/api/book/event.ts:51`), shared service invocation at `:50`. | A caller can submit a time without first following the displayed slots. Parsing and authentication do not establish this invariant. |
| API v2 | “this.regularBookingService.createBooking” (`apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:465`); adapter “extends BaseRegularBookingService” (`apps/api/v2/src/lib/services/regular-booking.service.ts:18`). | An inspected versioned API path reaches the same validator; there is no window guard in this calling method. This is not an audit of every API version. |
| Shared application service | “await validateBookingTimeIsNotOutOfBounds” (`packages/features/bookings/lib/service/RegularBookingService.ts:764`); database creation much later at `:1707`. | A central call site exists, but its current checker is insufficient and evaluation is separated from persistence. Both `createBooking` and `rescheduleBooking` call the handler (`:2653`, `:2663`). |
| Time helper | “the frontend won't allow selecting a timeslot that is out of bounds” (`packages/lib/isOutOfBounds.tsx:40`); “_skipRollingWindowCheck: true” at `:374`. The skip returns null bounds at `:85`. | **Definite command-path omission.** UI/read-path restriction is the effective rolling-window guardian in the inspected flow. Other period modes still have predicates. |
| Unexpected errors | “Unable to determine timeOutOfBounds status. Defaulting to false.” (`packages/features/bookings/lib/handleNewBooking/validateBookingTimeIsNotOutOfBounds.ts:48`). Catch only rethrows `BookingDateInPastError` at `:51`. | **Swallowed evaluation failure.** An unknown error yields no rejection at `:57`; this does not prove every failed evaluation would have rejected the requested time. |
| Availability check | Checks requested interval via “hasDateRangeForBooking” (`packages/features/bookings/lib/handleNewBooking/ensureAvailableUsers.ts:237`), then busy conflicts at `:243`; no `periodType`/rolling-window predicate was found in this helper or `getUserAvailability.ts`. | Being free at a requested time does not prove that time lies inside the next N available days. This check does not close the identified window gap. Restriction-schedule errors rethrow at `:215`; do not describe that branch as fail-open. |
| Persistence | “await tx.booking.create(createBookingObj)” (`packages/features/bookings/lib/handleNewBooking/createBooking.ts:144`); old booking update at `:141`. | Transaction preserves replacement atomicity but accepts plain persistence data with no aggregate admission proof. A seat-owner move has another direct write at `packages/features/bookings/lib/handleSeats/reschedule/owner/moveSeatedBookingToNewTimeSlot.ts:26`. |
| Recurring/calendar callers | Each recurrence calls the regular service (`packages/features/bookings/lib/service/RecurringBookingService.ts:106`); sync calls it at `packages/features/calendar-subscription/lib/sync/CalendarSyncService.ts:212` with availability/limit skip flags at `:218`. | Flags concern other checks and must not become a window bypass. Sync catches operation errors at `:146` for cancellation; durable sync recovery is a separate plan, not a reason to accept an illegal time. |
| Error wrappers | “captureException(error); throw error” (`packages/lib/sentryWrapper.ts:36`); save failure rethrows (`packages/features/bookings/lib/service/RegularBookingService.ts:1827`). | Not every logger swallows errors. The offending bounds catch, not the reporting wrapper, is the immediate fail-open location. |

### Reproducible hypothesis to prove test-first

With the clock frozen, configure `ROLLING_WINDOW` for two bookable days, with the host otherwise free on days one, two and three. The slot read hides day three; directly submit an otherwise valid booking for day three. The inspected time checker omits the rolling-window bound, while interval availability alone can accept day three. A command-level test must establish whether the fixture reaches persistence; do not describe this static trace as an already executed exploit. A second test injects an unexpected evaluator exception and asserts zero writes and zero booking notifications.

## 4. Guardian aggregate design

### Ownership and dependencies

**Proposed root: `BookingAggregate`.** It owns the proposed/committed appointment interval and its admissible time transitions. It does not own the event type, every host schedule or external calendars. For a new booking the repository creates a transient draft; for a move it rehydrates the booking's relevant state. An immutable `BookingWindowPolicy` value object is assembled from authoritative server data and supplied for that operation, not trusted from the request and not silently reconstructed from client fields.

The aggregate is the **sole command gate** for this invariant. Its pure internal evaluator may be reused for slot previews; previews do not authorize a write. The repository maps aggregate state to persistence and never decides whether a date is legal. Infrastructure obtains evidence, but cannot return an unchecked `allowed: true` flag in lieu of the domain rule. Keep the existing table names; no schema migration or new dependency is required by this design.

Proposed names/signatures (pseudocode, not compilable implementation):

```typescript
type BookingWindowPolicy = Readonly<{
  source: EventTypePolicyIdentity | DynamicPolicyIdentity;
  period: Unlimited | Rolling | RollingWindow | FixedRange;
  minimumNoticeMinutes: number;
  eventTimeZone: TimeZoneId;
}>;

type BookingWindowEvidence = Readonly<{
  commandId: string;
  policyFingerprint: string;
  evaluationTime: Instant;
  bookerTimeZone: TimeZoneId;
  coveredDates: DateRange;
  bookableDatesBeforeWindowFilter: ReadonlyMap<LocalDate, boolean>;
}>;

class BookingAggregate {
  static draft(identity: BookingIdentity): BookingAggregate;
  static rehydrate(state: PersistedBookingState): BookingAggregate;
  admitCreation(command: CreateTimeCommand, context: AdmissionContext): void;
  moveStart(command: MoveTimeCommand, context: AdmissionContext): void;
  admitSeat(command: JoinSeatCommand, context: AdmissionContext): void;
  private assertWindow(start: Instant, context: AdmissionContext): void;
  // No public start setter or mutation constructor that bypasses admission.
}

interface BookingAggregateRepository {
  loadForAdmission(tx: Transaction, target: BookingTarget): Promise<BookingAggregate>;
  loadPolicy(tx: Transaction, target: BookingTarget): Promise<BookingWindowPolicy>;
  save(tx: Transaction, aggregate: BookingAggregate): Promise<SavedBooking>;
  saveReplacement(tx: Transaction, previous: BookingAggregate,
                  replacement: BookingAggregate): Promise<SavedBooking>;
}
```

`admitSeat` checks the existing appointment start under the same admission contract when adding a new participant; it does not replace the existing capacity lock/check. Joining an already-started event is not newly authorized here. Whether that should be supported is a separate product change.

Preconditions: new draft for creation; existing authorized booking for movement; valid command identity, parsed start and timezone; policy must match the target; rolling evidence must match the policy, command, timezone and evaluation instant. Existing lifecycle authorization and capacity guards remain in place. Rehydration of historical state does not re-evaluate a past booking against today's notice threshold.

```text
assertWindow(start, context):
  reject invalid instant, timezone or malformed policy with BookingWindowPolicyError
  reject mismatched/incomplete evidence with BookingWindowEvaluationError
  if start < context.now:
      throw BookingWindowViolation(reason = PAST)
  if start < context.now + policy.minimumNoticeMinutes:
      throw BookingWindowViolation(reason = MINIMUM_NOTICE)
  bounds = evaluate policy using context.now and server evidence
           UNLIMITED: no future bound
           RANGE / ROLLING: preserve characterized current boundary semantics
           ROLLING_WINDOW: use complete pre-window-filter bookable-date evidence
  if start is outside bounds:
      throw BookingWindowViolation(reason = FUTURE_WINDOW)
  only after every guard succeeds may the root change its interval/admitted state

moveStart(command, context):
  assert existing lifecycle preconditions
  assertWindow(command.newStart, context)
  set proposed interval; retain previous state for transactional persistence
```

All three proposed named errors extend the existing `ErrorWithCode` (`packages/lib/errors.ts:3`), consistent with `agents/rules/quality-error-handling.md:22`. Use the existing `ErrorCode.BookingTimeOutOfBounds` (`packages/lib/errorCodes.ts:31`) for known violations. Policy/evaluation failures map to server failure, not bad user input; retain the original exception as `cause` via an explicit subclass property if needed because the base constructor accepts code/message/data, not a cause argument. Do not introduce `TRPCError` into the aggregate.

### Rolling-window evidence without recursion or client trust

Extract a server-side, transport-independent provider of **pre-window-filter** bookable dates from the slot computation currently in `packages/trpc/server/routers/viewer/slots/util.ts:1300`. Reuse the same host, schedule, duration, busy-time and timezone inputs; apply window filtering only afterward. `packages/features` must not import the tRPC router to obtain evidence (`agents/rules/quality-error-handling.md:52` documents the import boundary).

Compute dates from the evaluation date through the existing `ROLLING_WINDOW_PERIOD_MAX_DAYS_TO_CHECK` bound, not only around the submitted date or the UI's requested month. Missing dates from an incompletely fetched range are **unknown**, not unbookable. Differentiate a complete range with no free dates from a fetch failure. Evidence is generated anew for each command attempt and never supplied by the browser. Do not reuse the command's own tentative booking as a busy event when evaluating a move; preserve the existing reschedule exclusion identity.

Preserve the existing zero/insufficient-bookable-day bounded fallback initially, characterized by `packages/lib/isOutOfBounds.tsx:229` and `packages/lib/isOutOfBounds.timezone.test.ts:204`. That fallback limits a fully observed search; it must not mask missing data or a thrown error. Preserve calendar-day versus business-day counting and the current RANGE legacy-date interpretation (`packages/lib/isOutOfBounds.tsx:118`). Characterize daylight-saving boundaries before extraction; do not quietly replace timezone-aware code with fixed-offset arithmetic or widen this plan into a timezone migration.

### Repository, consistency and a single transaction

Define admission against the **authoritative local transaction snapshot and the external availability observed for this command attempt**, not against an impossible globally locked calendar state. External providers cannot join a PostgreSQL transaction. This plan does not promise prevention of every concurrent external-calendar change or double booking.

The application obtains required provider data before opening the transaction. Within one serializable transaction it reloads policy/local admission inputs, checks that the prepared evidence matches those inputs, invokes the aggregate and persists its accepted state. A policy/local-input mismatch aborts and rebuilds evidence; it must not reuse a stale successful check. The comparison must cover the full policy/schedule/host input set used in evidence, including additions/removals, not only an EventType ID. The domain method is rerun on every retry using a fresh clock/evidence pair.

```text
executeTimeCommand(input):
  parse input; resolve authorized target and server policy identity
  prepare external evidence for this attempt (no booking mutation or notification)
  try:
    result = database.transaction(isolation = Serializable, tx =>
      policy, localInputs = repository.loadAuthoritativeInputs(tx, target)
      verify prepared evidence matches local inputs; otherwise throw EvidenceChanged
      aggregate = repository.loadForAdmission(tx, target)  // draft if new
      context = build immutable context from policy, evidence and one clock value
      aggregate.admitCreation / moveStart / admitSeat(command, context)
      if regular replacement:
        previous = repository.loadPreviousForReplacement(tx, input.previousUid)
        preserve existing replacement lifecycle rules
        repository.saveReplacement(tx, previous, aggregate)
      else:
        repository.save(tx, aggregate)
    )
  catch domain violation or failed evaluation:
    propagate error; no persistence, calendar creation, payment or notification
  catch serializable conflict or EvidenceChanged:
    retry entire preparation/admission once; then return retryable conflict
  after commit: invoke existing external effects using committed result
```

The transaction contains both the old-record cancellation and replacement insertion; do not wrap the old `saveBooking` helper's own transaction inside a new one. Convert it to transaction-scoped persistence. Seat moves/merges must likewise accept the admitted aggregate and the same transaction client, retaining their capacity protections. Reads/writes that affect business admission must use the supplied transaction client, not the global Prisma client.

Expected failure during any write rolls back the whole local operation. Provider calls must not be held inside the database transaction. Notifications/payment initiation for this operation must not happen before admission; this is a requirement to audit in the implementation phases, not a claim that every current early branch already obeys it. A durable outbox and guarantees after successful commit are separate work; this plan guarantees that rejection does not initiate those effects.

For repeated occurrences, apply the invariant to every occurrence that is persisted. Existing sequential series behavior (`packages/features/bookings/lib/service/RecurringBookingService.ts:115`) does not establish all-series atomicity, and this plan does not promise it. Each individual replacement remains atomic. Dry-run uses the same aggregate evaluation and discards the result; it cannot produce a reusable authorization token.

### Thin transports and error semantics

```text
route(request):
  input = parse(request)
  actor = authenticate/resolve authorized caller
  try: return application.executeTimeCommand(input, actor)
  catch BookingWindowViolation: return 400 with stable existing error code
  catch BookingWindowPolicyError / BookingWindowEvaluationError:
      log cause once; return 500 with safe code; stop
  catch exhausted admission snapshot conflict: return 409; stop
```

An authenticated platform caller, a calendar caller, and `skipAvailabilityCheck` do not receive a new window waiver. The shared service already invokes its bounds validator before its other skip branches (`packages/features/bookings/lib/service/RegularBookingService.ts:764`, `:816`). Calendar-import conflict handling must surface failure to its caller/metrics and must not return a successful booking mutation. Repairing calendar cursor/replay handling remains the separate I7 workstream.

Retain API-version response shapes. Web `defaultResponder` already delegates error handling (`packages/lib/server/defaultResponder.ts:60`); `getServerErrorFromUnknown` recognizes `ErrorWithCode` (`packages/lib/server/getServerErrorFromUnknown.ts:88`). Verify actual mappings in tests rather than assuming the new subclass names alone select HTTP status. UI continues hiding inadmissible slots and renders server rejection without pretending a booking succeeded.

## 5. Before / after by current location

| Current location | Before | After / ownership |
|---|---|---|
| `packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx:77` | UI maps toggle to rolling-window configuration. | Retain setting semantics; display is not the command authority. |
| `packages/prisma/schema.prisma:196`; `packages/features/bookings/lib/handleNewBooking/getEventTypesFromDB.ts:60` | Stored/queryable policy, no booking-time cross-table constraint. | No schema change; repository assembles authoritative policy with explicit `select`. |
| `packages/lib/isOutOfBounds.tsx:26`, `:374` | Shared arithmetic plus a command helper that skips rolling windows. | Move pure evaluator behind the aggregate boundary; read-side previews reuse it. Remove command reliance on the skip path. |
| `packages/features/bookings/lib/handleNewBooking/validateBookingTimeIsNotOutOfBounds.ts:46` | Unexpected errors are swallowed. | Delegate admission to root; propagate named errors. Retire old path only after caller migration. |
| `packages/trpc/server/routers/viewer/slots/util.ts:1300` | Evidence construction and window filtering are fused in transport-layer orchestration. | Extract pre-filter evidence provider; preview and command use common semantics without importing tRPC into features. |
| `apps/web/modules/bookings/components/Booker.tsx:234`; `packages/features/bookings/Booker/utils/isTimeslotAvailable.ts:68` | Display/quick checks can be bypassed or stale. | UX only; command rejection is decisive. No client policy or evidence accepted as authority. |
| `apps/web/pages/api/book/event.ts:50`; `apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:465` | Forward to shared service; no independent reliable admission. | Parse/authorize/delegate/map errors. Add transport contract tests, not duplicate rules. |
| `packages/features/bookings/lib/service/RegularBookingService.ts:764`, `:1707` | Weak early validation and later plain-data writes. | Application coordinates evidence, aggregate and transaction; all write/side-effect branches require accepted admission. |
| `packages/features/bookings/lib/handleNewBooking/ensureAvailableUsers.ts:237` | Checks interval availability, not rolling-window position. | Keep conflict/host checks; reuse pre-window data where suitable. Do not incorrectly count it as a second guardian. |
| `packages/features/bookings/lib/handleNewBooking/createBooking.ts:139` | Transaction accepts plain booking data. | Transaction-scoped aggregate repository saves admitted state; preserves old/new replacement atomicity. |
| `packages/features/bookings/lib/handleSeats/reschedule/owner/moveSeatedBookingToNewTimeSlot.ts:26` | Separate direct date mutation. | Route time mutation through admitted aggregate and transaction repository; preserve seat-specific effects after commit. Audit sibling merge/attendee paths before declaring complete. |
| `packages/features/bookings/lib/service/RecurringBookingService.ts:106` | Reuses shared handler per occurrence. | Each persisted occurrence passes root admission; document partial-series behavior rather than inventing series atomicity. |
| `packages/features/calendar-subscription/lib/sync/CalendarSyncService.ts:212` | Calls shared handler with other check-skip flags. | Same window gate; rejected import remains an error, not a silent local date update. |
| `packages/features/calendars/components/NoAvailabilityDialog.tsx:14` | Display-only bounds calculation also uses skip flag at `:21`. | Remains a presentation diagnostic or uses shared preview; never accepted as evidence for a write. |

## 6. Implementation phases and verification

These phases are planned, not authorized implementation. The user's present request is documentation only. Future implementation touches multiple packages; `AGENTS.md` requires approval for that scope, dependencies, schema changes and full E2E/build suites. No dependency/schema change is proposed. Keep each implementation PR under 500 changed code lines and fewer than 10 code files; split a phase further if necessary, using draft PRs and conventional titles.

### Phase 1: Prove the command gap — test-first

- Add deterministic command-level tests for direct rolling-window submission and evaluator failure. Establish expected failures against the current implementation without forcing another guard to reject first.
- Characterize legal boundaries, RANGE legacy storage, business-day counting, bounded fallback, and dynamic/recurring/seat caller behavior. Reuse `packages/lib/isOutOfBounds.timezone.test.ts` and the booking scenario harness; do not replace integration proof with a mocked `allowed` flag.
- Done when the two focused regressions fail for the identified admission reason and preserved-semantic fixtures pass.

### Phase 2: Extract evidence and pure policy evaluation — test-first

- Extract transport-independent pre-window bookable-date preparation and pure window semantics. Separate complete/no-slots from incomplete/failed evidence, and inject one clock for the whole decision.
- Keep current slot responses stable; avoid circular calls from availability into the final window-filtered endpoint.
- Done when preview/evaluator parity fixtures pass and the feature layer has no new imports from `@calcom/trpc`.

### Phase 3: Introduce the guardian and repository — test-first

- Add proposed root/value objects/named errors with legal and illegal method tests, including no state mutation after rejection.
- Add transaction-scoped repository hydration/save and snapshot comparison. Use existing Prisma transaction capabilities; preserve existing seat locks and replacement transaction behavior.
- Done when direct repository save cannot accept an unadmitted draft through its public API, and database rollback/conflict tests pass. Type encapsulation is an API discipline, not a database security boundary; migrations/admin scripts remain separately privileged.

### Phase 4: Migrate commands and effects — test-first

- Migrate the shared regular path before its seat/recurring/calendar callers. Inventory direct booking date writes and admission-changing branches using source search; explicitly account for every writer in the supported booking command surface.
- Place the aggregate decision before each operation's booking mutation and external effects; consolidate persistence through the transaction client. Existing non-time updates need not load this aggregate.
- Done when web and API direct-request tests reject the forbidden date, legal commands still work, each supported seat/move writer is mapped to admission, and failed admission triggers zero booking/payment/calendar/notification effects.

### Phase 5: Align transports and presentation; retire bypasses

- Test-first for API error mappings and UI handling of a server rejection. Preserve existing response contracts and translation keys where possible; add any new UI messages to English `common.json`.
- Remove obsolete command-validation logic and any command usage of `_skipRollingWindowCheck`; keep read-side diagnostics only if their non-authoritative scope is explicit. Deletion requires the normal repository approval before implementation.
- Done when a scoped search finds one command authority, no supported raw date writer bypasses it, and no bounds-evaluation failure logs and continues. A search is supplemented by call-path review, not treated as proof on its own.

### Phase 6: Focused release verification

- Run focused Vitest unit/integration tests, relevant package type checks and Biome on changed files. Before push run `yarn type-check:ci --force` and the repository-required relevant tests/lint. Full build/E2E remains subject to the repository's approval boundary.
- Test real PostgreSQL transaction rollback and concurrent policy editing; mocks cannot establish isolation. Use provider fakes to fail evidence acquisition without needing live calendars.
- Done when no illegal/missing-evidence case persists a changed appointment time, all characterized legal cases pass, and bounded evidence computation is measured on representative maximum-window fixtures. Record latency rather than inventing an unprovided SLA.

### Required test matrix

| Area | Legal / accepted cases | Illegal / failure cases and observable result |
|---|---|---|
| Clock/notice | Exactly at notice threshold; future start under UNLIMITED. | Past, one millisecond inside notice, invalid instant/timezone: named error, no state change/write. Use one frozen clock per decision. |
| ROLLING | Last permitted day; calendar/business-day variants. | First instant beyond end: violation. Booker/event timezone boundary cases agree with characterized semantics. |
| RANGE | Inclusive start/end day boundaries; legacy and UTC-midnight stored dates. | Before/after range; missing/inverted policy: reject, never silently unlimited. Cover DST transitions. |
| ROLLING_WINDOW | Within first N bookable days; gaps/weekends counted correctly; complete bounded-search fallback. | Otherwise free time beyond Nth permitted day; partial date map; policy/command mismatch; evaluator throw: reject without mutation. |
| Direct transport | Legal web/API request without prior slot query succeeds. | Forged POST for hidden date is rejected; stale UI data cannot authorize it; matching API error shape and no success UI. |
| Persistence | Accepted creation; valid replacement atomically inserts new and cancels old. | Throw between old update/new insertion: rollback both. Policy changes during preparation force evidence rebuild or conflict, not stale acceptance. |
| Side effects | Effects run after accepted commit. | Every admission error leaves calendar, payment, email and webhook spies uncalled for that operation. Fail external evidence acquisition before writes. |
| Seats | Legal join/move retains capacity behavior and existing last-seat race protection. | Out-of-window join/move/merge target is rejected without attendee/date mutations. Verify both owner and attendee entry paths. |
| Series / imports | Every valid occurrence admitted; in-window calendar-origin move accepted. | Invalid recurrence is not persisted; no claim of rolling back earlier valid occurrences. Calendar skip flags do not waive the window; failure is observable. |
| Read-side parity | Preview and command agree for identical policy, clock and complete evidence. | Evidence may change between preview and POST; server rejection wins. No recursive slot-provider invocation. |
| Error handling | Known violation maps to stable 400; successful retry returns accepted result. | Evaluation failure maps to safe 500 with preserved cause; exhausted snapshot/serialization retry maps to 409; no log-and-continue. |

## 7. Names, remaining decisions and rollout limits

No maintained contract registry was found by filename searches for contract/registry documents and text searches across `context/` and `agents/`. Do not invent a second registry. Register the following **proposed load-bearing names** in the eventual change's approved contract record (or the project's registry if one is identified before implementation):

| Name | Contract to record |
|---|---|
| `BookingAggregate` | Sole command authority for time admission; rehydration is not admission; no public raw time setter. |
| `BookingWindowPolicy` | Immutable server-resolved policy; explicit event-backed/dynamic source; no client override. |
| `BookingWindowEvidence` | Complete pre-filter date coverage tied to command/policy/timezone/clock; not a browser token. |
| `BookingAggregateRepository` | Hydrates/saves root using caller transaction; no independent business predicates or nested transaction. |
| `BookingWindowViolation` | Known illegal start, stable out-of-bounds code, no state mutation. |
| `BookingWindowPolicyError` / `BookingWindowEvaluationError` | Invalid configuration or inability to determine legality; propagate cause and stop. |
| Admission snapshot contract | Local transaction snapshot plus external data observed for that attempt; bounded whole-attempt retry, no false external atomicity claim. |

The plan chooses fail-fast because the user explicitly requires it. It chooses existing period semantics rather than adding new business restrictions. Questions to resolve before broad rollout, without blocking this plan's delivery:

- **Scheduling product owner:** should the existing fully observed, insufficient-bookable-days fallback remain permanent? This plan preserves it; changing it is separate behavior work.
- **Booking/API owner:** are there supported administrative or calendar-import exceptions to future-window limits? No exception is evidenced for the selected rule; this plan does not add a bypass. Any approved exception must be named and implemented inside the domain contract, not a transport boolean.
- **Scheduling maintainer:** which dynamic-event policy resolver and all direct date writers are supported in the release? Complete the writer inventory before claiming universal enforcement.
- **Operations owner:** what command latency budget is acceptable for complete rolling-window evidence acquisition? The maximum search horizon already exists, but no latency target was found.

Roll out by migrating callers to the same gate, not by dual writes or an “accept if either validator allows” mode. Until all supported writers are migrated, label coverage partial. A rollback must not silently restore a known admission bypass: disable the affected mutation surface or roll back only non-enforcement parts while retaining rejection. No new feature flag or dependency is necessary merely to deliver this plan.

## Progress

All implementation work is pending; document completion is not implementation completion.

- [ ] Phase 1: Command regressions and semantic characterization.
- [ ] Phase 2: Evidence provider and pure policy extraction.
- [ ] Phase 3: Aggregate and transactional repository.
- [ ] Phase 4: Shared command and writer migration.
- [ ] Phase 5: Transport/UI alignment and bypass retirement.
- [ ] Phase 6: Focused verification and release review.
