# NetDoctor for Android

AIORI PS-015 · Expo SDK 56, React Native 0.85. This Android app can work without Firebase, accounts, a public service, or the venue internet connection after loading its bundle. One desktop probe and one app are separate vantage points; their results must never be treated as interchangeable.

## Start on Raj

1. Open PowerShell in this directory and run `npm.cmd ci` (or `npm.cmd install` if no lockfile is available).
2. Run `npm.cmd start`.
3. Connect a phone and Raj to a trusted Wi-Fi or a private hotspot. Use Android Expo Go compatible with **SDK 56**; the [official Android build selector](https://expo.dev/go) covers version mismatches. Scan the Metro QR code. Do not use a tunnel or expose Metro to public networks.
4. Use **Check → Offline examples** with no Python API. Use **This phone** to read Android's connection/reachability flags. Device state is not an app-run speed test or ISP diagnosis.
5. Optional desktop checks: start the repo's Python API with its documented LAN configuration, confirm the phone and PC are on the same trusted LAN, go to **Setup**, and enter your own PC address such as `http://192.168.1.10:8765`. Test and save it. In an Android emulator, host loopback is typically reached at `10.0.2.2`. Do not enable public port forwarding. If Android or a managed Wi-Fi policy blocks local HTTP, switch to a trusted hotspot or a developer build. Use `EXPO_PUBLIC_NETDOCTOR_API` only to prefill your own demo address; it is bundled and is not a secret.

To create a distributable Android build on a machine with Android Studio, SDK/Java configured, run `npx expo prebuild --platform android` then build the generated native project with Android Studio/Gradle, or use a team-approved distribution pipeline. The local LAN connection uses cleartext HTTP intentionally for this prototype, scoped by the app to loopback or a private IPv4 address; a production client should use a trusted HTTPS API instead.

## Demonstration

For organizer lab tests, connect the Python service, choose **Measured lab**, and run gateway unreachable, DNS failure, induced packet loss, congestion, and **Conflicting signals**. The conflicting-signals run should return an inconclusive diagnosis: the PC lab gateway does not reply, its DNS returns SERVFAIL, and 10/10 numbered datagrams return. This is separate from the simulated **Not enough evidence** example and from Android’s own **This phone** status. From a measured lab report, choose **Compare with clean lab control** to see the evidence after intentionally removing the fault. The measured lab uses PC loopback; it demonstrates the diagnostic method, not your own household or ISP. With no Python API, choose **Offline examples → Weak home Wi-Fi** then **Possible provider-side issue** to demonstrate reading synthetic evidence and next actions. Switch to **Not enough evidence** to demonstrate abstention. On any report, use **Retest this setup** to repeat a comparable run and **Share privacy-filtered JSON** for a portable case. Demo retests repeat a single fixture and cannot demonstrate a real improvement. History stores at most 40 reports on this phone; deliberately clear it from History if needed.

No Android SSID, BSSID, device IP, device location or permissions for those fields are requested by the app. An export excludes the saved endpoint and non-contract response fields, and strips common network identifiers from text. Always review a report before sharing.

## Verification

- `npm.cmd test`: Node contract/fixture, redaction, local transport and retest tests.
- `npm.cmd run test:integration`: launch the checked-in Python backend on an ephemeral local port, exercise the four measured faults, the measured inconclusive case, and the clean control, and verify the export. This needs Python 3 on PATH (or set `NETDOCTOR_PYTHON`).
- `npm.cmd run check`: Expo native dependency version check. If the Expo metadata host is unreachable, `$env:EXPO_OFFLINE='1'` performs a best-effort check against bundled metadata.
- `npm.cmd run bundle:android`: create a Metro Android bundle; not an APK.
- Physical check with Android Expo Go or development build: airplane mode, Android Wi‑Fi and cellular state, offline fixture and measured lab comparison, live desktop check on trusted LAN, validation of the share sheet and persistence after restarting. A build or a mocked test does not replace these steps.
