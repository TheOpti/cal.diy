---
title: Isolate recurrence-library semantics behind a recurrence anti-corruption layer
created: 2026-10-24
type: refactor-plan
---

# Recurrence anti-corruption layer

## Decision and scope

**Choose the recurrence-library leak:** `rrule` currently shapes recurrence contracts, stored JSON validation, occurrence generation, display and integration serialization. Introduce a domain-owned `RecurrencePattern`, a narrow recurrence port, and one server-only ACL containing vendor conversion and compatibility codecs. UI receives occurrence data and labels rather than constructing library objects.

This is a plan, not an implementation. Source references were verified against HEAD `856cbf7eee15d34cfeb7f9ce8ae314a220bce913`. Proposed names and paths below are explicitly prospective. No production files, dependencies or schemas were changed; no test or production bundle was run.

The investigation starts broadly from manifests, architectural rules and shared calendar types, then compares four external calendar/scheduling dependencies. The ranking is **within that discovered boundary**, not a claim that recurrence has more imports than Prisma, React, Zod or Day.js across the entire monorepo. Those foundational technologies are visible in manifests and shared contracts, but a complete ORM/framework replacement is a separate programme. Appendix A contains every direct importer/mock found for each shortlisted dependency, plus declarations/build wiring; Appendix B records the wider recurrence search results rather than hiding consumers behind a small sample.

## 0. Discovery

### Product and architectural intent

No product-wide PRD or tech-stack document was found in root, `context/foundation/`, `docs/` or `specs/`. The root README describes a “scheduling platform” (`README.md:16`) intended for “individuals and self-hosters who want full control over their scheduling infrastructure” (`README.md:43`). Existing cancellation requirements and the earlier domain documents establish booking/recurrence vocabulary but do not promise that a particular recurrence engine can be swapped.

There **is** an explicit replaceability statement for a different capability: Tasker can be “extended or replaced with third-party services” (`packages/features/tasker/README.md:25`). That is evidence of an intended task-execution boundary, not evidence that recurrence already has one. Do not misattribute this statement to calendar libraries.

The applicable general rule is stronger than an informal preference: “Use DTOs at Every Architectural Boundary” (`agents/rules/data-dto-boundaries.md:7`), with layer transformations at `:63` and string-literal unions to stay ORM-agnostic at `:77`. The document specifically discusses database coupling; applying the same isolation goal to a recurrence vendor is an architectural inference, not a newly discovered vendor-replaceability requirement. Today `RecurringEvent.freq` is directly typed as the external library's `Frequency`, and persistence validation deliberately mirrors its options. That is the concrete boundary mismatch.

### Stack, dependencies and layers

| Area | Verified manifest/source evidence |
|---|---|
| Monorepo and tooling | Yarn `4.12.0` (`package.json:234`), Turbo (`:120`), TypeScript (`:121`), Biome (`:92`), Vitest (`:122`), Playwright (`:97`). |
| UI/API | Next.js `16.2.3`, NextAuth `4.24.13`, React `18.2.0` (`apps/web/package.json:110`, `:111`, `:123`); NestJS API v2 (`apps/api/v2/package.json:55`); tRPC routers under `packages/trpc/server/routers/`. |
| Persistence | PostgreSQL (`packages/prisma/schema.prisma:5`), Prisma (`packages/prisma/package.json:32`); `EventType.recurringEvent` is JSON (`packages/prisma/schema.prisma:214`). |
| Relevant external libraries | `rrule` `2.7.1` (`packages/lib/package.json:28`), `ics` `2.37.0` (`:24`), `ical.js` `1.5.0` (`:23`), `@googleapis/calendar` `9.7.9` (`packages/app-store/googlecalendar/package.json:10`). |
| Other external foundations inspected | Day.js via workspace wrapper (`packages/dayjs/package.json:8`), Stripe `9.16.0` (`apps/web/package.json:146`), Zod (`:150`), localization (`:113`). This is the relevant dependency list, not a reproduction of every app-store manifest. |
| Business/application code | Booking orchestration in `packages/features/bookings/`; occurrence expansion in `packages/lib/parse-dates.ts:79`; calendar links in `packages/features/bookings/lib/getCalendarLinks.ts:138`. |
| Presentation | Browser components under `apps/web/modules/`, shared booking form mapping under `packages/features/bookings/lib/client/`, email rendering under `packages/emails/`. Email React rendering is not automatically browser execution. |
| Provider adapters | Google calendar and Salesforce packages; calendar feed parsing in `packages/app-store/ics-feedcalendar/`; generic calendar service in `packages/lib/CalendarService.ts`. |

## 1–2. Identify, classify and select

Counts include tests/mocks but exclude package declarations and build wiring, listed separately in Appendix A. Runtime versus type-only imports are differentiated there. “Layers” describes responsibilities, not merely different directories.

| Candidate | Direct files / spread | Replacement risk and leakage | Declared replaceability | Priority |
|---|---|---|---|---|
| **`rrule`** | **8 files**: 6 runtime consumers, 1 shared type declaration, 1 test; reaches application helpers, presentation, integrations and shared contracts. Wider vocabulary search finds 54 files. | **Very high semantic cost:** vendor-shaped recurrence JSON, duplicated numeric frequencies, browser-side expansion, independent serializers and normalization. Replacing it can change actual appointment times and provider recurrence while still type-checking. | No vendor-specific promise. General DTO separation conflicts with the exposed `Frequency` type and mirrored options. | **#1 within scheduling/calendar boundary.** Smaller direct count than Google, but greater contamination of core business representation and stored meaning. |
| `@googleapis/calendar` | **12 files** across provider/auth, API services, subscription adapter, shared type and tests. | **High:** `calendar_v3.Schema$CreateConferenceRequest` appears in shared `ConferenceData` (`packages/types/Calendar.d.ts:127`); API services instantiate/use the provider SDK. Much usage is legitimately provider-specific. | No provider-swap promise found. Existing subscription adapter is a partial boundary, not proof all shared types are neutral. | #2: isolate shared conference DTOs and auth/service access in a separate plan. |
| `ics` | **7 files** across calendar infrastructure, booking-link helper, email signatures and tests. | **Medium–high:** `EventStatus`, `ParticipationStatus`, `DateArray` and manual UTC array conversion escape into caller code (`packages/emails/lib/generateIcsString.ts:2`, `:39`, `:57`). Link helper is imported from client view code. | No specific promise found. | #3: output encoding is comparatively bounded, although recurrence serialization overlaps I1. |
| `ical.js` | **3 direct import files**, plus one ambient declaration; calendar feed/parsing infrastructure and shared types. | **Medium:** shared `recurrenceId: Time` (`packages/types/Calendar.d.ts:108`) leaks parser-specific representation. Two service implementations depend on it. | No specific promise found. | #4: parser-result DTO and adapter extraction; narrower than recurrence generation. |

