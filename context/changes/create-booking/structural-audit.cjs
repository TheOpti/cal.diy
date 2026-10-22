const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const sg = process.env.AST_GREP_BIN || 'C:/nvm4w/nodejs/node_modules/@ast-grep/cli/ast-grep.exe';
const rg = process.env.RG_BIN || 'C:/Users/opti/AppData/Local/Programs/Antigravity IDE/resources/app/node_modules/@vscode/ripgrep/bin/rg.exe';
const B = 'packages/features/bookings/';
const R = B + 'lib/service/RegularBookingService.ts';
const C = B + 'lib/service/RecurringBookingService.ts';
const H = B + 'lib/handleNewBooking/createBooking.ts';
const A = 'apps/api/v2/src/platform/bookings/2024-08-13/';
const W = 'apps/web/modules/bookings/';
const groups = [];
function add(claim, paths, patterns, grep) { groups.push({id: groups.length + 1, claim, paths, patterns, grep}); }
add('Public route imports wrapper; wrapper wires booking hooks; form submits through handler', ['apps/web/app/(booking-page-wrapper)/[user]/[type]/page.tsx','apps/web/modules/users/views/users-type-public-view.tsx',W+'components/BookerWebWrapper.tsx',W+'components/Booker.tsx'], ['import $$$ from $SOURCE', '$OBJ.$METHOD($$$)', '$FUNC($$$)'], 'Booker|useBooking|handleBook');
add('Client mapping calls booking handler and helper posts /api/book/event', ['packages/platform/atoms/hooks/bookings/useHandleBookEvent.ts', W+'hooks/useBookings.ts',B+'lib/create-booking.ts'], ['$FUNC($$$)', '$OBJ.$METHOD($$$)'], 'handleBook|createBooking|/api/book/event');
add('Web HTTP checks and regular/recurring delegation', ['apps/web/pages/api/book/event.ts','apps/web/pages/api/book/recurring-event.ts'], ['$FUNC($$$)','$OBJ.$METHOD($$$)'], 'Booking|turnstile|rateLimit|session');
add('Regular create and reschedule delegate to same handler; API v1 has additional entry', [R], ['handler.bind(this)($$$)'], 'handler.bind');
add('Regular path loads config, parses, validates, selects hosts, returns early, persists and performs effects', [R], ['$FUNC($$$)','$OBJ.$METHOD($$$)'], 'createBooking|handleSeats|waitForCheck');
add('Persistence helper wraps implementation and uses transaction update/create with include', [H], ['withReporting($$$)','prisma.$transaction($$$)','tx.booking.update($$$)','tx.booking.create($$$)','const createBookingObj = $VALUE'], 'transaction|booking.create|booking.update|include');
add('Regular handler uses helper, not BookingRepository.create', [R,H], ['createBooking($$$)','$REPO.create($$$)'], 'BookingRepository|bookingRepository|\.create\(');
add('Web normal readback and decoy routing are separate', [W+'hooks/useBookings.ts','apps/web/app/(booking-page-wrapper)/booking/[uid]/page.tsx',W+'views/bookings-single-view.getServerSideProps.tsx',B+'lib/getBookingInfo.ts',B+'lib/getUserBooking.ts','apps/web/app/(booking-page-wrapper)/booking-successful/[uid]/page.tsx'], ['$FUNC($$$)','$OBJ.$METHOD($$$)'], 'getBooking|findUnique|booking-successful|shortCircuit');
add('API v2 POST dispatches four variants; regular calls shared service then reloads UID', [A+'controllers/bookings.controller.ts',A+'services/bookings.service.ts',A+'repositories/bookings.repository.ts'], ['$OBJ.$METHOD($$$)'], 'createBooking|findUnique|getBooking');
add('Seats reuse existing booking through transactional locked addition; first seat continues regular insertion', [B+'lib/handleSeats/handleSeats.ts',B+'lib/handleSeats/create/createNewSeat.ts'], ['$FUNC($$$)','$OBJ.$METHOD($$$)'], 'transaction|lock|createNewSeat|find');
add('Recurring creation has two regular call sites; sequential per occurrence; same handler for create/reschedule', [C], ['regularBookingService.createBooking($$$)','await $EXPR','handleNewRecurringBooking.bind(this)($$$)'], 'createBooking|await|handleNewRecurringBooking');
add('Host retrieval has feature-to-tRPC value-import cycle; helper executes getBookings', [B+'lib/getAllUserBookings.ts','packages/trpc/server/routers/viewer/bookings/get.handler.ts'], ['import $$$ from $SOURCE','getBookings($$$)','getAllUserBookings($$$)','$OBJ.execute($$$)'], 'getAllUserBookings|getBookings|execute');
add('Editor mutation revalidates editor route and invalidates queries; creation reads DB', ['apps/web/modules/event-types/components/EventTypeWebWrapper.tsx','apps/web/app/(use-page-wrapper)/event-types/[type]/actions.ts',B+'lib/handleNewBooking/getEventTypesFromDB.ts'], ['$FUNC($$$)','$OBJ.$METHOD($$$)'], 'revalidate|invalidate|findUniqueOrThrow');
add('Blocking and verification gates distinct; regular does not directly invoke verifyEmail', [B+'lib/handleNewBooking/checkIfBookerEmailIsBlocked.ts','packages/features/auth/lib/verifyCodeUnAuthenticated.ts',R], ['verifyEmail($$$)','checkIfBookerEmailIsBlocked($$$)','verifyCodeUnAuthenticated($$$)','getSpamCheckService($$$)'], 'verifyEmail|verifyCodeUnAuthenticated|checkIfBookerEmailIsBlocked|getSpamCheckService');
add('Watchlist composition value imports form indirect verification cycle', ['packages/features/di/watchlist/containers/SpamCheckService.container.ts','packages/features/di/watchlist/containers/watchlist.ts','packages/features/watchlist/lib/service/AdminWatchlistOperationsService.ts','packages/features/auth/lib/verifyEmail.ts','packages/features/watchlist/operations/check-if-email-in-watchlist.controller.ts'], ['import $$$ from $SOURCE'], 'import');
add('Paid completion transaction and BOOKING_PAID dispatch are separate from hook task list', ['packages/app-store/_utils/payments/handlePaymentSuccess.ts',B+'lib/onBookingEvents/BookingEventHandlerService.ts'], ['$OBJ.$METHOD($$$)','$FUNC($$$)'], 'transaction|BOOKING_PAID|allSettled|updatePrivateLinkUsage');
add('IBookingService declares two any-typed methods; concrete regular result derived via ReturnType', [B+'lib/interfaces/IBookingService.ts',B+'lib/dto/types.d.ts'], ['interface IBookingService { $$$ }','type RegularBookingCreateResult = $TYPE'], 'any|RegularBookingCreateResult');
add('Service constructs EventManager despite injected dependencies; API Nest wrapper extends shared class', [R,'apps/api/v2/src/lib/services/regular-booking.service.ts','packages/platform/libraries/bookings.ts'], ['new EventManager($$$)','super($$$)','export { $$$ } from $SOURCE'], 'EventManager|extends|super|RegularBookingService');
add('Spam factory creates fresh instance; test spies on separate instance and does not assert spy invocation', ['packages/features/di/watchlist/containers/SpamCheckService.container.ts',B+'lib/handleNewBooking/test/spam-booking.integration-test.ts',B+'lib/handleNewBooking/test/getNewBookingHandler.ts',R], ['new SpamCheckService($$$)','getSpamCheckService($$$)','vi.spyOn($$$)','expect(isBlockedSpy)'], 'isBlockedSpy|getSpamCheckService|new SpamCheckService');
add('Spam startCheck catches rejection and returns unblocked', ['packages/features/watchlist/lib/service/SpamCheckService.ts'], ['$EXPR.catch($$$)','return { isBlocked: false }'], 'catch|isBlocked: false');
add('Runner patterns separate integration tests and API specs', ['vitest.config.mts'], ['function getTestInclude() { $$$ }','function getTestExclude() { $$$ }'], 'integration-test|spec.ts|test,spec');
add('P2002 targeted test absence is bounded', [B,'apps/web/modules/bookings','apps/web/playwright',A,'packages/trpc/server/routers/viewer/bookings'], ['"P2002"',"'P2002'"], 'P2002');
add('Adapter-level decoy test absence is bounded', [A+'controllers/e2e',W+'components/Booker.test.tsx'], ['"isShortCircuitedBooking"','$OBJ.isShortCircuitedBooking'], 'isShortCircuitedBooking|decoy|short.?circuit|spam|watchlist');
add('Recurrence rollback test absence is bounded', [C.replace('.ts','.test.ts'),B+'lib/handleNewBooking/test/fresh-booking.test.ts',B+'lib/handleNewBooking/test/reschedule.test.ts'], ['$OBJ.mockRejectedValueOnce($$$)','$OBJ.mockRejectedValue($$$)'], 'rollback|compensat|partial|reject|fail');
add('Repository tests mock raw queries; listing tests mock helper/Kysely', [B+'repositories/BookingRepository.test.ts','packages/trpc/server/routers/viewer/bookings/get.handler.test.ts'], ['vi.mock($$$)','$OBJ.mockResolvedValue($$$)','$OBJ.mockResolvedValueOnce($$$)'], 'mock|findBooking|reschedul');
add('API tests override guard; attendee case disabled', [A+'controllers/e2e/user-bookings.e2e-spec.ts'], ['$OBJ.overrideGuard($$$)','xit($$$)'], 'overrideGuard|xit');
add('Seat concurrency tests use real Prisma/helper and concurrent promises', [B+'lib/handleSeats/create/createNewSeat.integration-test.ts'], ['import $$$ from $SOURCE','Promise.all($$$)','Promise.allSettled($$$)'], 'prisma|createNewSeat|Promise.all');
add('Verification mocked; post-booking tests cover private link; spam assertions check decoy/nonpersistence', [B+'lib/handleNewBooking/test/booking-validations.test.ts',B+'lib/handleNewBooking/test/post-booking-handling.test.ts',B+'lib/handleNewBooking/test/spam-booking.integration-test.ts'], ['vi.mock($$$)','expect($$$)'], 'verify|expect|mock');
add('Webhook public type omits and redeclares assignmentReason', ['packages/features/webhooks/lib/sendPayload.ts'], ['type $NAME = $TYPE','interface $NAME extends $BASE { $$$ }'], 'assignmentReason|Omit');
add('No repository-wide uniqueness inferred: inventory named create/reschedule call expressions', ['apps','packages'], ['$OBJ.createBooking($$$)','$OBJ.rescheduleBooking($$$)','createBooking($$$)'], 'createBooking|rescheduleBooking');
add('Corrected bridge export pattern', ['packages/platform/libraries/bookings.ts'], ['export { $$$ } from "@calcom/features/bookings/lib/service/RegularBookingService"'], 'RegularBookingService');
add('No factory override established in booking tests/setup: enumerate mocks and inspect their targets', [B+'lib/handleNewBooking/test', 'packages/testing/src/setupVitest.ts','packages/testing/src/lib/bookingScenario','packages/testing/src/lib/fixtures','vitest.config.mts'], ['vi.mock($$$)','vi.spyOn($$$)'], 'SpamCheckService|isBlockedSpy|mock');
const results = [];
for (const group of groups) {
  const paths = group.paths.filter(p => fs.existsSync(p));
  const partitions = ['ts','tsx','js'].map(lang => ({lang, paths: paths.filter(p => fs.statSync(p).isDirectory() ? lang !== 'js' : lang === 'tsx' ? /\.tsx$/.test(p) : lang === 'js' ? /\.js$/.test(p) : !/\.(tsx|js)$/.test(p))})).filter(p=>p.paths.length);
  const queries = partitions.flatMap(({lang,paths}) => group.patterns.map(pattern => {
    const grepArgs = ['-n','-g',lang === 'ts' ? '*.{ts,mts,cts}' : lang === 'tsx' ? '*.tsx' : '*.js','--',group.grep,...paths];
    const r = spawnSync(sg, ['run','--lang',lang,'--pattern',pattern,'--json=compact',...paths], {encoding:'utf8',maxBuffer:40*1024*1024});
    if (r.error) throw r.error;
    if (r.status !== 0 && r.status !== 1) {
      const g = spawnSync(rg,grepArgs,{encoding:'utf8',maxBuffer:10*1024*1024});
      if (g.error || (g.status !== 0 && g.status !== 1)) throw g.error || new Error(g.stderr);
      return {pattern,lang,paths,exit:r.status,error:r.stderr,matches:[],crosscheck:{command:['rg',...grepArgs],exit:g.status,output:g.stdout}};
    }
    const matches = JSON.parse(r.stdout || '[]').map(m => ({file:m.file.replaceAll('\\','/'),line:m.range.start.line+1,text:m.text}));
    let crosscheck;
    if (!matches.length) {
      const g = spawnSync(rg,grepArgs,{encoding:'utf8',maxBuffer:10*1024*1024});
      if (g.status !== 0 && g.status !== 1) throw new Error(g.stderr);
      crosscheck = {command:['rg',...grepArgs],exit:g.status,output:g.stdout};
    }
    return {pattern,lang,paths,exit:r.status,matches,crosscheck};
  }));
  results.push({...group,missingPaths:group.paths.filter(p=>!fs.existsSync(p)),queries});
}
fs.writeFileSync(__dirname+'/structural-audit-results.json', JSON.stringify(results,null,2)+'\n');
for (const g of results) {
  console.log(`${g.id}. ${g.claim}`);
  for(const q of g.queries) console.log(`  ${q.pattern}: ${q.matches.length} matches${q.crosscheck ? '; rg '+(q.crosscheck.exit===0?'found text (inspect)':'also zero'):''}`);
  if(g.missingPaths.length) console.log('MISSING: '+g.missingPaths.join(', '));
}
