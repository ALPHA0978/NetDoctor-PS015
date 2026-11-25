# Architecture and maintenance

Start with the root README for demo commands. Source, generated output, and evidence serve different purposes; edit source rather than files inside a build.

| Area | Source to edit | Generated output |
| --- | --- | --- |
| Web | web/app is the Next.js entry; web/src/Dashboard.tsx coordinates runs and state; web/src/components owns setup, evidence, history, privacy, SVG artwork, and shared formatting | web/out |
| Windows | desktop/main.cjs owns the trusted process, preload.cjs exposes narrow actions, renderer.js coordinates the UI, src/result-view.js renders evidence without running diagnostics | desktop/release/NetDoctor-win-x64 |
| Android | android/App.js wires state and navigation; android/src/screens contains four screens; android/src/components and theme.js contain UI primitives and styles; diagnostics.cjs owns report and transport logic | android/dist (bundle, not an APK) |
| Python | backend/server.py owns HTTP validation and serving; probes.py owns read-only platform measurements; diagnosis.py owns scenarios, decision rules and evidence; lab.py owns isolated loopback conditions | docs/control-evaluation.json captures run evidence |
| Optional cloud | web/src/firebase.ts handles explicit saves; root firebase.json and firestore.rules define owner-scoped storage | No deployed Firebase project |
| Handoff | docs contains the draft technical report, editable jury deck and their generators; scripts/verify.ps1 runs the platform suites | Report and deck are not edited as source |

## Data boundaries

- Desktop main and mobile/web collectors consume the same Python HTTP contract: GET /health, GET /scenarios, POST /diagnose with mode, access, and optional scenario.
- The controlled loopback lab and offline fixture never masquerade as a live host result. The desktop packages backend Python source as a separate resource; Python 3 remains a prerequisite for measured modes.
- Uncertain or conflicting signals yield Inconclusive. No network configuration is modified.
- Keep browser Firebase explicit, and use local JSON/PDF export when not configured.

## Verify or rebuild

From this folder on Windows, after installing each client’s locked dependencies (npm.cmd ci inside web, desktop and android):

    powershell -File scripts/verify.ps1
    powershell -File scripts/verify.ps1 -Build

For a native desktop recheck run npm.cmd run test:desktop in desktop (requires a working Electron session). Android device UI and Firebase are separate from the automated suites. Do not report a device pass based on a Metro export.
