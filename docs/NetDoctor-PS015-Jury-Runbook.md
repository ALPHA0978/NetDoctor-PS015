# NetDoctor · PS-015 | Jury runbook
**Windows reference demo · Isolated loopback lab · Official team name pending**

### What to show (about 90 seconds)
1. Open the Windows desktop app and confirm **Local Python ready**. Enter **Pick a Fault**. State that the numbered selections are local test cases, not network disruptions.
2. Ask the judge to pick an unopened choice. Let the app run the local probes. Read the independent verdict and the supporting observations while the injected condition stays hidden. Explain the gateway, DNS, packet return, and idle/loaded RTT evidence.
3. Reveal only the injected condition and compare it to the verdict. Then select **Run clean retest** and compare the same measurements.
4. Select **Export result PDF** (or JSON) for the redacted support handoff. Point to run ID, timestamp, source (controlled loopback), observations and sample counts, likely cause or **Inconclusive**, and safe next action. Review the exported report before sharing.

### How to read the six cases
| Case | Evidence to show | Interpretation to verify |
| --- | --- | --- |
| Clean control | Gateway response, valid DNS response, all numbered replies, no abnormal loaded-delay signal | No fault observed under these test conditions |
| Gateway unreachable | Gateway surrogate does not answer; inspect remaining observations and their scope | Gateway reachability failure in lab, not a physical-cable diagnosis |
| DNS failure | Gateway surrogate answers but the lab resolver returns a failure status | Resolver failure in lab, not an ISP-wide outage claim |
| Induced packet loss | Numbered datagrams sent versus returned, with the sample size shown | Loss for this trial |
| Congestion | Measured idle and loaded RTT, with units and sample scope | Delay under local load, not a broadband speed test |
| Compound / conflicting | More than one fault signal supports competing explanations | **Inconclusive**; do not force a single cause |

### Preflight and fallback
- Rehearse with the exact Windows presentation build. Confirm local Python, blind reveal, clean retest, and a new export. Do not use a real customer network for fault injection.
- If a measured local run is unavailable, say so. Show the clearly labeled recorded evidence or fixture, then explain the workflow. Do not call it a fresh measurement.
- The prior baseline is **15/15 across three rounds of five single-condition Windows loopback cases**. That did not include the compound or blind-flow result. Use the separately produced test report and raw evidence for the new build, not the prior count.

### Scope and limits
- **Lab:** Local loopback, controlled service surrogates, no external fault injection, no field accuracy claim.
- **Live:** Separate, read-only network measurements; no user-network configuration changes. No definitive cable damage, ISP-internal fault, or Wi-Fi interference attribution without suitable telemetry.
- **Future:** Volunteer field pilot is a design only. No volunteer endpoints yet. Consent, verified access medium, repeated measurements, and a bounded documented load endpoint are prerequisites.
- **Gemini:** Optional assistance, not required for measured diagnosis or handoff. No live Gemini key is assumed or demonstrated.

