# Gerai Private Sync Model

## Position

Gerai should treat business memory, briefs, and Atmaja chat as local-first data. The app must not send them to an API bridge, analytics service, or hosted runtime unless Matthew explicitly enables that path.

## Syncthing Fit

Syncthing is useful here as a private file transport, not as an app database. The safe pattern is:

1. Gerai exports a `gerai-private-vault-YYYY-MM-DD.json` file.
2. Matthew stores that file inside a Syncthing folder shared only with owned devices.
3. Another Gerai install imports that vault file when needed.

This keeps the browser app from controlling Syncthing directly while still using Syncthing for device-to-device sync.

## Recommended Syncthing Settings

- Pair only known devices by Device ID.
- Prefer owned devices for plaintext folders.
- If a cloud/VPS device is used only as a relay/storage hop, configure it as an untrusted encrypted device and treat that Syncthing feature as beta/testing.
- Keep the Syncthing GUI bound to localhost unless there is a deliberate reverse-proxy setup.
- Protect the Syncthing config and keys with full-disk encryption or an encrypted volume.

## App Guardrails Implemented

- `VITE_GERAI_AGENT_BRIDGE=off` by default, so new briefs are not posted to `/api/agent/briefs`.
- `VITE_GERAI_TELEMETRY=off` by default, so Vercel Analytics and Speed Insights do not run unless explicitly enabled.
- Settings includes Private Sync Vault export/import for localStorage-backed Gerai data.
- The AI Department map now labels Business Memory as local/private memory and routes sync through Skill Automation.
- The vault checksum detects accidental corruption, not malicious tampering. Device trust and encrypted disks still matter.

## Sources

- Syncthing repository: https://github.com/syncthing/syncthing
- Getting started and Device ID model: https://docs.syncthing.net/intro/getting-started.html
- Security principles: https://docs.syncthing.net/users/security.html
- Untrusted encrypted devices: https://docs.syncthing.net/users/untrusted.html
