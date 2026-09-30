---
description: "Book a vehicle"
---

# Book a vehicle

Read CLAUDE.md. Read availability, driver and current rate first. Confirm actual pickup and return depots. Add a driver or vehicle with add only when facts were supplied. Do not invent a licence check.

Run `npm run rental -- book <new-ref> --vehicle=<plate> --driver=<name> --from=<ISO-time> --to=<ISO-time>`. Replace angle-bracket values with the operator's facts. Add `--json` for structured output. Report from the fresh result and identify missing facts.
