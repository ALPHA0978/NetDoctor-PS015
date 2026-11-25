# Blind evaluation handoff
The Windows runbook and jury deck separate the prior five-condition baseline from the six-case blind design. Supply the separate test report and raw evidence before claiming a newer score.

## Result record
Record the date, OS/build identifier, demo build or commit identifier, mode and test command. For each case, record expected outcome, hidden-label UI state before reveal, observed outcome, per-probe observations (units/counts), reveal match, and pass/fail. Clean retest and evidence export need their own outcomes; label failures/skips and visibility limitations. A green HTML view is not a test result.

| Case | Expected interpretation | Observed | Evidence reference |
|---|---|---|---|
| Clean | No fault observed | Pending | |
| Gateway | Gateway unreachable | Pending | |
| DNS | Resolver failure | Pending | |
| Loss | Measured packet loss | Pending | |
| Congestion | Loaded delay / congestion | Pending | |
| Compound | Inconclusive | Pending | |

Report the actual matching count and denominator only after evaluating retained output. Keep automated test counts separate from measured case counts. Keep all read-only live checks separate from loopback results; neither is a field-accuracy evaluation. If Gemini or volunteered endpoints were not exercised, say so explicitly.

