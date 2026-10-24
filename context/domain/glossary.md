# Cal.diy agent glossary

Use qualified terms at context boundaries. Retained organization/platform/billing vocabulary does not establish supported Cal.diy feature scope.

| Term | What it means | Name in code | What NOT to call it |
|---|---|---|---|
| Event type | Reusable scheduling offering and booking policy | `EventType` | Booking, calendar event |
| Booking | A particular appointment and its lifecycle | `Booking` | Event type, slot |
| Booking status | Accepted, pending, rejected, cancelled or awaiting host | `BookingStatus` | Payment status |
| Host / organizer | Responsible booking user or assigned event-type host; qualify which | `Booking.userId`, `Host`, `EventType.owner` | Any logged-in user; interchangeable host roles |
| Attendee | Booking participant, possibly without a user account | `Attendee` | User account, host |
| Cancellation reason policy | Which actors must explain cancellation | `CancellationReasonRequirement`, `requiresCancellationReason` | Reschedule-reason policy |
| Reschedule | Move an appointment; may replace a booking record | `fromReschedule`, `rescheduled`, `rescheduleUid` | In-place date edit in every flow |
| Recurring series | Group of appointment instances | `recurringEventId` | One booking row |
| Booking seat | One participant's place in a capacity-limited booking | `BookingSeat`, `referenceUid` | Billing seat |
| Schedule | Named user's working-time configuration | `Schedule` | Booked appointments |
| Availability interval | Configured working hours or date override | `Availability` | Guaranteed free slot |
| Available slot / busy time | Computed scheduling interval after constraints | `UserAvailabilityService`, `busy`, `workingHours` | Confirmed reservation |
| Booking window / limits | Notice, date-range, frequency and duration restrictions | `minimumBookingNotice`, `periodType`, `bookingLimits`, `durationLimits` | Schedule alone |
| Confirmation | Host approval required before acceptance | `requiresConfirmation`, `BookingStatus.PENDING` | Payment success |
| Managed event type | Parent template and assigned child offerings; retained scope unresolved | `EventType.parentId`, `SchedulingType.MANAGED` | Automatically bookable parent |
| Team / organization | Related grouping concepts persisted in one table | `Team`, `isOrganization`, `parentId` | Two separate tables |
| Round-robin / collective | Host selection versus joint hosting modes | `SchedulingType.ROUND_ROBIN`, `SchedulingType.COLLECTIVE` | Individual scheduling defaults |
| Selected calendar | Connected calendar selected for availability/sync processing | `SelectedCalendar` | Destination calendar |
| Destination calendar | External target for appointment creation | `DestinationCalendar` | Every calendar checked for conflicts |
| Calendar event | Provider-facing representation of an appointment | `CalendarEvent` | Event type |
| Calendar cache / sync | Local provider data and translation of provider changes | `CalendarCacheEvent`, `CalendarSubscriptionService`, `CalendarSyncService` | Booking aggregate, guaranteed delivery by default |
| iCalUID | Provider event identity connecting back to scheduling | `iCalUID`, `getICalUID` | Database booking ID |
| Payment / hold / refund | Independent financial state linked to a booking | `Payment`, `PaymentOption.ON_BOOKING`, `PaymentOption.HOLD`, `refunded` | Booking acceptance or cancellation status |
| Outbound webhook | Subscription receiving scheduling notifications | `Webhook`, `WebhookTriggerEvents` | Workflow, inbound provider notification |
| Workflow | Separate automation feature excluded by stated product scope | No engine found in inspected scope | Webhook synonym |
| User | Scheduling identity/profile | `User` | Provider account |
| Authentication account | Provider identity linked to a user | `Account` | Customer, booking attendee |
| OAuth client | Third-party delegated account access | `OAuthClient` | Platform OAuth client |
| Platform OAuth client | Embedded-scheduling client with managed-user settings | `PlatformOAuthClient` | Ordinary OAuth client |
| Billing seat | Subscription quantity associated with organizations/teams | `SeatChangeLog` | Booking capacity |
