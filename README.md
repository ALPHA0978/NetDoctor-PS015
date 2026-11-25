# NetDoctor | AIORI-3 North / PS-015

Explainable home and last-mile connectivity diagnosis. The Windows desktop is the primary official demo; web and Android are companion apps. Nothing is deployed to the public Internet.

## Run on Windows

On a fresh checkout, install Node.js and Python 3, then run `npm ci --prefix desktop` from the repository root. Double-click **Run-NetDoctor.cmd**. Use **Pick a Fault** to start the jury demonstration with real local measurements, then select **Live** for read-only checks on this PC's actual network. A fault label configures the isolated lab, not the diagnosis rules. Live checks never change system or network settings.

After installation, the offline evaluation packet is in **docs/jury/**. It contains the test report, raw evidence and accompanying material. The field protocol is in **docs/FIELD-PILOT.md**; it is not a completed field study.

- Python engine: from the root, run python backend/server.py. Default address: http://127.0.0.1:8765. No Python packages are needed for the runtime.
- Portable Windows build: after installing the desktop dependencies, run `powershell -NoProfile -File desktop/make-portable.ps1`. The launcher uses the portable build when present.
- Built web demo: run `npm ci --prefix web`, set `$env:NETDOCTOR_STATIC = '1'` in PowerShell, and run `npm run build --prefix web` to create `web/out`. Close NetDoctor Desktop, double-click **Run-Web-Demo.cmd**, and open http://127.0.0.1:8766. The built demo runs offline.
- Next.js development: cd web, then npm ci and npm run dev. Open the local address listed by Next.js (normally http://localhost:3000). Keep Python running in a separate terminal. Never expose the measurement server to the public Internet.
- Android: cd android, npm ci, then npm start. Use the compatible Android Expo Go client on the same trusted Wi-Fi. The Android app can show handset OS connection status. Results using the Python API measure the PC, not the phone. To connect that optional path, bind the service to Raj's specific private IPv4 address using python backend/server.py --host PRIVATE_IPV4 and enter the corresponding URL in Android. Stop the service when finished. Do not bypass Windows firewall or Android network restrictions.

## 90-second walkthrough

1. Run the **clean control** in the measured lab to show the normal readings.
2. Run **Gateway unreachable**, **DNS failure**, **Induced packet loss** and **Congestion**. These are real loopback socket measurements from intentionally controlled conditions, with no changes to Windows or your router.
3. Show the distinguishing lines: failed gateway with healthy control services, DNS SERVFAIL, 7 of 10 numbered datagrams returned, and increased loaded median RTT on a bounded 512 KiB transfer.
4. Run the clean control as a comparison. Show the measured Inconclusive case: the gateway surrogate did not reply and DNS returned SERVFAIL, but all numbered datagrams arrived. An offline fixture is not measured evidence.
5. Export the report. Run one normal live host check if connectivity is available, but do not depend on site Wi-Fi for the controlled demo.

## Tests and report

- cd backend; python -m unittest -v
- From backend: python evaluate.py --rounds 5 --out ../docs/control-evaluation.json
- From repository root: python docs/make_report.py --team "Your official team name"
- Keep the technical report and spreadsheet-free raw JSON together. Complete the official team name before submission.
- The official event submission requires a private team repository, organizer collaborator access, and later ownership transfer.

## Privacy and limits

Read-only host checks use the local default IPv4 gateway, the OS resolver, and bounded TLS/fixed-IP checks. Reports deliberately avoid SSIDs, MAC addresses, local gateway addresses and router credentials. Diagnostic suggestions do not reset DNS or adapters. No Wi-Fi interference, definitive damaged cable or ISP-internal fault is inferred. Congestion, loaded latency and throughput are measured in the loopback lab, not represented as field broadband speed. Real access-medium comparisons still need consented volunteer endpoints and verified access documentation.

Firebase is optional, user-triggered cloud copying from the web app. Connect a dedicated Firebase project using the web example configuration and deploy the supplied owner-only Firestore rules to that project. Do not reuse an unrelated project or put Admin credentials in a client. The demo uses local data and never requires Firebase approvals, accounts or network recovery.

## Optional volunteer baseline runner

After receiving explicit endpoint consent, run the following on the volunteer machine (not on their behalf in the background):

    python backend/pilot.py collect --consent --endpoint home-A04 --medium fiber --verification self-reported --link wifi --count 3 --interval 120 --out home-A04.jsonl

Only use "observer-verified" if the field operator separately verified the access medium; the app does not verify it automatically. Review the redacted JSONL manually before pooling it. Compare with:

    python backend/pilot.py compare home-A04.jsonl home-B19.jsonl

The comparison excludes unverified access labels and separates Wi-Fi from wired access. It is descriptive and not a national performance ranking.

## Source map and verification

Gemini and theme setup: see docs/GEMINI.md.

See docs/ARCHITECTURE.md, or run powershell -File scripts/verify.ps1 after installing the three clients' locked dependencies.
