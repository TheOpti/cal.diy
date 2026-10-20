# Contributors: booking lifecycle services and persistence

Analysis date: 2026-10-20. Analyzed HEAD: `a42c0a4fe1d17d5e87d10180ff4b42355492f861`.

## Initial contributor-consultation priorities

The conversation first compared the territory and structure artifacts to identify five areas where contributor input could resolve risks or missing context. These priorities are inferences from those artifacts, not confirmed incidents or ownership assignments.

| Priority | Area | Evidence and questions for contributors |
|---|---|---|
| 1 | Booking lifecycle and APIs | 254 historical commits and 43.7% corrective activity; external side effects and a runtime retrieval-helper/tRPC cycle. Clarify seated-booking/rescheduling invariants, partial-failure handling and the intended service/API boundary. |
| 2 | Workflow delivery | 47.9% corrective activity, including missing notifications and recipient issues; implementation absent from the structural graph. Locate the current implementation and clarify triggers, recipient selection, retries and duplicate-delivery handling. |
| 3 | Authentication and watchlist | Four-file runtime cycle through email verification and watchlist administration; auth tests contain 36 mocks. Clarify blocked signup, administrative unlocking and intended dependency boundaries. |
| 4 | Event-type settings across web and embedded editors | 109 historical commits; persistence, date-range and host-selection fixes; cache/revalidation boundaries. Clarify shared editor behavior and when saved settings become visible on public booking pages. |
| 5 | Prisma and booking persistence | 104 historical commits; schema co-change with 53 other surviving areas in the shared-file analysis. Clarify database invariants, migration compatibility and real-database coverage for raw queries. The artifacts do not establish repeated database failures. |

The remainder develops the first priority into a contributor analysis. The preceding artifacts reference different commits, and their broad activity counts should not be compared directly with this narrower authorship sample.

## Selected area and method

Booking creation, rescheduling and cancellation are central in [the territory map](artifact-1-territory.md) and cross persistence, calendars, payments and delivery boundaries in [the structural assessment](artifact-2-structure.md). This analysis scopes authorship to booking `lib` and repositories, not the entire bookings UI/API feature.

Window: 2025-10-20 00:00 through 2026-10-20 23:59:59, Europe/Warsaw boundary offsets (+02:00). Git committer-date filtering; non-merge commits reachable from HEAD; each commit counts once. Authors use Git's mailmap-aware `%aN`, not the GitHub merge committer. Human-authored commits with AI co-author credits remain attributed to the human primary author; identifiable bot/agent primary authors are excluded. Counts do not measure lines written, effort, review activity or exclusive ownership.

Reproduce the candidate history with:

```powershell
git log --since=2025-10-20T00:00:00+02:00 --until=2026-10-20T23:59:59+02:00 --no-merges --format="%H|%aN|%s" -- packages/features/bookings/lib packages/features/ee/bookings/lib packages/features/bookings/repositories packages/features/ee/bookings/repositories packages/lib/server/repository/booking.ts
```

The final legacy `booking.ts` path had no commits in this window. Directory scope retains the old `handleNewBooking` and current service paths. This is not a complete rename-following history of every repository dependency moved into the area.

157 candidate commits; 142 retained across 31 author identities. Exclusions: agent-primary commits `54f36af943`, `681d191537`; copy/typo-only changes `c339c9c479`, `46eb533dbd`; broad fork, formatting, package-move, import, toolchain or infrastructure changes `ab21c7f805`, `27515d42f0`, `648ad72a54`, `98b6d63164`, `96bec9f7b9`, `3a8fe8c7af`, `f5d345b133`, `a1e5384859`, `bbf9274d37`, `00e5770273`, `6923b97cd2`. Targeted service/repository refactors and test changes remain eligible. These exclusions are scope judgments, not judgments of contribution value. This sample is narrower and filtered differently from the territory map's 254 bookings commits.

## Frequent contributors and recurring themes

Themes summarize subjects across each contributor's scoped history; the reading list below additionally uses selected commit bodies and patches.

| Contributor | Commits | Recurring themes and useful starting PRs |
|---|---:|---|
| Hariom Balhara | 23 | Booking audit architecture, actor/impersonation context, service decomposition and cancellation injection. #25729, #26046, #26458, #24159, #27869, #26546. |
| Anik Dhabal Babu | 15 | Calendar/video correctness, seated rescheduling, notification payloads and paid-booking side effects. #26914, #26044, #26719, #25098, #25294. |
| Joe Au-Yeung | 13 | Routing/assignment explanations, reporting, workflow payload timing and organizer context. #27225, #27405, #27423, #25446, #24645. |
| Udit Takkar | 11 | Distributed tracing, calendar-event construction, query performance, host locations and cancellation settings. #24861, #25092, #25574, #27203, #27383, #26872. |
| Benny Joo | 11 | Repository/service boundaries, dependency-cycle reduction, credential isolation and round-robin robustness. #25534, #25639, #25343, #25200, #25369. |
| Rajiv Sahal | 10 | Attendee API operations, administrator permissions and seated rescheduling; some branding work. #27781, #27664, #27759, #24640, #26530, #26389. |
| Morgan | 10 | Notification tasking and email decomposition, platform host filtering, calendar DTOs and seated-email context. #24944, #24997, #25627, #26122, #26498. |
| Dhairyashil Shinde | 8 | Booking validation, impersonation/reschedule exceptions, host selection and payment reminders. #26002, #25427, #25337, #24889. |
| Syed Ali Shahbaz | 6 | Webhook contracts/versioning, managed reassignment and blocked-user filtering. #27891, #26139, #27546, #24809, #26446. |
| Romit | 5 | Test-worker stability and integration-test removal. #28459, #28630, #29019, #29020, #29021. |
| Alex van Andel | 5 | Calendar-cache behavior, booking-limit query performance and credential encryption. #24778, #25284, #28021, #27154. |
| Volnei Munhoz | 3 | Calendar synchronization, explicit cache modes and server/client module separation. #24124, #26539, #26112. |
| Anirban Singha | 2 | Round-robin deterministic tie-breaking and location-helper naming. #28783, #28567. |
| Eunjae Lee | 2 | Shared booking-access checks and booking-view improvements. #28071, #25251. |
| sean-brydon | 2 | Minimum reschedule notice and time-of-use/time-of-check handling in seats. #25575, #27389. |

