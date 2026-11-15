# Server configuration

Copy `.env.example` to `.env.local` for development. Set production values in
Vercel's environment settings. Keep the template blank where a secret is needed.

| Variables | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; required in production |
| `OWNER_EMAIL`, `OWNER_PASSWORD_HASH` | Reserved owner; use a salted scrypt hash |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | Reasoning provider |
| `FISH_AUDIO_API_KEY`, `FISH_AUDIO_MODEL` | Cloud speech provider |
| `FISH_AUDIO_*_VOICE_ID` | Separate voice reference for each identity |
| `DEVICE_TOKEN_HASH` | Hash of the companion's private bearer token |
| `MIVVY_APP_URL` | Canonical HTTPS origin for callbacks |
| `CONNECTION_ENCRYPTION_KEY` | Persistent random 32-byte base64url encryption key |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Gmail read-only OAuth |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Optional Slack own-DM integration |
| `CRON_SECRET` | Protects the reminder tick endpoint |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional Web Push |
| `MIVVY_ICE_SERVERS_JSON` | Optional authenticated TURN configuration |

Generate an owner password hash with `passwordHash` in `lib/security.mjs`.
Never place a plaintext owner password in source or a client environment variable.
The owner email alone does not grant laptop access; the stored server role must
also match. An unconfigured owner cannot access a paired laptop.

Gmail callbacks use `/api/connect/gmail/callback` and Slack uses
`/api/connect/slack/callback` on `MIVVY_APP_URL`. Provider apps, consent and grants
must be configured separately. This source does not include them.

The companion's plaintext bearer token stays on the paired laptop. Only its hash
belongs on the server. Do not copy a pairing file into this repository. Cloning
this project does not pair a device.
