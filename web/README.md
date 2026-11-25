# NetDoctor Web · AIORI PS-015

Responsive Next.js frontend for the local Python collector. Controlled data never counts as measured household evidence.

## Launch on Windows

From the project root, first run `python .\backend\server.py` in one PowerShell terminal. In a separate terminal:

```powershell
cd web
npm install
npm run dev
```

Open http://localhost:3000. Start with **Controlled demo**; if the collector is online, choose one of the labeled loopback cases. Without the collector, built-in recorded examples still work, marked as **not measured**. For a real check, choose **Live collector**, set your actual access medium, and run the test. Live probing runs on the computer hosting Python, never from browser APIs. If checks cannot distinguish causes, the app reports inconclusive rather than asserting ISP, cable, interference, or another unsupported cause.

The default collector is loopback at `http://127.0.0.1:8765`. Set `NEXT_PUBLIC_NETDOCTOR_API` before building if you intentionally use a private-network collector. Do not expose the collector to the public Internet; review its permissions and allowed browser origins.

## Blind lab and evidence workflow

With the collector online, choose **Pick a fault**. The browser measures a hidden controlled case, including a compound inconclusive case when available. It won't save or export the hidden case before you choose **Reveal injected condition**. Then **Retest without fault** runs a fresh clean control. **Support note** produces a local plain-text file ordered by initial verdict, deciding evidence, retest, and safe next step. It never emails a provider or treats a lab retest as a household recovery.

Run a case, review observations and confidence, follow a suggested step, then retest. Comparison shows matched start/end measurements and refuses mismatched source, access, case, or units. History retains up to 16 runs in this browser. **Print / PDF** prints the report only, and **JSON** exports the documented evidence fields. Report sharing is always user-initiated.

Firebase cloud copies are optional. Copy `.env.example` to `.env.local`, enter the user's own Firebase web config, enable Anonymous sign-in, and apply the supplied Firestore ownership rules before enabling this path. Each explicit save goes to `users/{uid}/reports/{reportId}`. Anonymous sessions are browser-specific rather than cross-device identities; this is not a shared report link. Neither Firebase nor internet access is required for the controlled demo.

## QA

`npm test`, `npm run typecheck`, `npm run build`. The optional static build (set `NETDOCTOR_STATIC=1` before building) emits `out/`. Serve it over local HTTP, never by opening `index.html` directly. The collector must allow the static host origin for measurements; if using Python's local static server, bind it to `127.0.0.1:3000` for the default allowlist. If port 3000 is occupied, serve on an unused port and add its exact loopback origin via NETDOCTOR_ORIGINS before launching Python. Keep the browser and collector on loopback for local demos. CSP/security remains the responsibility of any future deployed host.

If registry download fails on this PC, `node scripts/reuse-local-deps.cjs "<trusted-existing-project>\node_modules"` can stage the declared dependency tree for offline verification, without changing the donor project. Then use `node node_modules/next/dist/bin/next dev` (or `build --webpack`). Do not copy dependency caches or link them into submissions.


