# NetDoctor field pilot | PS-015

This is the protocol to use after the jury demo, not a claim of field results.

## Question
Can a resident and a support technician agree on the next diagnostic step faster with NetDoctor than with an unstructured “Internet is slow” report?

## Collection
1. Ask each volunteer to opt in on their own endpoint. Describe what is probed (the local gateway, two fixed external HTTPS/DNS destinations, and one fixed TCP target), what stays local, and that they can stop at any time or withhold the file.
2. Assign a pseudonym such as home-A04. Verify the physical access medium separately, with permission, from the provider plan or visible equipment. Record the verification method, not the plan number, subscriber name, address or identifiers. Keep unverified runs out of between-medium comparisons.
3. On the same computer and same Internet subscription, run a short wired series and a short Wi-Fi series, ideally close together and during the reported symptom. Repeat the pair in another time window. Do not change adapter or router settings on a volunteer’s behalf. Record VPN use and busy/idle use as contextual labels without collecting browsing history.
4. From each volunteer machine, run the following with consent. Confirm the actual link and access medium before choosing those labels:

    python backend/pilot.py collect --consent --endpoint home-A04 --medium fiber --verification observer-verified --link ethernet --count 3 --interval 120 --out home-A04-wired.jsonl

   Repeat with --link wifi and a different output file. This is bounded collection initiated by the volunteer, not background monitoring. Do not expose the measurement API to the Internet.
5. Review the pseudonymous files locally and remove any free-form notes that reveal private details before manually sharing. Keep collection, retention and deletion agreed in advance.

## Analysis
- Start small: three consenting households, two time windows per home, matched link pairs where practical. Report the number of homes, runs, available readings and missing readings for every group.
- Compare matched Wi-Fi and Ethernet runs within each home first. Only then compare access-medium groups using like-for-like links and windows. Gateway values describe the local link. DNS timing can include an OS cache.
- Record diagnosed, no fault observed, and inconclusive separately. Ask a support reviewer to judge whether the suggested next step follows the evidence; do not equate agreement with verified root cause.
- Track time to a defensible next step and whether the reviewer asks for more evidence. Compare a plain symptom versus a separately presented NetDoctor report. Avoid claims of national accuracy or causal ranking.
- Broadband throughput and under-load field RTT need a separately approved test endpoint, documented payload budget, repeated paired observations and consent. The current collector does not measure either. Laboratory throughput is not an ISP speed estimate.

