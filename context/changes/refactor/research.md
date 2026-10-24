---
date: 2026-10-22T23:24:34.4172187+02:00
researcher: Codex
git_commit: 5955009bb6f20f0e882bd87d39263ecc80aa6d7e
branch: main
repository: cal.diy
topic: "Booking refactor opportunities: structure, intentionality and migration feasibility"
tags: [research, bookings, refactoring, architecture, history, feasibility]
status: complete
last_updated: 2026-10-22
last_updated_by: Codex
---

# Research: Booking refactor opportunities

## Problem inventory and classification

This inventory is the audit entry point. **CANDIDATE** means that addressing the structural part would change responsibility, dependency, type or data-contract structure. It does not mean approved or worth implementing. **NONCANDIDATE** means behavior/policy work, a verification gap, or insufficient evidence of a structural defect. Conditional candidates remain visible even when examination rejects structural refactoring as their solution.

Source shorthand **R** below means `context/changes/create-booking/research.md`. Repeated manifestations are grouped and cross-referenced, not counted as independent incidents. Classification is **inference**; the cited report is the **inherited evidence**. This covers the debt list, findings outside that list, recommended actions, test limitations and blast-radius risks in R. The repository map supplies priors; its unrelated onboarding/profile hotspots do not expand this booking investigation into a repository-wide refactor program.

| ID | Recorded problem and source | Classification and disposition |
| --- | --- | --- |
| C1 | Mixed booking orchestration; database insertion, provider work, payment and later reference updates have different failure/success boundaries; several follow-up errors are logged and tolerated. R:31, R:46, R:189 | **CANDIDATE**, limited to responsibility separation preserving behavior. Changing success, retry or recovery guarantees is separate semantic work. |
| C2 | Booking-shaped success can mean reuse, seat addition, payment or nonpersisted decoy; API regular reload assumes persistence while web handles a decoy. R:29, R:53, R:190, R:205 | **CANDIDATE** for explicit internal outcome contracts. API decoy response policy is not selected. |
| C3 | Common interface accepts/returns `any`; result DTO derives from concrete service and participates in a type-only dependency loop. R:191, R:208; map structure, Type-only cycles | **CANDIDATE** for typed contracts. Type-only loop is not a runtime-cycle defect. |
| C4 | Partial DI: direct EventManager construction, singleton-backed insertion despite injected Prisma, and fragmented access paths. R:192 | **CANDIDATE** for dependency seams. Distinct read projections alone are not a defect and need not be unified. Projection breadth is C7. |
| C5 | Shared retrieval imports its tRPC consumer; query, transport schema and transport errors are coupled. R:116, R:193 | **CANDIDATE** for transport-independent listing. No recursive-call failure is established. |
| C6 | Sequential recurring creation exposes a possible partial-series boundary. R:59, R:194 | **Conditional CANDIDATE examined and rejected as a structural fix**: defining series success/compensation requires separate business-contract analysis. Missing failure tests are N8. |
| C7 | `include` rather than explicit `select` at creation and API reload; implicit fetched field contracts. R:198, R:206 | **CANDIDATE** for consumer-owned projections. The two queries have different shapes; no credential leak is established. |
| C8 | Generic Error, HttpError and domain errors coexist across service/transport boundaries. R:199, R:209 | **CANDIDATE** for domain errors with explicit translation. Existing mappings must be preserved, not assumed absent. |
| C9 | API wrapper double-asserts the injected Prisma client type. R:200 | **CANDIDATE**, provisionally, for an honest assignable dependency contract. A redundant local assertion may need only small cleanup; larger redesign is unsupported. |
| C10 | Blocking-service composition imports administration, which imports verification and returns to blocking composition. R:122 | **CANDIDATE** for acyclic composition. Module loading is not evidence of executing admin operations during booking. |
| N1 | First round-robin occurrence is created but omitted from returned array. R:59, R:207 | **NONCANDIDATE** behavior defect/asymmetry; preserve as recurrence characterization input. Fixing returned contents is not structural cleanup. |
| N2 | Spam backend failure permits the request past that gate. R:196 | **NONCANDIDATE** explicit fail-open policy; preserve during C2/C10. |
| N3 | Failure-injection spy targets a different SpamCheckService instance. R:150, R:197, R:204 | **NONCANDIDATE** defective test; prerequisite confidence work for C10 and spam-related changes. |
| N4 | Root unit runner omits integration filenames/API v2 specs; historical suite deletions do not describe current coverage. R:154, R:156, R:195 | **NONCANDIDATE** verification/CI-selection constraint for migration cost. |
| N5 | Provider/Prismock orchestration tests do not establish real PostgreSQL constraints, provider busy-time/cache consistency or live delivery. R:136, R:137, R:142 | **NONCANDIDATE** evidence gap affecting C1/C4/C7/C8. |
| N6 | No targeted P2002 conversion assertion identified; ordinary non-seat concurrency/retries/idempotency unestablished. Seat scenarios do not prove lock behavior, and real seat-race tests are not general-create tests. R:137, R:139, R:140, R:218 | **NONCANDIDATE** assurance gap; do not infer a demonstrated race or comprehensive idempotency. |
| N7 | No explicit adapter-decoy assertion found in the bounded API E2E/Booker search; deployed API reachability and mapping unknown. R:148, R:190 | **NONCANDIDATE** characterization gap for C2. |
| N8 | No partial-series failure/rollback assertion found in the inspected recurrence/fresh/reschedule tests. R:141, R:221 | **NONCANDIDATE** prerequisite for C6's later semantic investigation. |
| N9 | SQL/delegation mocks do not establish real query results or unmocked cycle initialization; direct repository tests omit the identified detail/original-reschedule lookups. R:144 | **NONCANDIDATE** shield gap, principally C5 and read-contract work. |
| N10 | API E2E overrides PermissionsGuard; one attendee-address case is disabled while another remains active. R:135 | **NONCANDIDATE** authorization/coverage limitation, not proof all authorization or attendee coverage is absent. |
| N11 | Verification is mocked; token delivery/external verification unestablished. R:138 | **NONCANDIDATE** test boundary for C10, not evidence of a verification defect. |
| N12 | Event save crosses editor invalidation/server revalidation; team-slug branch has a stale-cache comment; public-cache visibility remains unknown. R:118, R:220 | **NONCANDIDATE pending evidence**: no established stale-page defect or justified structural fix. |
| N13 | Follow-up delivery, provider retries/reconciliation and complete booking-to-workflow delivery remain unverified; current event hook is not proof of workflow dispatch. R:124, R:142, R:143, R:189 | **NONCANDIDATE** operational/coverage unknown supporting C1 cost, not a proven missing recovery system. |
| N14 | API read-after-write uses a separate read service; replica topology/consistency unknown. R:53, R:219 | **NONCANDIDATE** deployment unknown relevant to C2/C4/C7; no replica-lag defect established. |
| N15 | Booking/EventType/User changes can affect denormalized listings through SQL triggers; later migration overrides/deployed triggers unknown. R:169, R:219 | **NONCANDIDATE** hidden dependency and migration constraint for C5, not evidence to remove denormalization. |
| N16 | Input, stored/generated data, event settings, privacy, calendar/mail/payment and public webhook shapes cross layers. R:164–173, R:179–185 | **NONCANDIDATE** compatibility constraints. Generated output is not manually duplicated domain design; internal assignmentReason is not automatically a public payload contract. |
| N17 | Web/API guards differ; web checks do not establish equivalent protection on other callers. Older API, recurrence and calendar-sync callers extend shared-service impact. R:41, R:53, R:61 | **NONCANDIDATE** caller/guard constraint for C1–C4/C8; no automatic guard unification is justified. |
| N18 | Runtime results, latency, flags, incident frequency, external reviews and complete graph/coverage are unavailable; historical graph and co-change scopes differ. R:183, R:217, R:222 | **NONCANDIDATE** uncertainty affecting confidence and cost estimates. Counts are not incident rates or breakage probabilities. |