Sixteen other author identities each have one commit. A single contribution can still carry critical knowledge: shafi-VM authored the multi-seat refund correction (#29685), and Jimmy He supplied booking fields and locale to seat payment handling (#29639). Frequency alone would miss these contacts. Kartik and Kartik Saini have distinct GitHub noreply account identifiers and were not merged speculatively.

## Reading before changing behavior

PR numbers below come from local commit subjects. Read the local evidence with `git show <hash>`; remote PR discussions were not available, so these are not claims about review consensus.

| Priority / subject | PR and local commit | What to preserve or clarify |
|---|---|---|
| Multi-seat cancellation refunds | #29685, `761b780aa2` (shafi-VM) | Each paid seat has its own Payment row. Full cancellation previously refunded only the first successful payment. The patch refunds all successful, not-yet-refunded payments, attempts remaining refunds after a provider failure, and reports collected errors. Includes regression tests. |
| Seated reschedule meeting URL | #26914, `c9f9712f41` (Anik) | Reschedule notifications need video data from booking references. Read both branches for an existing seat/booking and moving to another slot; preserve the email regression coverage. |
| Payment completion side effects | #26044, `4585d7402d` (Anik) | Moves paid webhook/workflow work from confirmation into payment-success handling. The commit body records missing scheduling type, video URL and metadata compatibility issues encountered along the way. Intermediate body notes conflict on nullability, so inspect the final patch rather than treating each note as the final contract. |
| Webhook compatibility decision | #27891, `3a7122d613` (Syed) | Reverts exposure of the new `{ category, details }` assignment reason to webhook consumers while retaining it for email/UI. Payload construction strips it and delivery adds sanitization. Internal CalendarEvent changes are not automatically safe public API changes. |
| Booking audit propagation | #26046, `75d611c2e8` (Hariom) | Adds creation/rescheduling audit propagation across regular, recurring and seated bookings, including seat references and rescheduling actor context. Read alongside #27869 (`a6a428c8cb`) and #26546 (`5993889616`) before altering handler signatures. |
| Cancellation service boundary | #24159, `a7a8c78494` (Hariom) | Repository injection replaces direct Prisma use in cancellation. Its commit body contains extensive unrelated merged history; use the scoped patch, not the entire body, to understand the decision. |
| Integration-test removal | #29019 `c2c95b371a`, #29020 `6a2b84ab02`, #29021 `84815a9d2f` (Romit) | Patches remove booking-audit/spam integration tests, lucky-user integration tests and booking-repository integration tests. Bodies provide no rationale. Ask whether replacement coverage exists and why these suites were removed; absence of replacement in these patches does not prove none exists elsewhere. |

Additional targeted reading from subjects: administrator cancellation/rescheduling #24640 (`b0b94b91fe`, Rajiv), deterministic host tie-breaking #28783 (`88859e4e31`, Anirban), and calendar credentials reaching video adapters #25200 (`71e7f16b29`, Benny).

## Knowledge concentration and outreach

- Largest author: 23/142 = **16.2%**.
- Top three: 51/142 = **35.9%**.
- Top seven: 93/142 = **65.5%**.
- Sixteen one-commit authors contribute 16/142 = **11.3%**.

Inference: participation is broad, but repeated work is concentrated in a core group with distinct specialties. The evidence does not show a single-person dependency for the entire lifecycle. It does suggest consulting specialists for particular contracts rather than assuming any frequent contributor knows every boundary.

For an initial lifecycle change, start with Hariom (architecture/audit) and Anik (calendar/payment/delivery regressions). Add Rajiv for API/permission changes, Syed for webhook compatibility, Joe for routing, Udit for query/tracing work, or Morgan for notification tasking. Ask Romit about test-removal rationale before relying on historical integration coverage. For multi-seat refunds, include shafi-VM despite the low commit count.

## Limits

`gh auth status` reports no authenticated hosts; attempted public PR fetches also failed. PR descriptions, review comments, rejected approaches, current availability and formal ownership are unknown. Local squash bodies provide some rationale but are not complete discussions. No messages were sent to contributors.

Authorship frequency is a proxy for experience, not a measured knowledge distribution or bus factor. Name normalization can still miss aliases; co-authorship and review contributions are not counted separately. Human primary authorship does not establish that all implementation was human-written. Historical scope includes tests and helper/retrieval code, and excludes API-only/UI-only changes and some dependencies' earlier paths. No application code was changed and no tests were run for this documentary analysis.
