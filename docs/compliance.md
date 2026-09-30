# Rental record checks

Sources checked 30 September 2026. These checks identify missing stored evidence. They do not validate a licence with a government service, inspect a car or certify the business. NZ rules apply to NZ operation. Australian operators must configure their actual state requirements before use.

| Check | Basis | What this build does |
|---|---|---|
| LICENCE | NZ Operator Licensing Rule 2017, 4.2(5) | Requires recorded number, expiry, check time and class confirmation for the primary and additional drivers. Validity through the planned return is an operator policy. |
| AGREEMENT | Same rule, 4.2 and 4.4 | Records agreement reference, copy delivery, reviewed terms and insurance offer. Does not inspect agreement content or signatures. |
| ROADWORTHINESS | NZTA inspection guidance | Flags missing or expired inspection and registration evidence. The generic inspection field represents a CoF for NZ rental cars. |
| PRECHECK | Operator departure policy | Requires a condition note, meter and fuel reading before pickup. Not a claim of a statutory checklist. |
| Service | Operator maintenance policy | Blocks missing or overdue service dates and meter thresholds. Intervals come from the fleet maintenance plan, not a universal legal period. |
| Notices | Operator deadline policy | Shows open notices due within seven days. Due dates come from the notice. Custody is checked before linking a new notice. |

Official references: [current Operator Licensing Rule publication](https://www.nzta.govt.nz/resources/rules/land-transport-rule-operator-licensing-2017) and [May 2026 consolidated text](https://www.nzta.govt.nz/assets/resources/rules/docs/operator-licensing-2017-as-at-19-may-2026.pdf.pdf), [NZTA inspection requirements](https://vehicleinspection.nzta.govt.nz/virms/in-service-wof-and-cof/introduction/inspection-and-certification-process/establishing-whether-the-vehicle-requires-a-wof-or), [renting a vehicle](https://www.nzta.govt.nz/business/rental-vehicles/renting-a-vehicle).

A hire schedule is a draft data attachment. The operator must supply reviewed terms, business address, licence number, emergency contact, insurance terms and the signature process. Stored flags do not establish that all prescribed terms are present. A notice worksheet is not a statutory declaration and does not prove which authorised driver was driving.

The system never charges a card, files a nomination or makes a legal determination. Personal details in exports and paperwork remain private business records. Configure access, backup retention and disposal with the operator. No automatic retention period or deletion is supplied.
