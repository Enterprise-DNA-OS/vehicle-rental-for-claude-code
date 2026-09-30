# Rental desk CLI

Use `npm run rental -- <command>`. Add `--json` for structured output. Flags use equals signs. Quote names and notes containing spaces. Times must include a timezone, for example `2026-12-01T09:00:00+13:00`. Replace example dates with your actual booking dates. No command sends or processes money.

## Read the desk

`fleet`, `drivers`, `board`, `pickups`, `returns`, `attention`, `compliance`, `service-due`, `damage`, `infringements`, `balances`, `utilisation`, `rate-review`, `quiet-bookings`.

`booking RC-1021` reads one full booking. Names match case-insensitively. UUID prefixes work. If several records match, read the printed candidates and supply a full reference.

```bash
npm run rental -- availability --from=2026-12-01T09:00:00+13:00 --to=2026-12-04T09:00:00+13:00 --location=Auckland
```

## Register fleet and a driver

```bash
npm run rental -- add vehicle --plate=ABC123 --model="Toyota Corolla" --category=Compact --location=Auckland --daily-cents=9500 --service-km=50000 --km=40000 --currency=NZD --jurisdiction=NZ
npm run rental -- add driver --name="Jordan Example" --external-id=C100 --email=jordan@example.test --address="10 Example Road" --dob=1990-01-01 --phone="demo number"
npm run rental -- verify-driver "Jordan Example" --number=EXAMPLE --jurisdiction=NZ --expires=2028-12-31 --class-verified=yes
npm run rental -- certify ABC123 --inspection=2027-03-01 --registration=2027-06-01
npm run rental -- service ABC123 --km=40000 --next-km=50000 --due=2027-03-01 --cost-cents=12000 --note="Service completed, job W100"
```

Record verification and certificate dates only after checking the original evidence. NZ rental cars require the appropriate CoF. Inspection expiry is a generic date field, not a check of certificate authenticity. Australian vehicles need the applicable state's inspection and registration policy configured.

## Reserve and depart

```bash
npm run rental -- book R100 --vehicle=ABC123 --driver="Jordan Example" --from=2026-12-01T09:00:00+13:00 --to=2026-12-04T09:00:00+13:00 --return-location=Auckland --excess-cents=250000
npm run rental -- add-driver R100 --driver="Aroha Williams"
npm run rental -- agreement R100 --reference=AG-R100 --copy-given=yes --insurance-offered=yes --terms-reviewed=yes
npm run rental -- precheck R100 --km=40000 --fuel=full --note="Tyres and body inspected, photos stored with AG-R100"
npm run rental -- pickup R100
```

The agreement flags record an event that already happened. Rendered hire schedules alone are incomplete. Pickup is allowed only during the agreed interval, at the vehicle's current depot, with all checks clear and no vehicle still out. Future reservations can coexist with a vehicle currently out; availability is deliberately conservative until its return.

```bash
npm run rental -- extend R100 --to=2026-12-05T09:00:00+13:00
npm run rental -- log R100 --note="Extension agreed by phone"
```

Extensions recheck overlaps and evidence. Cancellation is `cancel <ref>` and applies only to reservations. No booking or historical note is deleted.

## Return and prepare

```bash
npm run rental -- return R100 --km=41200 --fuel=half --note="Rear bumper scrape photographed" --location=Auckland
npm run rental -- damage-add R100 --note="Rear bumper scrape" --cents=45000 --evidence=photos/R100-bumper
npm run rental -- damage-decide R100 --damage=<damage-id> --decision=charge --note="Amount agreed after estimate review"
npm run rental -- record-paid R100 --total-cents=28500 --reference=BANK-100
npm run rental -- ready ABC123 --checked=yes
```

Use `--decision=waive` to waive an open damage finding with a reason. Decided damage cannot be charged twice. `record-paid` sets the cumulative payment total, not an increment, after reconciliation outside this system. Balances can be negative when overpaid. No card details or tokens belong here. Preparation does not clear expired certificates or services.

The charge estimate uses whole 24-hour periods rounded up, minimum one day, from agreed pickup to actual return or planned return while open, plus extras and approved damage. Rates and tax treatment come from the booking. Fuel, distance, early-return and late-return policy need customisation to match the actual agreement. Estimates are not tax invoices.

## Notices and drafts

```bash
npm run rental -- notice-add R100 --notice=N100 --authority="Issuing authority" --at=2026-12-02T14:00:00+13:00 --due=2026-12-20
npm run rental -- notice-status R100 --notice=N100 --status=disputed --evidence=correspondence/N100
npm run rental -- draft-return R100
npm run rental -- export
```

Notice status is `nominated`, `disputed` or `closed`, and requires an evidence reference. Due dates come from the actual notice. Custody checks do not prove who drove. Use the authority's declaration process separately. Drafts go to drafts/, exports to exports/, both ignored by Git.