These are observed leaks, not a declaration that every library import is wrong. A Google adapter is expected to know Google. A shared recurrence DTO and browser form mapper should not need to know a chosen recurrence engine's constants or Date conventions.

## 3. Diagnosis of the chosen leak

### Reconstructed objects and duplicated semantics

| Location | Verified quote / construction | Boundary consequence |
|---|---|---|
| Shared domain-like contract | `import type { Frequency } from "rrule"` (`packages/types/Calendar.d.ts:5`); `freq: Frequency` at `:134`. | Library type escapes into `RecurringEvent`, consumed throughout application/UI/email code. Type-only import alone does **not** put runtime code in a browser. |
| Persistence validation | “Matching RRule.Options” (`packages/prisma/zod-utils.ts:233`); `freq: z.nativeEnum(Frequency)` at `:239`. | Stored shape is intentionally coupled to options rather than a domain-owned recurrence contract. |
| Reconstructed enum | `YEARLY = 0` through `SECONDLY = 6` (`packages/prisma/zod-utils.ts:81`); a separate smaller `Frequency` enum starts at `packages/platform/enums/event-types/frequency.ts:1`. | Multiple layers encode numeric recurrence meanings without importing the original package. An import-only grep misses this leakage. |
| Browser/shared expansion | `const rule = new RRule({` (`packages/lib/parse-dates.ts:99`), `count: recurringCount` (`:101`), `dtstart: new Date(dayjs(startDate).valueOf())` (`:102`). | Shared formatting helper also owns recurrence execution and overrides stored count/start. Its callers inherit the dependency. |
| Time correction | “UTC still need to have DST applied, rrule does not do this.” (`packages/lib/parse-dates.ts:106`); offsets adjusted at `:109`. | Library/time interpretation is outside an adapter. This comment is a local assumption, not an authoritative statement that the library lacks timezone support. |
| Form command generation | “turn one single booking into an array of multiple bookings” (`packages/features/bookings/lib/client/booking-event-form/booking-to-mutation-input-mapper.tsx:99`); expansion at `:107`, `start`/`end` built at `:122`. | Browser calculation helps define submitted appointments, not just their labels. No claim here that the server fails every recurrence-consistency check; that requires a separate command audit. |
| Email labels | `new RRule(recurringEvent).options` (`packages/emails/src/components/WhenInfo.tsx:23`), followed by `count: rruleOptions.count || 1` at `:26`. | Rendering reconstructs and normalizes vendor options just to label a recurrence. |
| Email calendar serialization | `new RRule(event.recurringEvent).toString().replace("RRULE:", "")` (`packages/emails/lib/generateIcsString.ts:68`). | Caller knows vendor serialization and another library's expected string shape. Removing a prefix does not by itself prove the result is a single recurrence property when a start property is included. |
| Calendar link | `encodeURIComponent(new RRule(recurringEvent).toString())` (`packages/features/bookings/lib/getCalendarLinks.ts:78`). | Link generation constructs a vendor object; parameter accepts `RecurringEvent` **or** `Prisma.JsonObject` at `:14`, bypassing one clear domain conversion boundary. |
| Google adapter | Rebuilds only `freq`, `interval`, `count` (`packages/app-store/googlecalendar/lib/CalendarService.ts:220`); assigns `rule.toString()` at `:226`. | Unlike other callers, this projection does not pass `until`, `dtstart` or `tzid`. This is a proven projection difference, not proof every omission violates Google's event contract. |
| Salesforce adapter | `Recurrence2PatternText: new RRule(event.recurringEvent).toString()` (`packages/app-store/salesforce/lib/CrmService.ts:333`, `:445`). | Two operations duplicate serialization and use a different input projection from Google. |
| API mappings | `freq: Frequency[recurrence.frequency ...]` (`apps/api/v2/src/platform/event-types/event-types_2024_06_14/transformers/api-to-internal/recurrence.ts:11`); reverse numeric lookup in `internal-to-api/recurrence.ts:10` in the same transformers directory. | Versioned public API already exposes semantic strings; preserve that contract and move legacy numeric interpretation behind the ACL. |

### Proven browser path, and what is not proven

`apps/web/modules/bookings/views/bookings-single-view.tsx:1` declares `"use client"`, imports `getCalendarLinks` at `:25` and calls it at `:182`. That helper imports `rrule` at `packages/features/bookings/lib/getCalendarLinks.ts:3`. This is a runtime dependency path into a client module, not merely an erased type dependency.

The occurrence component imports `parseRecurringDates` (`apps/web/modules/bookings/components/event-meta/Occurences.tsx:6`) and calls it at `:62`; the booking mutation mapper calls it at `:107`. The platform atom hook also imports that mapper (`packages/platform/atoms/hooks/bookings/useHandleBookEvent.ts:5`). Thus changing only the obvious package import sites would leave application contracts and browser responsibilities coupled.

The library supports browser use; its presence there is **not evidence of a server secret leak or a server-only SDK violation**. The demonstrated risk is duplicate semantic execution and replacement impact. No production bundle was built, so exact emitted bytes/tree-shaking and any unrelated server package pulled by those helpers remain unmeasured.

## 4. ACL design

### Ownership: one boundary, two responsibilities

Proposed directory: `packages/lib/recurrence/`, containing domain-neutral contracts plus a server-only `acl/` implementation. This avoids making foundational packages depend on feature/tRPC packages. The pure value object is the sole owner of recurrence normalization and domain operations; **only the ACL adapter knows the vendor's object/type shape**. Giving the domain object a public `toRRule()` would recreate the leak and is expressly excluded.

Proposed structure (new paths, not current-source references):

```text
packages/lib/recurrence/RecurrencePattern.ts       pure immutable domain value
packages/lib/recurrence/RecurrencePort.ts          narrow interface
packages/lib/recurrence/acl/RecurrenceCodec.ts     legacy DB/API compatibility
packages/lib/recurrence/acl/RecurrenceAdapter.ts   vendor construction/conversion
packages/lib/recurrence/acl/composition.ts        server-only factory
packages/lib/recurrence/acl/*.test.ts             vendor contract fixtures
packages/lib/dto/RecurrenceDto.ts                 validated transport projections
```

DTO location follows `agents/rules/data-dto-boundaries.md:69`. Imports are direct source paths, without new barrel exports. API v2 uses the existing platform-library bridge rather than importing features directly. That bridge exposes neutral contracts only, never vendor types. No new package/dependency is required merely to introduce this boundary.

