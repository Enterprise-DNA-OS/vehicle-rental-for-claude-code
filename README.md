# Vehicle Rental for Claude Code

Your fleet, bookings, drivers, damage and rental paperwork in a database you own. Built by Enterprise DNA. MIT licence.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free code. Install it and run your own database. | Your fields, rules, data migration, preferred stack and a web front end if needed. | Installed, connected and operated through Omni by Enterprise DNA. One setup fee, then a retainer. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=rental-car-manager) | [Book a call](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=rental-car-manager) |

Works with Claude Code, Codex, OpenCode or Cursor. Read [AGENTS.md](AGENTS.md).

## What it does

The rental desk reserves a vehicle at an agreed rate, records driver and agreement checks, handles pickup and return, tracks damage decisions and notice deadlines, and reviews balances. Overlapping reservations fail. The pickup step checks stored licence evidence, agreement delivery, insurance offer, vehicle certificates, service and departure condition. A returned car waits for cleaning before it becomes ready.

This is a working back-office base. Rental Car Manager also offers online bookings, agent connections, payments and telematics. Those services are not in this free version. Enterprise DNA scopes the connections and screens your operation needs. There is no claim of complete feature parity or of reports the incumbent can never produce.

## Quick start

Node 20 or newer:

```bash
git clone https://github.com/Enterprise-DNA-OS/vehicle-rental-for-claude-code.git
cd vehicle-rental-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
```

The demo contains six vehicles, four drivers and six bookings around Auckland and Christchurch. It deliberately includes a late return, a missed service, an expired inspection, missing driver checks, unresolved damage and an approaching notice deadline. All names and records are fictional. Dates are relative to the first seed run. Rerunning seed leaves existing records intact.

Ask `/attention`, `/pickups` or `/weekly-review`. Read the full [CLI recipe](docs/cli.md) for booking and return examples. Money is stored in cents, grouped by currency. Timestamps include an offset and display in UTC.

### Real records

Use a fresh DATA_DIR and run npm run migrate, then import. Do not run the demo against real data. An embedded database supports one process at a time. For a shared team use your own PostgreSQL connection in DATABASE_URL, provision least-privilege access, encryption, backups and retention, then run the same migrations. No hosted database was provisioned or connected by this build.

## The commands

- `/attention`: The rental desk decisions.
- `/fleet`: Fleet readiness.
- `/board`: The reservation book.
- `/pickups`: Prepare the pickup desk.
- `/returns`: Chase overdue returns.
- `/service-due`: Plan the workshop.
- `/damage`: Decide the damage register.
- `/infringements`: Work the notice deadlines.
- `/balances`: Reconcile rental balances.
- `/utilisation`: Review fleet use.
- `/rate-review`: Check agreed rates.
- `/quiet-bookings`: Follow up quiet bookings.
- `/drivers`: Review driver records.
- `/compliance`: Review rental evidence.
- `/booking`: Read one booking.
- `/availability`: Answer an availability request.
- `/book`: Book a vehicle.
- `/pickup`: Hand over a vehicle.
- `/return`: Check a vehicle back in.
- `/log`: Write a desk note.
- `/draft-return`: Draft a return follow-up.
- `/import`: Bring bookings across.
- `/export`: Export the rental records.
- `/weekly-review`: a Monday draft from attention, utilisation and balances.
- `/customise`: apply a migration and update the affected workflows.
- `/new-view`: add a read-only report from a business question.

Every CLI read accepts --json. Ambiguous names or partial identifiers print candidates and exit 1. [docs/cli.md](docs/cli.md) lists the write recipes. Unknown commands fail.

## Paperwork and views

Change brand.json once. npm run docs renders a hire agreement schedule draft, return condition record, balance statement and infringement evidence worksheet. Hire schedules require your reviewed terms, operator details, insurance wording and signature process before use. An evidence worksheet is not a statutory declaration. No output sends itself.

npm run view renders the rental week, fleet readiness and balances as read-only HTML. [Why no front end](docs/why-no-front-end.md) explains mobile, offline and booking-channel limits.

## Ten questions you can ask today

These are supported queries, not a claim that Rental Car Manager cannot build similar reports.

1. Which vehicles are still out after their agreed return time, and where should they come back? (`returns`)
2. Which pickups fall in the next week, including bookings whose pickup was missed? (`pickups`)
3. Which bookings have missing licence checks, agreement evidence or departure inspections? (`compliance`)
4. Which vehicles have an expired inspection, a service due or cleaning still outstanding? (`fleet`)
5. Which damage reports are still waiting for a charge or waiver decision? (`damage`)
6. Which notices need attention this week, alongside late returns and fleet blocks? (`attention`)
7. What remains owing on each returned hire after recorded payments and decided damage? (`balances`)
8. Which cars spent the most time out during the last thirty days? (`utilisation`)
9. Which future bookings have a rate different from the current vehicle rate? (`rate-review`)
10. Which open bookings have no desk note, or no note for more than three days? (`quiet-bookings`)

## Your first hour: ten things to ask for

1. Put our business name, logo and colours on the paperwork.
2. Rename the vehicle categories to match our fleet.
3. Add our actual depot names.
4. Map our Rental Car Manager booking export.
5. Add a field for an arrival flight number.
6. Change the cleaning checklist to our procedure.
7. Add a workshop evidence reference to each service.
8. Set the notice reminder window to our internal policy.
9. Add a report for pickups at one depot.
10. Review our state or country rules and add the checks we actually need.

/customise writes a new migration, applies it and runs the tests. It does not replace a current legal review or remove pickup checks.

## Switching from Rental Car Manager

The vendor confirms report exports to CSV, Excel and PDF. Export booking details, map the columns once, then import with one command. The format includes vehicle and customer fields, so new vehicles and drivers can be created in the same transaction. Exact report headers vary and no real customer export was provided for this build. The [switch guide](docs/replace-rental-car-manager.md) documents every required field and the checks before cutover.

```bash
npm run rental -- import rental-car-manager mapped-bookings.csv --dry-run
npm run rental -- import rental-car-manager mapped-bookings.csv
```

History with actual checkout and return times can be retained. Imported vehicles remain blocked pending real preparation and certificate checks. Payment tokens, signatures, photos and external booking feeds require separate migration or connection. Keep the original exports and documents.

## Checks and scope

npm test creates a temporary database, applies and reruns migrations and seed, exercises all reads and the rental lifecycle, checks refusal paths and import rollback, renders documents and dashboards, and checks CLI output. CI runs the same suite on Windows and Linux with PGlite and on PostgreSQL 16, including a concurrent-booking check. The PostgreSQL job uses a disposable local database and an isolated schema. No hosted production deployment is part of this build.

Read [compliance sources and boundaries](docs/compliance.md). The NZ evidence checks and service policy are explicit. Australian state-specific rental and infringement requirements need configuration before deployment there. This is not a payment processor, tax ledger, driver-licence validation service or public booking website.

## Ownership

MIT licence. Your database stays yours. Agent subscriptions, hosting and operations are separate costs. Enterprise DNA can build and run your version through Omni by Enterprise DNA: [30 minutes with Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=rental-car-manager).
