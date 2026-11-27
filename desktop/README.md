# NetDoctor Desktop

Windows Electron client for AIORI PS-015. Offline examples load without Wi-Fi or Python. Measured lab and live host runs need the sibling Python backend, while live host testing also requires permission for the connected network.

## Run on Windows

1. Install Node.js and Python 3 (Python is unnecessary for controlled demos).
2. In this directory: `npm install` and then `npm start`.
3. The dashboard opens in Live and follows the adapter Windows selects for the reference Internet route, using IPv6 when the IPv4 route is unavailable. Pick Lab for isolated loopback faults or Offline for an example.
4. Retest from a result and compare matched readings. Use Retest without fault to compare against the clean lab baseline. Export redacted evidence as PDF, HTML or JSON using the Save dialog.

The desktop starts its own `../backend/server.py` on an available loopback port. Electron denies renderer network access, window creation, navigation, webviews, and permissions. Local diagnostics need no credentials. Diagnostic results are stored on this machine and can be cleared. Files already exported must be removed separately.

The Network flow view shows the connection medium, device address, and gateway reported for the active adapter. Windows supplies the Wi-Fi network name when available. The traffic chart derives current receive and send rates and sampled five-minute totals from Windows interface byte counters, which include LAN traffic. The reported link speed describes the adapter link. App and destination lists show established TCP connection counts on that interface. The dashboard keeps these readings in memory and excludes raw addresses and process names from saved reports.

Open **Network map** in the sidebar to inspect a selected app and its destination IPs, ports, and established TCP sockets. **Measure TCP traffic** uses Windows TCP extended statistics when NetDoctor is already running with administrator access. Rates come from sockets observed in consecutive samples. UDP, QUIC, and connections that close between samples are outside those readings, and destination IPs cannot identify individual browser tabs. Measurements are local to the desktop and stop polling when you leave the map.

After a live diagnostic, use **Recommendations → AI next step → Share readings and explain**. Gemini ranks the redacted diagnostic measurements and selects an approved action from the report. On Windows, run `Run-Gemini-Demo.ps1 -SetKey` once to save the key for your Windows account. `Run-NetDoctor.cmd` uses the saved key when it starts the desktop measurement service.

## Chrome tab priority

To investigate a slow page, open **NetDoctor Tab Priority → Diagnose this tab**, close the popup, and reproduce the slowdown. Reopen the popup to stop and see results, or let the capture stop automatically after up to 30 seconds. It shows timings for the five longest completed requests and keeps only site origins and timing metadata in the browser session.

For other apps, select the app in **Network map** and choose **Diagnose** on an observed destination. The desktop makes one timed TCP connection and reports reachability and recent adapter traffic. This measures connection setup from the PC. Internal app processing and service response times require app-specific measurements.

Open `chrome://extensions`, turn on **Developer mode**, and use **Load unpacked** to select the repository’s `chrome-focus` folder. Open the website tab you want to prioritize. Click **NetDoctor Tab Priority** in Chrome’s extensions menu, select the competing tabs in the same window, then apply a 0.5, 1, or 2 Mbps cap per tab in each direction.

Limits expire after 15 minutes. Use **Stop and restore tabs** to release them sooner. Closing the priority tab also releases the limits. Chrome displays its debugging indicator on limited tabs. The extension uses the debugger permission for request throttling and keeps the session local. The available benefit depends on whether the selected tabs are competing for the same connection. The caps apply to supported Chrome requests and do not provide router-level QoS or reserve bandwidth.

A live observation is not an ISP fault adjudication. Unsupported or blocked measurements remain unavailable. No device names, router IDs, raw addresses, or credentials are intended to be stored or exported. A remote support submission is never automatic.

## Portable Windows folder

Run `powershell -NoProfile -File .\make-portable.ps1` after dependency installation. Open `release\NetDoctor-win-x64\NetDoctor.exe` while leaving its companion files in place. This is an unsigned portable bundle, not an installer. Verify the native launch on the presenting Windows PC before relying on it. Lab and Live still need Python 3 on that PC.

## Verify

Run `npm run check` and `npm test`. Run `npm run test:desktop` for the hidden Electron renderer smoke test; set `NETDOCTOR_SMOKE_LAB=1` to also exercise the real lab backend. To resync offline fixture data after backend changes, run `python sync_demo.py`. npm install needs Electron's binaries once; after that controlled cases do not need Internet access.