```typescript
// Proposed signatures; all types are owned by Cal.diy.
type RepeatUnit = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";
type RecurrenceStart = Readonly<{ localDateTime: string; timeZone: string }>;
type RecurrenceEnd = Readonly<{ maxOccurrences: number; throughInstant?: string }>;

class RecurrencePattern {
  static create(input: RecurrenceDefinition): RecurrencePattern;
  definition(): Readonly<RecurrenceDefinition>;
  withStart(start: RecurrenceStart): RecurrencePattern;
  withOccurrenceLimit(count: number): RecurrencePattern;
  describe(): RecurrenceDescription; // unit, interval, count; no library-generated text
}

interface RecurrencePort {
  expand(pattern: RecurrencePattern, request: ExpansionRequest): Promise<OccurrencePage>;
  calendarProperties(pattern: RecurrencePattern): CalendarRecurrenceProperties;
}
type OccurrencePage = Readonly<{
  startsAt: readonly string[]; // real ISO UTC instants
  truncated: boolean;
}>;
type CalendarRecurrenceProperties = Readonly<{
  startProperty?: string;
  ruleValue: string; // standard iCalendar property VALUE, no property name
}>;

// All vendor conversion and legacy numeric interpretation stays inside ACL.
class RecurrenceCodec {
  fromStored(value: unknown, context: RecurrenceContext): RecurrencePattern | null;
  toStored(pattern: RecurrencePattern | null): JsonValue;
  fromLegacyApi(value: unknown, version: ApiVersion, context: RecurrenceContext): RecurrencePattern;
  toLegacyApi(pattern: RecurrencePattern, version: ApiVersion): JsonValue;
}
```

The semantic vocabulary supports the stored seven-unit range even though some UIs/APIs expose only week/month/year; do not silently narrow historical data to the editor's subset. Validation requires finite positive integer interval/count, valid timezone/start and supported fields. Malformed/unsupported stored data throws a named `InvalidRecurrenceDefinition` or `UnsupportedRecurrenceDefinition` extending `ErrorWithCode`; it is never silently turned into a single event. Null still means non-recurring. Legacy zero/default values must be characterized and either explicitly normalized by a documented codec rule or rejected with a repair report before rollout.

`maxOccurrences` bounds generation; an optional through-instant adds a cutoff. Existing count/until coexistence and inclusivity must be characterized rather than erased by a simplified union. Expansion requests also have a finite page/output cap; no unbounded whole-series materialization is exposed. Unknown configuration is not repaired by caller-side truthiness defaults.

### Adapter pseudocode

```text
expand(pattern, request):
  validate bounded request and pattern
  options = toVendorOptions(pattern)          // private: numeric enum, Date, timezone
  try:
    generated = vendor iterator with finite output and search bounds
    instants = convertVendorDatesToTrueInstants(generated, explicit zone context)
    return { startsAt: instants, truncated: explicit result }
  catch cause:
    throw RecurrenceExpansionFailed(cause)    // do not return [] as success

calendarProperties(pattern):
  options = toVendorOptions(pattern)
  serialized = vendor serialization
  parse serialized properties inside ACL
  require exactly one supported recurrence rule; preserve explicit start separately
  return domain-owned startProperty/ruleValue strings

codec.fromStored(json, context):
  validate legacy record with Zod
  map historical numeric values to semantic RepeatUnit using owned versioned table
  resolve anchor/zone from explicit stored values, then server event context
  return RecurrencePattern.create(normalized definition)
```

Standard iCalendar syntax is an interoperability contract, not ownership of the `rrule` package. Provider callers may attach the returned rule value to a provider request, but do not parse vendor `.options`, add vendor defaults, strip arbitrary vendor serialization or reconstruct a vendor rule. Provider-specific projection remains explicit: e.g. choosing the event's separate start field rather than a recurrence `startProperty` belongs to the provider integration and is covered by contract fixtures.

### Persistence and API compatibility

Keep the current JSON column and legacy numeric field encoding. The codec owns a fixed historical mapping and writes the existing representation; no table migration is required. After isolation those numeric values are a **versioned Cal.diy storage contract**, not whatever constants a replacement library happens to use. Repository hydration invokes `fromStored`; application operations use `RecurrencePattern`; repository persistence invokes `toStored`.

Keep existing public API versions and payload fields. Version-specific API adapters delegate numeric/legacy conversion to ACL codecs; the API layer must not infer recurrence semantics via enum reverse lookup. The existing v2 semantic `frequency`/`occurrences` names remain stable. A replacement library later changes only the concrete adapter and dependency wiring, not this historical codec or wire schema.

Do not edit generated Prisma/Kysely files directly. Update the source schema/type hooks to reference the owned validation contract and regenerate through existing commands if needed. Keeping a compatibility export of the old schema name temporarily is acceptable only if it forwards to the owned validator and exposes no vendor type.

### UI receives prepared data

```typescript
// Proposed JSON DTO, validated at the boundary, no Date/library instances.
type RecurrenceForPreviewDto = {
  description: { unit: RepeatUnit; interval: number; occurrences: number };
  occurrences: { startsAt: string; displayLabel: string; offsetChanged: boolean }[];
  calendarLinks: { kind: string; href: string }[];
  truncated: boolean;
};
```

The browser submits selected start, timezone, requested count and event identity to a bounded preview operation. The server loads the pattern, calls the port and formats ready display data. The UI may translate semantic description tokens but must not evaluate recurrence or consume legacy numeric frequencies. On submit, the server recomputes/validates the occurrence series from authoritative event data; preview output is not an authorization token.

Preserve public recurring-booking payloads where compatibility requires arrays of dates: validate those arrays against server expansion rather than silently trusting them. Internal clients can use the prepared preview data during transition; server-side comparison closes stale/tampered preview risk. Existing scheduling/availability validation still applies to each resulting occurrence. Preview responses need cancellation/request sequencing to avoid displaying stale results after timezone/count changes.

## 5. Library contract decisions and isolation proof

### Documentation resolved, not guessed

The installed manifest version is `2.7.1`; the version-pinned primary README was read. The following library-derived summary is intentionally concise:

| Verified contract | Decision encoded in ACL |
|---|---|
| The library has floating/UTC conventions and TZID support; returned Dates require careful interpretation. | Explicit zone context; conversion to actual instants stays in the adapter. Do not treat a zero-offset Date as sufficient evidence of an instant. |
| `options` contains processed defaults; `origOptions` preserves supplied inputs. | Domain defaults are explicit; renderers never derive business defaults from processed vendor options. |
| Serialization can contain both DTSTART and RRULE properties. | Return parsed, separate properties; never use a general string replacement as the conversion contract. |
| Unbounded rules can produce infinite series; retrieval supports stopping iteration. | Require finite request limits and bounded iteration. |
| An occurrence matching `until` is included. | Preserve inclusive cutoff in adapter contract tests. |