## Research question, method and priors

Which recorded structural problems are worth considering for refactoring, in what adequate target shape and relative order? This is exploration followed by a proposal for a later planning session. No implementation, target architecture design, product decision or plan approval occurs here.

**Evidence.** The parent read R, its [structural audit](../create-booking/structural-audit.md), audit query script and selected result groups, the [repository map](../../map/repo-map.md), and its [territory](../../map/artifact-1-territory.md), [structure](../../map/artifact-2-structure.md) and [contributor](../../map/artifact-3-contributors.md) artifacts as priors. `context/foundation/lessons.md` was absent. The diff from R's recorded application revision `a9b82799df26c54e200b8e0a236dc3f1238bc6a1` to this report's HEAD contains context documents, not application changes; inherited application anchors therefore remain applicable. Prior recommendations were examined rather than adopted.

Three read-only sub-agents each covered C1–C10: **current shape**, **history/intentionality**, and **migration feasibility/CI**. All completed before synthesis. The parent independently checked decisive projection shapes, the retrieval/container edges, recurring accumulation, error mapping, CI conditions and selected historical evidence. The investigation reused the audit instead of regenerating its broad graph or end-to-end trace.

**Evidence** below means inspected source, configuration or local Git patches; inherited evidence is explicitly attributed. **Inference** includes cost assessments, candidate classification, target-shape names and ranking. **Unknown** is not an implied negative finding. Source references are repository-relative `file:line` anchors at the recorded HEAD; local commit IDs identify historical evidence, not verified remote PR discussions. No numeric effort or incident estimate is supported.

**Evidence.** The history worker searched tracked ADR/design/architecture filenames and `specs/*.md`; it found general rules and cancellation-reason specifications, but no candidate-specific ADR resolving these choices. This bounded search does not prove no design discussion exists. Local commit bodies and patches provide the intentionality evidence below; remote reviews and rejected alternatives are unknown. AI-coauthored patches are usable provenance, but no fresh activity ranking was calculated from them.

