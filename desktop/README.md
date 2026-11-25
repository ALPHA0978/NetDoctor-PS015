# NetDoctor Desktop

Windows Electron client for AIORI PS-015. Offline examples load without Wi-Fi or Python. Measured lab and live host runs need the sibling Python backend, while live host testing also requires permission for the connected network.

## Run on Windows

1. Install Node.js and Python 3 (Python is unnecessary for controlled demos).
2. In this directory: `npm install` and then `npm start`.
3. Pick Lab faults for actual isolated measurements of the five lab scenarios, Offline for a synthetic fixture, or Live host to sample the connection on this Windows PC. Lab faults do not change network settings.
4. Retest from a result and compare matched readings. Use Retest without fault to compare against the clean lab baseline. Export redacted evidence as PDF, HTML or JSON using the Save dialog.

The desktop starts `../backend/server.py` if its local service is not already running. It calls only the loopback endpoint on port 8765 by default. Electron denies renderer network access, window creation, navigation, webviews, and permissions. Only three purpose-specific IPC operations are exposed. No credentials are needed. Results are stored on this machine and can be cleared. Files already exported must be removed separately.

A live observation is not an ISP fault adjudication. Unsupported or blocked measurements remain unavailable. No device names, router IDs, raw addresses, or credentials are intended to be stored or exported. A remote support submission is never automatic.

## Portable Windows folder

Run `powershell -NoProfile -File .\make-portable.ps1` after dependency installation. Open `release\NetDoctor-win-x64\NetDoctor.exe` while leaving its companion files in place. This is an unsigned portable bundle, not an installer. Verify the native launch on the presenting Windows PC before relying on it. Lab and Live still need Python 3 on that PC.

## Verify

Run `npm run check` and `npm test`. Run `npm run test:desktop` for the hidden Electron renderer smoke test; set `NETDOCTOR_SMOKE_LAB=1` to also exercise the real lab backend. To resync offline fixture data after backend changes, run `python sync_demo.py`. npm install needs Electron's binaries once; after that controlled cases do not need Internet access.
