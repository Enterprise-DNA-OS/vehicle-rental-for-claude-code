# Moving from Rental Car Manager

Checked 30 September 2026. Rental Car Manager confirms [report exports to Excel, CSV and PDF](https://www.rentalcarmanager.com/features/reporting/), and [data export APIs](https://www.rentalcarmanager.com/features/api/). This importer uses CSV. It does not call the vendor or require an API connection.

## Export and map once

In your current RCM reporting, choose the detailed booking information for the period being moved and export CSV. Include cancelled bookings and completed hire history if required. Export vehicle and customer details to fill any missing columns. Keep the original exports intact.

The vendor's public page does not specify a fixed booking export header set. No real customer file was available when this adapter was built. The example file is a synthetic mapping contract, not a claimed vendor sample. Map your actual exported headings to the columns below and normalise timestamps, status and money. Enterprise DNA performs this mapping in the custom migration, or ask your coding agent to map the actual export and review every transformation.

## One import command

Use a fresh database, not the demo database. Apply the migration, then:

```bash
npm run rental -- import rental-car-manager mapped-bookings.csv --dry-run
npm run rental -- import rental-car-manager mapped-bookings.csv
```

The dry run validates all records inside a transaction and rolls them back. The write is atomic too. One invalid or overlapping row stops the whole batch. Missing vehicles and drivers are created from the same file. Repeated unchanged bookings are skipped by booking number. An existing booking with changed dates, rate, driver, status, payments or locations is refused so you reconcile it deliberately. The import never silently resets a live rental.

## Mapping contract

| Required column | Meaning |
|---|---|
| Booking No | Stable reservation reference. Also accepts Reservation Number, ResNo or ref. |
| Registration | Vehicle plate. Also Rego, Vehicle Registration or plate. |
| Customer ID | Stable customer key. Also CustomerID or driver_external_id. |
| Customer Name | Full name. Also Name or driver. |
| Pickup Date Time | Explicit ISO time and offset. Also PickupDate or pickup_at. |
| Dropoff Date Time | Agreed return time with offset. Also DropOffDate or return_due. |
| Pickup Location | Depot. Also pickup_location. |
| Dropoff Location | Return depot. Also return_location. |
| Daily Rate Cents | Agreed daily rate in integer minor units. Also rate_cents. |
| Currency | NZD or AUD, matching the vehicle. |
| Model | Required for a new vehicle. |
| Category | Required for a new vehicle. |

Optional: Email, Jurisdiction (NZ or AU, defaults NZ), Status (reserved by default, or out, returned, cancelled), Checkout At (actual, required for out/returned), Returned At (actual, required for returned), Paid Cents and Extras Cents (integer cumulative totals, zero when absent). Column names match case-insensitively. Do not omit payment or extras columns if those amounts exist in the source.

Map RCM's actual status labels explicitly. Do not turn every historical row into a live reservation. Convert dollar amounts to cents exactly and interpret local timestamps with the correct historical timezone offset. The importer refuses date-only values. A returned record needs actual custody times, not guessed dates.

## What needs separate work

New vehicles arrive in workshop status, with no valid certificate or service evidence. Imported drivers are unverified. Read and record actual licences, certificates and agreement evidence before a pickup. Customer addresses and licence details need verified entry or a reviewed field extension. No payment token, card number, signed agreement, image, additional driver, seasonal rate rule, damage history or notice history is imported by this adapter. Retain source archives and map those in the custom migration.

Bookings use a simple daily charging rule. Reconcile that against the actual rental terms, packages, discounts and tax basis before switching. Web bookings, agency feeds, GPS and card payments remain with their current services until the replacement connections are tested.

## Verify the cutover

Run board, fleet, drivers and balances. Compare booking counts by status, each vehicle plate, custody times, rate, extras and paid totals against the source, separately for each currency. Run compliance and resolve the evidence gaps. Render the hire schedules and return records. Test a reservation, pickup, return and dispute with the team while the old system is available. Retain a complete original export and tested backup before ending access.