## Existing shields and CI constraints

**Evidence.** Root unit execution is `package.json:81` and `.github/workflows/unit-tests.yml:20`. `vitest.config.mts:32` selects integration filenames in integration mode; `:38` selects ordinary test/spec names and `:45` excludes API v2 specs. Integration CI sets up a database and runs `VITEST_MODE=integration yarn test` at `.github/workflows/integration-tests.yml:87` and `:89`. Browser CI runs Playwright at `.github/workflows/e2e.yml:94`. API v2 uses separate Jest commands at `apps/api/v2/package.json:25`, `:29`, `:30`, with E2E execution at `.github/workflows/e2e-api-v2.yml:95`. API E2E transformation disables diagnostics in CI at `apps/api/v2/jest-e2e.ts:34`; it cannot replace the separate type-check job at `.github/workflows/check-types.yml:25`.

**Evidence.** PR preparation depends on trust (`.github/workflows/pr.yml:164`), file filtering excludes documentation-only changes from all-check requirements (`:199`), and `ready-for-e2e` controls `run-e2e` (`:284`). Integration/web/API E2E jobs depend on these conditions (`:371`, `:378`, `:385`). The aggregate gate compares their results with success without the corresponding `run-e2e` condition (`:454`–`:473`); a skipped job is neither execution evidence nor an assumed green aggregate. Merge-group/manual `all-checks.yml:4` invokes integration/browser jobs at `:47`–`:74`, but the inspected job list and aggregate at `:78` omit API v2 E2E.

**Inference.** A future refactor needs relevant selected suites and type checks, not an undifferentiated claim that “CI covers bookings.” Source assertions establish available shields, not current passing status. No tests, builds, type checks, provider calls or application code changes were performed for this report. Actual CI runs and branch-protection requirements remain **unknown**.

## Candidate findings

### C1 — Orchestration and effect boundaries

**Evidence — current shape.** `packages/features/bookings/lib/service/RegularBookingService.ts:486` combines policy, scheduling, persistence, provider operations, messages, payment and output assembly. Existing seams include creation at `:1707`, EventManager reschedule/create at `:1909`/`:2052`, payment at `:2291`, and the later reference update at `:2446`. `packages/features/bookings/lib/handleNewBooking/createBooking.ts:139` transactionally updates the old booking and creates the replacement; its credential lookup at `:130` precedes the transaction. The helper also updates event details (`:50`, `:72`), so it is not merely an insert wrapper. Reference-update and requested-webhook failures are caught at service `:2461` and `:2478`.

