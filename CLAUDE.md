# Vehicle Rental for Claude Code

## Business context

This is a car, van and campervan rental desk. The demo business is Koru Coast Rentals in Auckland and Christchurch. All demo people, plates and evidence references are fictional. Before real use, the operator supplies their business name, depots, jurisdiction, currency, agreement terms, insurance policy, service intervals and people responsible for approvals. Put the brand in brand.json. Record agreed rates as tax-inclusive or tax-exclusive consistently and document that choice here.

## Working rules

Read the records through scripts/rental.mjs before answering. The one database adapter chooses an embedded PGlite database or the supplied DATABASE_URL. All timestamps are explicit ISO values with timezone offsets, displayed in UTC. Never infer dates from local machine settings.

Use the routing table below. CLI syntax lives in docs/cli.md. A script refusal names what needs fixing. Do not bypass it with direct writes or an invented inspection. Physical licence checks, insurance offers, signed terms, departure checks and vehicle returns must have happened before recording them. Compliance here checks evidence and operator policy, not an entire legal obligation.

Keep customer information in the operator's database. Drafts, exports and rendered documents contain personal information. Do not commit or send them. No email, card processing, toll charging, nomination submission, public deployment or deletions happen here. A person uses the established external service to send, pay or submit. Returned cars stay cleaning until checked. Money is integer minor units with a currency on every booking. Never add AUD and NZD.

Use migrations for changes, never edit an applied migration. npm test uses a temporary embedded database and never a configured production connection. Treat the demo database as disposable only when the operator confirms it contains no real data. For real use choose a fresh DATA_DIR and run migrate, then import. Do not load demo fixtures into production.

## Routing table

| Job | Command |
|---|---|
| The rental desk decisions | /attention |
| Fleet readiness | /fleet |
| The reservation book | /board |
| Prepare the pickup desk | /pickups |
| Chase overdue returns | /returns |
| Plan the workshop | /service-due |
| Decide the damage register | /damage |
| Work the notice deadlines | /infringements |
| Reconcile rental balances | /balances |
| Review fleet use | /utilisation |
| Check agreed rates | /rate-review |
| Follow up quiet bookings | /quiet-bookings |
| Review driver records | /drivers |
| Review rental evidence | /compliance |
| Read one booking | /booking |
| Answer an availability request | /availability |
| Book a vehicle | /book |
| Hand over a vehicle | /pickup |
| Check a vehicle back in | /return |
| Write a desk note | /log |
| Draft a return follow-up | /draft-return |
| Bring bookings across | /import |
| Export the rental records | /export |
| Monday review | /weekly-review |
| Add a field or change a business rule | /customise |
| New read-only report | /new-view |
| Render branded paperwork | npm run docs |
| Render the desk dashboards | npm run view |

## Files

scripts/rental.mjs is the one rental CLI. supabase/migrations contains the schema. documents.json and views.json define output through the shared template renderer. docs/compliance.md lists sources and limitations. docs/replace-rental-car-manager.md describes the import mapping. AGENTS.md routes other coding agents here.

Omni by Enterprise DNA can install and operate this for your business. https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=rental-car-manager