Source: [rrule v2.7.1 README](https://raw.githubusercontent.com/jkbrzt/rrule/v2.7.1/README.md). These facts resolve library mechanics, not product intent about wall-clock recurrence. The existing manual DST correction is not proven correct or incorrect solely by reading documentation.

For ICS generation, the primary project documentation describes `recurrenceRule` as an iCalendar rule value. Keep this handoff separate from start/date encoding and verify it against the installed version before migration. [ics documentation](https://raw.githubusercontent.com/adamgibbons/ics/master/README.md). This source is unpinned; installed-version tests, not current documentation alone, are the acceptance authority.

**Product decision that documentation cannot settle:** should a weekly meeting preserve organizer local wall time across DST or a fixed elapsed UTC time? Proposed domain contract uses explicit local start plus timezone. First characterize current supported behavior, preserve it through an ACL compatibility mode if necessary, and obtain scheduling-owner approval for any deliberate semantic change. Missing timezone must be resolved from authoritative event/schedule context or rejected; never depend on the server/browser machine timezone. The decision is recorded in `RecurrencePattern`/codec contracts and adapter fixtures, not duplicated in API handlers.

### Replacement impact after migration

| Surface | Replace recurrence engine afterward | Proof obligation |
|---|---|---|
| `EventType.recurringEvent` table/JSON | No change. | Existing stored fixtures round-trip with stable historical numeric meanings. |
| Existing public API versions | No change. | Request/response golden fixtures unchanged, including string frequency API. |
| Browser UI / platform atoms | No change. | Depend on semantic DTO/preview contract; no path to concrete adapter or vendor runtime. |
| Booking application services | No change. | Depend only on `RecurrencePort`/pattern; fake adapter passes application contract tests. |
| Email and provider integrations | No change to recurrence business behavior. | Receive neutral descriptions/instants/calendar properties; consume stable output contract. |
| Concrete implementation | Adapter and its implementation-specific tests change. | A second implementation passes the same expansion/serialization contract suite. |
| Package/build wiring | Dependency declaration/lockfile may change. | This necessary operational change is acknowledged; “adapter-only” means semantic consumers and public contracts, not literally zero manifest edits. |

This is a proposed proof strategy, not a claim the repository is isolated today. A fake adapter proves dependency direction; equivalence fixtures and a real alternate implementation are needed to prove replacement compatibility. Replacing the entire iCalendar protocol or changing product recurrence semantics is outside this promise.

### Before / after migration ledger

| Current place | Before | After |
|---|---|---|
| `packages/types/Calendar.d.ts:5`, `:130` | Vendor Frequency in shared recurrence contract. | Owned semantic recurrence DTO/pattern contract, no vendor type. |
| `packages/prisma/zod-utils.ts:81`, `:233` | Mirrored numeric enum and options schema. | Legacy mapping/validation delegates to codec; temporary neutral compatibility export if required. |
| `packages/platform/enums/event-types/frequency.ts:1` and API recurrence transformers | Duplicate numeric interpretation. | Keep public semantic labels, delegate legacy conversion to ACL. |
| `packages/lib/parse-dates.ts:99` | Expansion mixed with formatting and DST correction. | Formatting uses prepared instants; expansion/conversion only in adapter. |
| `apps/web/modules/bookings/components/event-meta/Occurences.tsx:62` | Client expands recurrence for preview. | Render bounded preview DTO and offset-change information. |
| Booking mutation mapper `packages/features/bookings/lib/client/booking-event-form/booking-to-mutation-input-mapper.tsx:107` | Generates submitted series with library-shaped event. | Consumes prepared data/intent; server authoritative series validation. |
| `packages/emails/src/components/WhenInfo.tsx:23` | Reconstructs library to discover defaults for a label. | Uses `pattern.describe()` projection; renderer only formats/translates. |
| `packages/emails/lib/generateIcsString.ts:68` | Constructs/strips serialization. | Receives standard rule value from port; ICS adapter handles ICS-specific formatting. |
| `packages/features/bookings/lib/getCalendarLinks.ts:78` | Constructs recurrence in helper reachable from browser. | Server prepares links from neutral recurrence properties; browser receives hrefs. |
| `packages/app-store/googlecalendar/lib/CalendarService.ts:220` | Selects three fields and constructs vendor object. | Explicit provider projection from neutral calendar properties, tested for count/cutoff/zone preservation. |
| `packages/app-store/salesforce/lib/CrmService.ts:333`, `:445` | Repeated vendor serialization. | Both operations consume one neutral serialization contract. |
| `packages/features/bookings/lib/getCalendarLinks.test.ts:3` | Test knows vendor to construct expected results. | Test neutral output fixtures/port; vendor-specific expectations move into ACL tests. |
| Wider consumers in Appendix B | Reference old recurrence names or vendor-shaped fields, sometimes indirectly. | Migrate to owned DTO/semantic fields; pure pass-throughs may only need type updates. Inspect each row before claiming completion. |

## 6. Verification and phased plan

### Honest grep criterion

For handwritten production/test **source**, all direct imports, dynamic imports, mocks, vendor constructors and vendor type declarations for the chosen package must be under `packages/lib/recurrence/acl/`. A search outside that directory must return no vendor dependency. Standard `RRULE` protocol names in ICS parsing are not package imports and must not be renamed merely to game the check.

An unrestricted repository grep cannot literally return only ACL files: this plan itself names the package, manifests/lockfiles must declare it, and an independent ICS parser may expose an RFC property called `rrule`. Therefore use a documented scope, not a misleading clean result:

```text
rg -n '(from|import|require|mock).*\x22rrule\x22|(from|import|require|mock).*\x27rrule\x27' apps packages
rg -n '\bnew RRule\b|\bRRule\.(optionsToString|fromString)|rrule/dist' apps packages
rg -n 'rrule' apps packages -g '*.ts' -g '*.tsx' -g '*.js'
```

Treat the first two as assertions that every match belongs to the ACL; review every match of the third. Add a static dependency rule forbidding vendor imports/re-exports elsewhere and forbidding any browser entry's transitive dependency on the server ACL. Supplement grep with a recurrence-shape audit (`freq`, numeric enums, `dtstart`, `.options`), because a renamed alias or copied enum can pass a package-name search.

Manifest declarations remain only where the ACL's existing workspace needs them; remove redundant direct declarations after resolution checks. Replace platform build hard-coded vendor entries with server-neutral module wiring or an ACL-owned external-dependency list. Do not silently bundle the server adapter into platform atoms. Existing `.dependency-cruiser.mjs` and `.dependency-cruiser.api.mjs` provide places to add boundary rules after inspecting their actual scopes.

### Phases

1. **Characterize before extraction — test-first.** Freeze legal existing recurrence shapes, numeric mappings, defaults, count/cutoff behavior, serialization and browser/server timezone fixtures. Inventory concrete and indirect consumers from Appendices A/B; inspect any additional aliases. Done when existing behavior is captured and inconsistent provider projections are explicitly classified, not silently normalized.
2. **Introduce neutral pattern, codec and port — test-first.** Implement prospective contracts, legacy round trips and named errors inside the new boundary. No schema migration. Done when DTOs carry no vendor types and legacy values round-trip without data loss. Newly rejected legacy values require an explicit rollout/repair decision.
3. **Wrap the current engine — test-first.** Move all construction, vendor options, Date conversion, expansion and serialization to the adapter. Add bounded execution tests and fake-port application tests. Done when adapter contract fixtures pass and no caller needs `.options` or vendor enum constants.
4. **Migrate server producers — test-first.** Replace email, calendar-link, Google and Salesforce reconstruction sites in separate small PRs. Preserve public payload and provider-specific contracts; test `dtstart`/`until`/zone projections. Done when these callers depend only on neutral output and end-to-end fixture assertions agree.
5. **Move preview/command expansion to server — test-first.** Add bounded preview data, migrate both web and platform atom consumers, and validate existing recurring command arrays server-side. Done when timezone/count edits cannot display stale results and submitted dates cannot bypass authoritative recurrence calculation. Keep ordinary per-occurrence booking validation.
6. **Retire compatibility leaks and prove isolation.** Migrate all remaining rows of Appendix B, generated-source hooks and direct declarations; regenerate rather than hand-edit generated code. Add source/import and client-graph gates. Done when the scoped grep criteria pass, current API/database fixtures are unchanged, and swapping to a test implementation requires no consumer edits.

Each phase may span several draft PRs; keep every code PR under 500 changed lines and fewer than 10 code files. This is cross-package work: implementation requires the repository's approval for multi-package changes, deletion, new dependencies or schema changes as applicable. The present authorization is for the plan only. No new dependency/schema change is proposed by default. Do not run a full build/E2E suite without the repository-required approval.

### Acceptance suite

- Round-trip every persisted frequency, optional start/cutoff/zone and null/non-recurring case; reject unknown numeric codes with a named error instead of remapping them.
- Golden fixtures for current versioned API input/output; no vendor enums, Date instances or library methods on browser wire data.
- Weekly DST transitions, month-end and leap-day cases under UTC, Europe/Warsaw and America/New_York process zones; identical true instants for the same explicit domain context regardless of machine timezone.
- Bounded expansion, count override validation, inclusive cutoff, empty legitimate result versus expansion failure, maximum output and cancellation of obsolete preview requests.
- Separate start/rule serialization; a rule containing DTSTART must not become a malformed rule value after prefix replacement. Test email ICS, Google payload and Salesforce fields independently.
- Existing booking-link and email tests plus real generated-calendar parsing; expected values must not be produced by the same concrete engine being tested.
- Transitive client graph excludes ACL and vendor; type-only imports and generated declarations checked separately. A bundle check, if authorized, measures actual output rather than inferring bytes from imports.
- Vitest focused tests, Biome on changed files, relevant type checks; `yarn type-check:ci --force` before push. Verify API v2 bridge resolution. No tests were run to produce this plan.

### Remaining owner questions

Library documentation resolves API mechanics; it cannot approve business semantics. Scheduling owner: wall-clock versus elapsed-time recurrence, and allowed zero/default legacy configurations. API owner: supported legacy recurrence payload versions and whether unknown extra fields must round-trip. Integration owners: intentional differences in Google/Salesforce recurrence projections. Record resulting decisions in ACL codec/adapter contract fixtures; APIs and UI only translate those contracts.

There is no maintained contract registry established by the document search. Record proposed `RecurrencePattern`, `RecurrencePort`, `RecurrenceCodec`, `RecurrenceForPreviewDto`, serialization shape and timezone policy in the eventual change's contract notes; use a repository registry if one is identified before implementation. Do not introduce an unrelated registry as part of this plan.

## Appendix A — Complete direct-dependency inventory for the shortlist

Inventory generated from source searches under `apps/` and `packages/` for static/dynamic imports, requires and mocks in TypeScript/JavaScript, including tests. Rows show all matches, not selected examples. This is a syntactic snapshot, not proof of runtime execution or a complete transitive dependency graph. Ambient declarations, manifests and build wiring follow the generated tables.

### rrule

| File:line | Verified source |
|---|---|
| `packages/app-store/googlecalendar/lib/CalendarService.ts:25` | `import { RRule } from "rrule";` |
| `packages/app-store/salesforce/lib/CrmService.ts:15` | `import { RRule } from "rrule";` |
| `packages/emails/lib/generateIcsString.ts:4` | `import { RRule } from "rrule";` |
| `packages/emails/src/components/WhenInfo.tsx:2` | `import { RRule } from "rrule";` |
| `packages/features/bookings/lib/getCalendarLinks.test.ts:3` | `import { RRule } from "rrule";` |
| `packages/features/bookings/lib/getCalendarLinks.ts:3` | `import { RRule } from "rrule";` |
| `packages/lib/parse-dates.ts:1` | `import { RRule } from "rrule";` |
| `packages/types/Calendar.d.ts:5` | `import type { Frequency } from "rrule";` |

### @googleapis/calendar

| File:line | Verified source |
|---|---|
| `apps/api/v2/src/modules/cal-unified-calendars/services/google-calendar.service.spec.ts:37` | `jest.mock("@googleapis/calendar", () => ({` |
| `apps/api/v2/src/modules/cal-unified-calendars/services/google-calendar.service.ts:4` | `import { calendar_v3 } from "@googleapis/calendar";` |
| `apps/api/v2/src/platform/calendars/services/gcal.service.ts:8` | `import { calendar_v3 } from "@googleapis/calendar";` |
| `packages/app-store/googlecalendar/api/callback.ts:1` | `import { calendar_v3 } from "@googleapis/calendar";` |
| `packages/app-store/googlecalendar/lib/__mocks__/googleapis.ts:120` | `vi.mock("@googleapis/calendar", () => calendarMock);` |
| `packages/app-store/googlecalendar/lib/CalendarAuth.ts:1` | `import { calendar_v3 } from "@googleapis/calendar";` |
| `packages/app-store/googlecalendar/lib/CalendarService.ts:23` | `import type { calendar_v3 } from "@googleapis/calendar";` |
| `packages/app-store/googlecalendar/tests/testUtils.ts:1` | `import { calendar_v3 } from "@googleapis/calendar";` |
| `packages/features/auth/lib/next-auth-options.test.ts:172` | `vi.mock("@googleapis/calendar", () => ({` |
| `packages/features/auth/lib/next-auth-options.ts:41` | `import { calendar_v3 } from "@googleapis/calendar";` |
| `packages/features/calendar-subscription/adapters/GoogleCalendarSubscription.adapter.ts:1` | `import type { calendar_v3 } from "@googleapis/calendar";` |
| `packages/types/Calendar.d.ts:1` | `import type { calendar_v3 } from "@googleapis/calendar";` |

### ics

| File:line | Verified source |
|---|---|
| `packages/emails/lib/generateIcsFile.ts:2` | `import type { EventStatus } from "ics";` |
| `packages/emails/lib/generateIcsString.test.ts:177` | `const ics = await import("ics");` |
| `packages/emails/lib/generateIcsString.test.ts:219` | `const ics = await import("ics");` |
| `packages/emails/lib/generateIcsString.ts:2` | `import type { DateArray, ParticipationRole, EventStatus, ParticipationStatus } from "ics";` |
| `packages/emails/lib/generateIcsString.ts:3` | `import { createEvent } from "ics";` |
| `packages/features/bookings/lib/getCalendarLinks.test.ts:2` | `import { createEvent } from "ics";` |
| `packages/features/bookings/lib/getCalendarLinks.test.ts:12` | `vi.mock("ics", () => ({` |
| `packages/features/bookings/lib/getCalendarLinks.ts:2` | `import { createEvent } from "ics";` |
| `packages/lib/CalendarService.test.ts:1` | `import { createEvent as createIcsEvent } from "ics";` |
| `packages/lib/CalendarService.test.ts:5` | `vi.mock("ics", () => ({` |
| `packages/lib/CalendarService.ts:21` | `import type { Attendee, DateArray, DurationObject } from "ics";` |
| `packages/lib/CalendarService.ts:22` | `import { createEvent } from "ics";` |

### ical.js

| File:line | Verified source |
|---|---|
| `packages/app-store/ics-feedcalendar/lib/CalendarService.ts:16` | `import ICAL from "ical.js";` |
| `packages/lib/CalendarService.ts:20` | `import ICAL from "ical.js";` |
| `packages/types/Calendar.d.ts:4` | `import type { Time } from "ical.js";` |

### Additional declarations and wiring

| Dependency | All located declarations/build references in the inspected manifests/config |
|---|---|
| `rrule` | `apps/web/package.json:140`; `packages/lib/package.json:28`; `packages/emails/package.json:12`; `packages/platform/libraries/vite.config.js:89`, `:162`. |
| `ics` | `apps/web/package.json:98`; `packages/lib/package.json:24`; `packages/platform/libraries/vite.config.js:86`, `:159`. |
| `ical.js` | `apps/web/package.json:97`; `packages/lib/package.json:23`; `packages/types/ical.d.ts:4`; `packages/platform/libraries/vite.config.js:85`, `:158`. |
| `@googleapis/calendar` | `apps/web/package.json:58`; `packages/app-store/googlecalendar/package.json:10`; `packages/platform/libraries/vite.config.js:88`, `:161`. |

Lockfiles necessarily name resolved packages and are not handwritten architectural consumers. Protocol-only/test-parser references include `packages/testing/src/lib/bookingScenario/expects.ts:139` and `:253`: a parsed ICS event's `rrule` property is not a direct import of the chosen package. That test helper also defines a numeric recurrence expectation at `:36`; migrate the expectation shape to the owned contract, while retaining independent protocol parsing.

## Appendix B — Wider recurrence vocabulary and shape consumers

The search includes `RecurringEvent`, `recurringEventType`, `parseRecurringDates`, `RRule`, `Frequency`, and direct recurrence accesses to `freq`, `interval`, `count`, `until`, `tzid`, `dtstart`. It found **54 files / 154 matching lines**. All matching lines are listed per file below. This conservative migration checklist includes pass-through types, tests and generated outputs; a match is not automatically a runtime dependency. Conversely, inferred aliases/JSON spreading require call-path review: no finite text search proves every transitive consumer has been found. The additional legacy DTO/test helper shapes discussed above are included in the migration ledger even where this search does not match them.

Do not hand-edit generated rows such as Prisma model schemas or Kysely output; update their source contract and regenerate. Every listed non-ACL consumer must finish with neutral recurrence data or remain an explicitly documented protocol-only consumer.

| File | All matched line numbers |
|---|---|
| `apps/api/v2/src/platform/bookings/2024-08-13/services/input.service.ts` | `apps/api/v2/src/platform/bookings/2024-08-13/services/input.service.ts:63`, `apps/api/v2/src/platform/bookings/2024-08-13/services/input.service.ts:77` |
| `apps/api/v2/src/platform/event-types/event-types_2024_04_15/inputs/enums/frequency.ts` | `apps/api/v2/src/platform/event-types/event-types_2024_04_15/inputs/enums/frequency.ts:1` |
| `apps/api/v2/src/platform/event-types/event-types_2024_04_15/inputs/update-event-type.input.ts` | `apps/api/v2/src/platform/event-types/event-types_2024_04_15/inputs/update-event-type.input.ts:19`, `apps/api/v2/src/platform/event-types/event-types_2024_04_15/inputs/update-event-type.input.ts:246`, `apps/api/v2/src/platform/event-types/event-types_2024_04_15/inputs/update-event-type.input.ts:247`, `apps/api/v2/src/platform/event-types/event-types_2024_04_15/inputs/update-event-type.input.ts:248`, `apps/api/v2/src/platform/event-types/event-types_2024_04_15/inputs/update-event-type.input.ts:388`, `apps/api/v2/src/platform/event-types/event-types_2024_04_15/inputs/update-event-type.input.ts:390` |
| `apps/api/v2/src/platform/event-types/event-types_2024_06_14/transformers/api-to-internal/recurrence.ts` | `apps/api/v2/src/platform/event-types/event-types_2024_06_14/transformers/api-to-internal/recurrence.ts:1`, `apps/api/v2/src/platform/event-types/event-types_2024_06_14/transformers/api-to-internal/recurrence.ts:11` |
| `apps/api/v2/src/platform/event-types/event-types_2024_06_14/transformers/internal-to-api/recurrence.ts` | `apps/api/v2/src/platform/event-types/event-types_2024_06_14/transformers/internal-to-api/recurrence.ts:1`, `apps/api/v2/src/platform/event-types/event-types_2024_06_14/transformers/internal-to-api/recurrence.ts:10` |
| `apps/web/components/booking/BookingListItem.tsx` | `apps/web/components/booking/BookingListItem.tsx:667` |
| `apps/web/components/booking/CancelBooking.tsx` | `apps/web/components/booking/CancelBooking.tsx:9`, `apps/web/components/booking/CancelBooking.tsx:92` |
| `apps/web/components/dialog/CancelBookingDialog.tsx` | `apps/web/components/dialog/CancelBookingDialog.tsx:7`, `apps/web/components/dialog/CancelBookingDialog.tsx:34` |
| `apps/web/modules/bookings/components/BookingDetailsSheet.tsx` | `apps/web/modules/bookings/components/BookingDetailsSheet.tsx:19`, `apps/web/modules/bookings/components/BookingDetailsSheet.tsx:263`, `apps/web/modules/bookings/components/BookingDetailsSheet.tsx:700`, `apps/web/modules/bookings/components/BookingDetailsSheet.tsx:1011` |
| `apps/web/modules/bookings/components/event-meta/Occurences.tsx` | `apps/web/modules/bookings/components/event-meta/Occurences.tsx:6`, `apps/web/modules/bookings/components/event-meta/Occurences.tsx:17`, `apps/web/modules/bookings/components/event-meta/Occurences.tsx:50`, `apps/web/modules/bookings/components/event-meta/Occurences.tsx:62`, `apps/web/modules/bookings/components/event-meta/Occurences.tsx:119`, `apps/web/modules/bookings/components/event-meta/Occurences.tsx:120`, `apps/web/modules/bookings/components/event-meta/Occurences.tsx:130` |
| `apps/web/modules/bookings/views/bookings-single-view.tsx` | `apps/web/modules/bookings/views/bookings-single-view.tsx:1249`, `apps/web/modules/bookings/views/bookings-single-view.tsx:1258`, `apps/web/modules/bookings/views/bookings-single-view.tsx:1299` |
| `apps/web/modules/event-types/components/EventTypeDescription.tsx` | `apps/web/modules/event-types/components/EventTypeDescription.tsx:91`, `apps/web/modules/event-types/components/EventTypeDescription.tsx:95`, `apps/web/modules/event-types/components/EventTypeDescription.tsx:125`, `apps/web/modules/event-types/components/EventTypeDescription.tsx:128` |
| `packages/app-store/alby/components/EventTypeAppSettingsInterface.tsx` | `packages/app-store/alby/components/EventTypeAppSettingsInterface.tsx:35` |
| `packages/app-store/btcpayserver/components/EventTypeAppSettingsInterface.tsx` | `packages/app-store/btcpayserver/components/EventTypeAppSettingsInterface.tsx:43` |
| `packages/app-store/googlecalendar/lib/CalendarService.ts` | `packages/app-store/googlecalendar/lib/CalendarService.ts:25`, `packages/app-store/googlecalendar/lib/CalendarService.ts:220`, `packages/app-store/googlecalendar/lib/CalendarService.ts:221`, `packages/app-store/googlecalendar/lib/CalendarService.ts:222`, `packages/app-store/googlecalendar/lib/CalendarService.ts:223` |
| `packages/app-store/hitpay/components/EventTypeAppSettingsInterface.tsx` | `packages/app-store/hitpay/components/EventTypeAppSettingsInterface.tsx:33` |
| `packages/app-store/mock-payment-app/components/EventTypeAppCardInterface.tsx` | `packages/app-store/mock-payment-app/components/EventTypeAppCardInterface.tsx:50` |
| `packages/app-store/paypal/components/EventTypeAppSettingsInterface.tsx` | `packages/app-store/paypal/components/EventTypeAppSettingsInterface.tsx:43` |
| `packages/app-store/salesforce/lib/CrmService.ts` | `packages/app-store/salesforce/lib/CrmService.ts:15`, `packages/app-store/salesforce/lib/CrmService.ts:333`, `packages/app-store/salesforce/lib/CrmService.ts:445` |
| `packages/app-store/stripepayment/components/EventTypeAppSettingsInterface.tsx` | `packages/app-store/stripepayment/components/EventTypeAppSettingsInterface.tsx:48` |
| `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts` | `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts:15`, `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts:263`, `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts:264`, `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts:269`, `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts:275`, `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts:286`, `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts:288`, `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts:289`, `packages/app-store/zoomvideo/lib/VideoApiAdapter.ts:291` |
| `packages/emails/lib/generateIcsString.ts` | `packages/emails/lib/generateIcsString.ts:4`, `packages/emails/lib/generateIcsString.ts:66`, `packages/emails/lib/generateIcsString.ts:67`, `packages/emails/lib/generateIcsString.ts:68` |
| `packages/emails/src/components/WhenInfo.tsx` | `packages/emails/src/components/WhenInfo.tsx:2`, `packages/emails/src/components/WhenInfo.tsx:10`, `packages/emails/src/components/WhenInfo.tsx:18`, `packages/emails/src/components/WhenInfo.tsx:23`, `packages/emails/src/components/WhenInfo.tsx:24`, `packages/emails/src/components/WhenInfo.tsx:65` |
| `packages/emails/src/templates/AttendeeDeclinedEmail.tsx` | `packages/emails/src/templates/AttendeeDeclinedEmail.tsx:6` |
| `packages/emails/src/templates/AttendeeRequestEmail.tsx` | `packages/emails/src/templates/AttendeeRequestEmail.tsx:10`, `packages/emails/src/templates/AttendeeRequestEmail.tsx:15` |
| `packages/emails/src/templates/BaseScheduledEmail.tsx` | `packages/emails/src/templates/BaseScheduledEmail.tsx:72` |
| `packages/emails/src/templates/OrganizerRequestEmail.tsx` | `packages/emails/src/templates/OrganizerRequestEmail.tsx:22` |
| `packages/emails/src/templates/OrganizerRequestEmailV2.tsx` | `packages/emails/src/templates/OrganizerRequestEmailV2.tsx:15` |
| `packages/emails/src/templates/OrganizerScheduledEmail.tsx` | `packages/emails/src/templates/OrganizerScheduledEmail.tsx:25` |
| `packages/emails/templates/attendee-declined-email.ts` | `packages/emails/templates/attendee-declined-email.ts:19` |
| `packages/emails/templates/attendee-scheduled-email.ts` | `packages/emails/templates/attendee-scheduled-email.ts:72` |
| `packages/emails/templates/broken-integration-email.ts` | `packages/emails/templates/broken-integration-email.ts:52` |
| `packages/emails/templates/organizer-request-email.ts` | `packages/emails/templates/organizer-request-email.ts:43` |
| `packages/emails/templates/organizer-scheduled-email.ts` | `packages/emails/templates/organizer-scheduled-email.ts:96` |
| `packages/features/bookings/lib/client/booking-event-form/booking-to-mutation-input-mapper.tsx` | `packages/features/bookings/lib/client/booking-event-form/booking-to-mutation-input-mapper.tsx:6`, `packages/features/bookings/lib/client/booking-event-form/booking-to-mutation-input-mapper.tsx:107` |
| `packages/features/bookings/lib/getCalendarLinks.test.ts` | `packages/features/bookings/lib/getCalendarLinks.test.ts:3`, `packages/features/bookings/lib/getCalendarLinks.test.ts:182` |
| `packages/features/bookings/lib/getCalendarLinks.ts` | `packages/features/bookings/lib/getCalendarLinks.ts:3`, `packages/features/bookings/lib/getCalendarLinks.ts:12`, `packages/features/bookings/lib/getCalendarLinks.ts:14`, `packages/features/bookings/lib/getCalendarLinks.ts:78` |
| `packages/features/bookings/lib/service/RegularBookingService.ts` | `packages/features/bookings/lib/service/RegularBookingService.ts:873`, `packages/features/bookings/lib/service/RegularBookingService.ts:1349` |
| `packages/features/CalendarEventBuilder.test.ts` | `packages/features/CalendarEventBuilder.test.ts:654`, `packages/features/CalendarEventBuilder.test.ts:1098`, `packages/features/CalendarEventBuilder.test.ts:1099`, `packages/features/CalendarEventBuilder.test.ts:1100`, `packages/features/CalendarEventBuilder.test.ts:1725`, `packages/features/CalendarEventBuilder.test.ts:1726`, `packages/features/CalendarEventBuilder.test.ts:1727` |
| `packages/features/eventtypes/components/tabs/recurring/RecurringEventController.tsx` | `packages/features/eventtypes/components/tabs/recurring/RecurringEventController.tsx:10`, `packages/features/eventtypes/components/tabs/recurring/RecurringEventController.tsx:11`, `packages/features/eventtypes/components/tabs/recurring/RecurringEventController.tsx:46`, `packages/features/eventtypes/components/tabs/recurring/RecurringEventController.tsx:52`, `packages/features/eventtypes/components/tabs/recurring/RecurringEventController.tsx:114`, `packages/features/eventtypes/components/tabs/recurring/RecurringEventController.tsx:160` |
| `packages/features/eventtypes/lib/types.ts` | `packages/features/eventtypes/lib/types.ts:22`, `packages/features/eventtypes/lib/types.ts:109` |
| `packages/kysely/types.ts` | `packages/kysely/types.ts:907` |
| `packages/lib/CalEventParser.ts` | `packages/lib/CalEventParser.ts:11`, `packages/lib/CalEventParser.ts:253`, `packages/lib/CalEventParser.ts:298`, `packages/lib/CalEventParser.ts:322`, `packages/lib/CalEventParser.ts:353` |
| `packages/lib/isRecurringEvent.ts` | `packages/lib/isRecurringEvent.ts:1`, `packages/lib/isRecurringEvent.ts:2`, `packages/lib/isRecurringEvent.ts:4`, `packages/lib/isRecurringEvent.ts:10`, `packages/lib/isRecurringEvent.ts:11` |
| `packages/lib/parse-dates.ts` | `packages/lib/parse-dates.ts:1`, `packages/lib/parse-dates.ts:6`, `packages/lib/parse-dates.ts:79`, `packages/lib/parse-dates.ts:90`, `packages/lib/parse-dates.ts:99` |
| `packages/lib/recurringStrings.ts` | `packages/lib/recurringStrings.ts:3`, `packages/lib/recurringStrings.ts:4`, `packages/lib/recurringStrings.ts:11`, `packages/lib/recurringStrings.ts:13`, `packages/lib/recurringStrings.ts:15`, `packages/lib/recurringStrings.ts:16`, `packages/lib/recurringStrings.ts:18`, `packages/lib/recurringStrings.ts:33`, `packages/lib/recurringStrings.ts:37`, `packages/lib/recurringStrings.ts:39`, `packages/lib/recurringStrings.ts:41` |
| `packages/platform/atoms/hooks/bookings/useHandleBookEvent.ts` | `packages/platform/atoms/hooks/bookings/useHandleBookEvent.ts:116` |
| `packages/platform/enums/event-types/frequency.ts` | `packages/platform/enums/event-types/frequency.ts:1` |
| `packages/prisma/zod-utils.ts` | `packages/prisma/zod-utils.ts:81`, `packages/prisma/zod-utils.ts:233`, `packages/prisma/zod-utils.ts:234`, `packages/prisma/zod-utils.ts:239` |
| `packages/prisma/zod/modelSchema/EventTypeSchema.ts` | `packages/prisma/zod/modelSchema/EventTypeSchema.ts:10`, `packages/prisma/zod/modelSchema/EventTypeSchema.ts:57` |
| `packages/trpc/server/routers/viewer/bookings/confirm.handler.ts` | `packages/trpc/server/routers/viewer/bookings/confirm.handler.ts:343` |
| `packages/trpc/server/routers/viewer/eventTypes/heavy/update.handler.ts` | `packages/trpc/server/routers/viewer/eventTypes/heavy/update.handler.ts:246`, `packages/trpc/server/routers/viewer/eventTypes/heavy/update.handler.ts:247`, `packages/trpc/server/routers/viewer/eventTypes/heavy/update.handler.ts:248`, `packages/trpc/server/routers/viewer/eventTypes/heavy/update.handler.ts:249`, `packages/trpc/server/routers/viewer/eventTypes/heavy/update.handler.ts:250`, `packages/trpc/server/routers/viewer/eventTypes/heavy/update.handler.ts:251` |
| `packages/trpc/server/routers/viewer/eventTypes/types.ts` | `packages/trpc/server/routers/viewer/eventTypes/types.ts:18`, `packages/trpc/server/routers/viewer/eventTypes/types.ts:141` |
| `packages/types/Calendar.d.ts` | `packages/types/Calendar.d.ts:5`, `packages/types/Calendar.d.ts:130`, `packages/types/Calendar.d.ts:134`, `packages/types/Calendar.d.ts:200` |

## Progress

- [ ] Characterization and inventory review.
- [ ] Neutral value object, codec and port.
- [ ] Concrete adapter and contract suite.
- [ ] Server producer migration.
- [ ] Server-prepared UI/command recurrence flow.
- [ ] Compatibility retirement and isolation proof.