**Evidence — history.** `b8d4fccbaba` (#17074) introduced the creation transaction with explicit atomicity rationale for reschedule cancellation/creation and rerouting responses. `5d65df9c05a` (#27546) deliberately moved BOOKING_REQUESTED queuing after the update so location, metadata and references are available, adding catch/log handling. The reference-update catch traces to `1c59c0dd064`; its original rationale was not established.

**Intentionality verdict: mixed.** The transaction and requested-webhook ordering are **conscious constraints**. Treating the remaining orchestration as residual complexity is **inference**; history does not establish a deliberate design for each failure boundary. Recovery guarantees and operational cost are **unknown**.

**Inference — feasibility.** Adequate target shape: **explicit booking orchestration with named persistence and effect phases**. Reuse existing collaborators; extract one bounded block while preserving order, inputs, catches and outward results. Each extraction is reversible without a schema migration. Blast radius is high because the service also handles rescheduling/seats and is called by recurrence, API versions and calendar sync (R:61, R:171). Fresh/reschedule/paid/private-link tests help, but mocked providers do not prove delivery or recovery. First prerequisite: characterize the chosen block's post-insert failure outcomes. Debt and change cost are both high; C4 may make isolation cheaper. **Stop** if the objective becomes new retry, compensation or booking-success semantics; those require separate analysis, not an extraction disguised as a consistency fix.

### C2 — Outcome contract across adapters

**Evidence — current shape.** The decoy already has a discriminator: `isShortCircuitedBooking: true` at `packages/features/bookings/lib/service/RegularBookingService.ts:1573`, alongside `id: 0` at `:1507` and ACCEPTED status at `:1510`. Web checks the discriminator at `apps/web/modules/bookings/hooks/useBookings.ts:162` and stores/navigates the decoy at `:178`. API regular creation calls the service at `apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:465`, checks UID at `:479`, reloads at `:483` and throws for no row at `:485`. The issue is uneven outcome interpretation, not absence of any discriminator.

**Evidence — history.** `a0e5e03903f` (#24326) introduced async spam checking, decoys and client-held success together, explicitly to conceal detection and avoid blocking legitimate bookings on check failure. The API persisted-row reload predates this: `0eabe7f28bc` (#16200), subsequently changed by `bd4a949a7c0` (#17045).

**Intentionality verdict:** anti-disclosure and fail-open behavior are **conscious constraints**. The mismatch's intention is **unknown**. A later result variant meeting an older persistence assumption is an **inference** supported by that chronology.

**Inference — feasibility.** Adequate target shape: **explicit internal outcome variants with adapter translation**, building on the existing marker. Characterize current adapter behavior, introduce a typed classification without changing responses, then migrate consumers individually. This can be reversed at the adapter boundary. Blast radius includes early returns, payment, recurrence, web storage/redirects and API formatting. Spam integration checks shape/nonpersistence (`spam-booking.integration-test.ts:58`, `:74`); R:148's bounded adapter assertion gap remains. First prerequisite: characterize the API receiving a decoy through its actual error translation. Cost is medium/high, while deployed reachability and severity are **unknown**. **Stop** before prescribing an accepted API decoy DTO: that is an external API/security-policy choice, not established by R:205.

### C3 — Common service and result types

**Evidence — current shape.** `packages/features/bookings/lib/interfaces/IBookingService.ts:6` and `:8` accept `any[]` and return `Promise<any>`. Its comment expressly limits enforcement to method presence because regular/recurring inputs differ. Concrete inputs already exist at `packages/features/bookings/lib/dto/types.d.ts:15`, `:17`, `:33`, `:43`; result derivation at `:48` depends on the concrete service. The TODO at `:47` calls for an independent result definition. Recurring has a concrete result annotation at `packages/features/bookings/lib/service/RecurringBookingService.ts:148` and depends on the concrete regular service at `:135`.

**Evidence — history.** `9ceb5ea3c50` (#23277, service/factory skeleton) introduced the interface and its stated method-presence compromise. `870ad57a7e5` (#23682) added the independent-result follow-up TODO.

**Intentionality verdict: conscious interim compromise.** Divergent signatures are load-bearing; `any` is a chosen workaround, not proven necessary. **Inference:** the acknowledged unfinished contract is genuine debt, but concrete callers retain more type inference than the common interface offers; this is not evidence that booking calls generally lack type checking.

**Evidence — consumer check.** A final AST identifier search followed by an `rg` cross-check for `IBookingService` in `apps` and `packages` (`*.ts`, `*.tsx`, `*.mts`, `*.cts`) found the interface declaration and the imports/implements clauses in the regular and recurring services (`RegularBookingService.ts:112`, `:2585`; `RecurringBookingService.ts:5`, `:141`; `IBookingService.ts:4`). No separately typed caller was identified in that lexical scope. This does not prove absence of indirectly inferred type relationships.

**Inference — feasibility.** Adequate target shape: **typed service contracts with independently owned result types**. Begin with parameterized or separate contracts that preserve concrete signatures; independently declaring result variants is a larger follow-up, not an automatic part of removing `any`. Existing input types supply most of the narrow seam; new contract typing may be needed, not a new runtime service. Blast radius is low/medium for interface enforcement and broader for DTO ownership (R:165–166). Compile-time valid/invalid substitution checks and shared/API type checks are primary shields; runtime scenario suites guard accidental behavior changes. First prerequisite: specify a concrete enforcement failure that stronger implementation contracts would catch, using the existing signatures. Narrow changes are reversible and comparatively cheap, but the observed lack of separately typed callers reduces the immediate benefit relative to C7. Do not combine this with C2's external response decision.

### C4 — Dependency isolation

**Evidence — current shape.** Dependencies are declared at `packages/features/bookings/lib/service/RegularBookingService.ts:423`, but creation calls the helper at `:1707`, whose Prisma import is singleton-backed (`packages/features/bookings/lib/handleNewBooking/createBooking.ts:4`). Later updates use injected `deps.prismaClient` (`RegularBookingService.ts:2446`). Direct EventManager construction occurs for normal effects at `:1835` and original-host cleanup at `:1869`; dry-run/skip-calendar guards at `:1834` and organizer-change conditions at `:1861` matter. The API subclass already injects dependencies at `apps/api/v2/src/lib/services/regular-booking.service.ts:30`.

**Evidence — history.** Helper extraction `5f8d090d3c4` (#15612) retained direct Prisma. `3bcce02b92e` (#23156) introduced the Nest dependency-supplying subclass. `358434429ef` (#24122) deliberately made manager construction respect `skipCalendarSyncTaskCreation` as well as dry-run.

**Intentionality verdict:** staged decomposition and construction guards are **conscious**; the necessity of the remaining hard-wired dependencies is **unknown**. Residual coupling from successive extractions is **inference**, not a recorded decision to prohibit injection.

**Inference — feasibility.** Adequate target shape: **complete injectable creation-persistence and EventManager seams**. Either let the existing helper receive its database dependency while retaining its transaction, or introduce a factory covering both manager construction contexts; stage these separately with production-default adapters. Do not consolidate success-page, API and listing read projections merely because they differ. Blast radius includes shared construction, the platform bridge/Nest wrapper, dry-run, rescheduling cleanup and persistence tests. Fresh/reschedule/meeting-URL assertions help; seat concurrency tests protect a different transaction. First prerequisite: map singleton versus injected operations and characterize the chosen seam, including both manager contexts if that seam is selected. Medium change cost can buy concrete isolation; broader persistence unification has no established additional benefit.

### C5 — Retrieval layer inversion

**Evidence — current shape.** `packages/features/bookings/lib/getAllUserBookings.ts:6` imports the query from tRPC and calls it at `:47`; `packages/trpc/server/routers/viewer/bookings/get.handler.ts:2` imports that helper and calls it at `:61`. The handler adapts cursor/offset and default filters (`:40`); the feature helper normalizes singular/plural statuses (`:45`). The exported query starts at handler `:93`, uses a tRPC schema type at `:104`, composes access unions/SQL/hydration (`:169`, `:440`, `:455`) and throws TRPCError (`:160`, `:920`, `:964`). API listing also uses the helper (`apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:650`). Existing explicit Prisma/Kysely/user/filter arguments are a useful seam; moving the import alone would leave schema/error coupling.

**Evidence — history.** `cc2164657cf` (#14164) introduced the shared helper and the reverse imports while sharing fetch/cancel/reschedule endpoints and hooks. Reuse was deliberate. The inspected patch supplies no reason the query must reside in a transport handler. `agents/rules/architecture-circular-dependencies.md` explicitly prohibits feature-to-tRPC imports.

**Intentionality verdict: accidental complexity (inference with strong provenance).** Shared retrieval semantics are a constraint; circular wiring is not an established requirement. A runtime initialization failure is **unknown**.

**Inference — feasibility.** Adequate target shape: **transport-independent listing query with thin adapters**. Preserve SQL, access predicates, filter compatibility and pagination; separate transport types/error translation, extract bounded query helpers, then move the remaining ownership and redirect consumers. Existing explicit dependency parameters can be retained. A temporary compatibility export must not recreate the cycle. The implementation spans much of `get.handler.ts:93` through its later query helpers (`:964`), so moving the entire body is not a credible single small PR under AGENTS' changed-line limit: additions plus deletions both count. Planning must size reviewable slices before choosing this migration; a specific compliant split has not been proven here.

Blast radius is medium/high: web/API listing, SQL, authorization/filter semantics, denormalized triggers and hydration. Existing `get.handler.test.ts:8`/`:9` mocks cross the exact seam; its assertions at `:159`, `:184`, `:207`, `:243`, `:260` provide partial shields. First prerequisite: database-backed representative access/filter/pagination characterization plus unmocked import initialization. **Evidence:** current local `PermissionCheckService` at `get.handler.ts:21` returns permissive checks/empty team IDs; preserving observed behavior does not certify authorization correctness. Permission-policy redesign is separate. Removal of a concrete layer violation has clear structural value, but SQL/security sensitivity and slice size raise change cost. No schema change is inherently required.

### C6 — Recurring-series consistency

**Evidence — current shape.** `packages/features/bookings/lib/service/RecurringBookingService.ts:63` awaits the special first round-robin occurrence, obtains lucky users at `:71`, loops from index 1 for round-robin or 0 otherwise at `:74`, then calls/awaits regular creation at `:106`/`:115`. Loop results are appended at `:117`; recurrence provider identifiers are carried at `:119`. This inspected function has no enclosing series transaction or compensation path; compensation outside it is **unknown**.

**Evidence — history.** `e0ac95578ca` (#13597) extracted this ordering and the omission of the first round-robin result. Current comments at `:76`–`:78` explain forward iteration to check initial occurrences rather than iterating backwards for app-status email aggregation. They do not justify omission from the returned array or partial-series failure semantics.

**Intentionality verdict:** initial host selection/forward ordering are **conscious constraints**; series failure policy and omitted-result intent are **unknown**.

**Inference — feasibility and stop.** “Explicit series outcome policy” names the missing business contract, not a chosen target architecture. Structural extraction cannot decide whether earlier committed bookings should remain after a later failure; a database transaction around provider calls would not establish cross-provider atomicity. Blast radius includes persisted occurrences, provider effects, host selection, response arrays, recurrence and rescheduling adapters. Happy-path count assertions exist (`RecurringBookingService.test.ts:164`), but N8 limits confidence. First prerequisite for a separate analysis: characterize persisted/returned occurrences after a later failure, including the first round-robin branch. Potential impact and change cost are high; frequency and desired semantics are unknown. **Rejected as a refactor solution; stop here without designing rollback or compensation.** N1 remains a separate behavior issue, not an automatically approved prepend fix.

### C7 — Explicit query projections

**Evidence — current shape and correction.** Creation's top-level `include` at `packages/features/bookings/lib/handleNewBooking/createBooking.ts:104` contains a nested user `select` limited to uuid/email/name/timeZone/username/isPlatformManaged (`:106`), plus attendees/payment/references (`:115`). API `getByUidWithAttendeesAndUserAndEvent` includes full attendees/user/eventType at `apps/api/v2/src/platform/bookings/2024-08-13/repositories/bookings.repository.ts:154` and spreads the result at `:164`. These are not the identical broad user/eventType shapes implied by R:198. The API repository already uses a named selected projection in another method (`:188`–`:191`); equivalence to the needed creation output is unestablished. Neither inspected query establishes credential-key exposure.

**Evidence — history.** The helper projection was retained in `5f8d090d3c4` (#15612); broad API includes derive from `0eabe7f28bc` (#16200). Blame attributes later eventType inclusion to `a10d3599e2e` (#16319), but that patch was not inspected, so no rationale is inferred from it.

**Intentionality verdict: unknown necessity.** Current convention favors `select`; inspected history does not explain why these broad projections are required. Overfetching magnitude and performance/security impact are **unknown**.

**Inference — feasibility.** Adequate target shape: **explicit consumer-owned typed projections**. Audit direct and spread-based consumers, define the intended fields, then convert one query at a time using the established selection pattern. Preserve outward fields and nested-write outputs; the two projections need not match. Each query conversion is reversible and needs no schema change. Blast radius is low/medium but inferred return types and spreads can propagate into shared responses/API mapping. Type checks and existing output assertions help; optional-field compatibility needs characterization. First prerequisite: a field-consumer inventory and result-shape assertions. This is a viable bounded alternative with clear convention benefit, but not a proven urgent data leak or measured performance win.

### C8 — Domain errors and transport translation

**Evidence — current shape and correction.** API generic errors remain at `apps/api/v2/src/platform/bookings/2024-08-13/services/bookings.service.ts:480`/`:485`; seats throw HttpError at `packages/features/bookings/lib/handleSeats/create/createNewSeat.ts:64`/`:72`. The generic event-not-found fallback at `packages/features/bookings/lib/handleNewBooking/getEventTypesFromDB.ts:212` follows `findUniqueOrThrow` at `:204`; it is not the normal missing-row branch. Existing `packages/lib/server/getServerErrorFromUnknown.ts` recognizes ErrorWithCode (`:88`), HttpError (`:97`) and generic Error (`:108`), maps code or message (`:127`), and maps P2025 (`:207`). Web uses it through `packages/lib/server/defaultResponder.ts:63`; API registers separate filters at `apps/api/v2/src/bootstrap.ts:72`. Its HTTP filter catches Nest HttpException (`apps/api/v2/src/filters/http-exception.filter.ts:9`), not automatically every shared domain error.

**Evidence — history.** API generic failures trace to `bd4a949a7c0` (#17045). Seat HttpError came with `be4bb3fcde8` (#27389), whose purpose was fresh-state/TOCTOU validation. `c28eb90928b` (#21264) moved the event fallback during a Prisma upgrade and removed an older string-matching catch; it did not originate that fallback.

**Intentionality verdict:** seat state freshness is a **conscious constraint**; the exact class split's rationale is **unknown**. Accumulation over time is **inference**. Existing translation disproves any blanket assertion that mapping is missing.

**Inference — feasibility.** Adequate target shape: **domain-coded errors with explicit adapter translation**. Build a bounded throw-to-status/message/data/cause table, characterize web/API outputs, then convert one path and its adapters. Reuse the web mapper; complete API parity is unknown. Changes are reversible per path, but small syntax edits can have medium/high compatibility impact across callers and redaction/reporting. Seat/API assertions provide partial coverage, not parity for every selected error. First prerequisite: characterize that mapping table. Repository-wide class replacement is rejected; preserving working status/message behavior costs more than a mechanical replacement suggests.

### C9 — Prisma dependency assertion

**Evidence — current shape and correction.** The double assertion is at `apps/api/v2/src/lib/services/regular-booking.service.ts:32`. `PrismaWriteService` imports the native client at `apps/api/v2/src/modules/prisma/prisma-write.service.ts:1` and explicitly types its property in the class declaration; shared dependency `packages/features/bookings/lib/service/RegularBookingService.ts:425` requires PrismaClient. `packages/prisma/index.ts` reexports the native client and separately documents extension-related typing workarounds. AGENTS explicitly prohibits `as any`; it does not expressly prohibit every `as unknown as` expression. R:200's blanket rule-violation claim is therefore too strong. The assertion still bypasses direct assignability checking.

**Evidence — history.** `3bcce02b92e` (#23156) introduced the cast with Nest integration/import changes. Its inspected patch does not explain an actual incompatibility.

**Intentionality verdict: unknown.** Bridge injection is deliberate; necessity of this cast is not established. **Inference:** it may now be redundant, but matching-looking source types do not prove compilation in both project contexts.

**Inference — feasibility.** Adequate target shape: **directly assignable Prisma dependency contract**. First prerequisite in an implementation session: compile the assignment without the assertion and inspect any actual diagnostic. If redundant, removal is a tiny reversible cleanup; if not, identify the concrete incompatible operation/type before considering a narrower contract. Blast radius is low locally, potentially medium across Nest/platform packaging if a contract change is necessary. Shared/API type checks are the shield; transpiled API E2E is not a substitute. No runtime mismatch or need for a new general database abstraction is established. Defer broad redesign.

### C10 — Watchlist composition cycle

**Evidence — current shape.** `packages/features/di/watchlist/containers/SpamCheckService.container.ts:5` imports the broad container and creates a fresh spam service at `:10`. The container imports admin operations at `packages/features/di/watchlist/containers/watchlist.ts:16`, initializes/loads services at `:36`–`:49`, exposes blocking getters (`:55`, `:59`), a facade getter (`:79`) and admin factories (`:83`, `:110`). The return path is `packages/features/watchlist/lib/service/AdminWatchlistOperationsService.ts:1` → `packages/features/auth/lib/verifyEmail.ts:10` → `packages/features/watchlist/operations/check-if-email-in-watchlist.controller.ts:1` → the original container. Existing interfaces and separate getters provide an extraction seam. The cycle establishes module coupling, not execution of admin methods during booking.

**Evidence — history.** `424d94f16d2` introduced verification's blocking-controller import. `50c7210d6b6` (#27923) added the reverse auth import to unlock SIGNUP-blocked users and send verification after removal, covering single/bulk paths and `unlockSignupUser` (current admin service `:117`, `:148`, `:214`, `:218`).

**Intentionality verdict:** removal → unlock → verification is **conscious behavior**; the cyclic wiring is **accidental-complexity inference**. No inspected rationale requires blocking consumers to load administrative verification composition. Runtime failure frequency/loading cost are **unknown**.

**Inference — feasibility.** Adequate target shape: **acyclic blocking composition separated from administration/verification composition**. Reuse blocking/service interfaces and separate accessors, migrate blocking consumers through a narrow composition boundary, then migrate remaining accessors without leaving a reverse dependency. Preserve initialization, service lifetimes, fail-open and unlock/verification order; individual consumer changes are reversible. Blast radius is medium across booking checks, verification, controllers and admin operations; no schema or product-policy change is inherent.

**Evidence — shields and constraints.** Admin tests mock verification and Prisma (`packages/features/watchlist/lib/service/AdminWatchlistOperationsService.test.ts:5`, `:9`), so they do not prove real module initialization. N3's wrong-instance spy (`spam-booking.integration-test.ts:365` versus the factory at `SpamCheckService.container.ts:10`) is not reliable fail-open coverage. The current container also contains a permissive local permission-check stub (`watchlist.ts:29`); a structural move must not be described as validation of administrative authorization.

**Inference — first prerequisite/cost.** Correct the failure-injection seam with an assertion that the failing check ran, and characterize real composition initialization with controlled backend effects. Preserve an assertion for SIGNUP unlock followed by verification. Moderate change cost and a concrete removable cycle support this opportunity; changing authorization, fail-open or email policy is outside it.

## Synthesis constraints and unresolved evidence

**Inference.** C1 and C4 overlap: isolating a dependency can reduce orchestration cost, but their benefits should not be counted twice. C2 and C3 overlap at result typing; typing existing outcomes does not choose new API behavior. C5 may require localized C8-style error translation when query ownership moves; that does not justify standardizing unrelated errors. C7 can proceed independently once consumed fields are known. C6 cannot be made safe merely by selecting one of these refactors.

**Evidence inherited from R:169–185.** SQL triggers and separate projections extend listing impact beyond TypeScript imports. Historical privacy/calendar/mail changes (`851aa30829c`), reschedule-policy changes (`b46fb82695a`), paid completion (`4585d7402d7`) and webhook compatibility (`3a7122d613b`) demonstrate coordinated contracts, not mandatory edits for every refactor. The webhook assignmentReason distinction and requested-webhook update order are constraints to preserve. No new schema/generated-file work is justified by this research.

**Unknowns for later planning:** production frequency/severity, deployed API spam reachability, complete retry/compensation behavior, replica topology and deployed trigger state, actual suite outcomes, and external review rationale. More local inspection could resolve exact projection field consumers and a compliant C5 slice size; these are named prerequisites rather than guessed answers. C3's bounded direct-consumer check is recorded above. The report is complete as an exploration of the recorded opportunities, not a claim that implementation is unblocked.

**Verification of this artifact.** The inventory reconciles R's twelve debt entries and six action items, including items outside those headings, with candidate/noncandidate findings above. Parent checks qualified the prior projection, type-assertion and error-mapping claims. All three delegated tracks completed; historical assertions are scoped to inspected patches or explicitly identified blame. Evidence, inference and unknowns were reviewed separately. The only intended writes are this report and the skill's narrow change-metadata transition; no application files or prior research are changed.

## Refactor opportunities

This ranking is an **inference and proposal for the later planning session**, not a decision to implement. It weighs demonstrated structural burden against migration surface and available shields. It does not rank production severity, for which telemetry is unknown. The order below is review priority, not a dependency requirement between unrelated candidates.

### 1. C10 — Separate blocking composition from administrative verification

**Current → target:** a shared container closes the blocking/admin/verification value cycle → acyclic blocking composition, with administrative verification composed separately.

**Why this place:** the cycle has precise source/history evidence, while existing accessors/interfaces give a bounded route to removal without changing booking or signup concepts. Its likely change cost is moderate and smaller than moving the large listing query. The debt is forced module coupling, not a demonstrated incident. Trade-off: composition/lifetime mistakes can affect both booking and verification; mocked admin tests are insufficient on their own. Evidence and constraints: C10 above, especially `watchlist.ts:16`, `:36`, `:55`, `:83`, and `50c7210d6b6`.

**Blast radius:** booking spam checks, verification controller, watchlist composition and admin single/bulk unlock flows. **Incremental path:** characterize existing behavior → separate the narrow composition using existing interfaces → migrate blocking consumers → migrate remaining composition accessors and verify the cycle is gone; retain behavior throughout and keep each consumer migration revertible. **First prerequisite:** repair N3's failure injection and add real composition-initialization characterization, preserving unlock→verification assertions. No fail-open or permission-policy change is proposed.

### 2. C5 — Give listing queries transport-independent ownership

**Current → target:** shared feature helper calls a query housed in its consuming tRPC handler → transport-independent listing query consumed by thin adapters.

**Why this place:** a concrete layer violation affects shared web/API retrieval and conflicts with an explicit repository rule. Existing explicit dependencies make extraction plausible. It ranks below C10 because the query is large, carries schema/error dependencies and has SQL/access semantics insufficiently protected by the current mocked tests. Trade-off: strong ownership improvement at higher characterization and PR-splitting cost; merely relocating the whole file would not resolve transport coupling. Evidence: `getAllUserBookings.ts:6`, `get.handler.ts:93`, `:104`, `:160`, C5 history and shields above.

**Blast radius:** web/API listing, authorization/filter/pagination results, denormalized-data hydration and transport error mapping. **Incremental path:** characterize representative query results and initialization → establish transport-neutral input/error boundaries → extract appropriately sized query/helper slices without optimizing SQL → redirect the feature/API adapters and remove the reverse edge. Each slice should preserve output and be independently revertible. **First prerequisite:** database-backed access/filter/pagination characterization; before implementation approval, prove a slice breakdown within the repository's PR-size limits. No schema or authorization-policy redesign is proposed.

### 3. C7 — Make booking query projections explicit

**Current → target:** top-level includes with implicit scalar/relation result shapes → explicit consumer-owned typed selections for creation and API reload separately.

**Why this place:** the projection convention is explicit, the affected queries are concrete and a local selected-projection pattern already exists. The benefit is visible data-contract ownership and potentially less fetching, at lower migration cost than orchestration or adapter semantics. It ranks behind the cycles because creation already restricts user fields and no leak or performance impact has been measured. Trade-off: result spreads and inferred types make field removal a compatibility change, so copying an existing select without a consumer audit is unsafe. Evidence: `createBooking.ts:104`, API `bookings.repository.ts:154`, `:164`, `:191`, and C7 above. C3's direct-consumer check supports preferring this concrete query boundary over interface-only tightening.

**Blast radius:** creation result consumers and API reload/output formatting, including inferred types and optional response fields; no schema migration is inherent. **Incremental path:** audit direct/spread consumers → record required result fields → introduce a typed select for one query → verify equivalent externally required output → convert the other query in a separate reversible slice. Reuse the existing projection pattern, not necessarily its exact field set. **First prerequisite:** the field-consumer inventory and characterization assertions, with particular attention to spread-based output. This does not authorize dropping externally visible fields or claim a repaired security leak.

### Considered but not selected for the shortlist

| Candidate | Disposition and trade-off |
| --- | --- |
| C1 | **Defer broad orchestration extraction.** High potential debt and high compatibility cost; specific effect ordering is load-bearing and recovery goals are unknown. A narrowly characterized block may become worthwhile after C4, but extraction alone does not repair consistency. |
| C2 | **Defer adapter-contract change.** Internal typing is viable, but the strongest claimed fix changes external API/security behavior. Characterize reachability and mapping before a separate decision. |
| C3 | **Defer interface-only tightening.** History acknowledges debt, but the bounded consumer search identifies declaration/implementation uses rather than separately typed callers. Require a concrete enforcement benefit before prioritizing it; independent result ownership is a larger separate change. |
| C4 | **Reserve as a focused enabling refactor.** Injecting a selected factory/helper has concrete value, but it should serve a named isolation problem rather than start a general persistence rewrite. Both EventManager contexts and transaction semantics must be protected. |
| C6 | **Reject as a structural remedy.** Partial-series semantics require business-contract analysis. Neither rollback nor compensation is selected; N1 is separate correctness work. |
| C8 | **Reject blanket standardization; defer bounded paths.** Existing mappings work across multiple classes. Status/message/cause compatibility and API filter parity must precede class changes; localized work may accompany C5. |
| C9 | **Treat as possible small cleanup, reject broad redesign.** No demonstrated type incompatibility or runtime defect; compiler evidence should determine whether the cast is redundant. |

N1–N18 remain behavior issues, constraints or prerequisites, not silently discarded findings or additional approved work. No implementation choice has been made by this ranking.
