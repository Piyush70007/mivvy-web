# Mivvy

A voice-first personal assistant for conversations, reminders and everyday tasks.
Andrea, Jarvis and Ultron have their own visual identity and configured voice,
while your conversations and tools stay together in your account.

**Live app:** [skulls-personal-ai.vercel.app](https://skulls-personal-ai.vercel.app)

## What is here

This repository contains the React / Next.js website and its server API. The
Windows executable and native iOS project are separate clients and are not
included in this web repository.

- A mobile-focused dark interface with expressive eyes and identity switching.
- Voice input, streamed speech playback, interruption and replay controls.
- Conversations, daily tasks, notes, reminders, habits and spending tools.
- Account-scoped history and preferences, with authenticated cross-device sync.
- Optional Gmail read-only search and messages to your own linked Slack DM.
- Owner-only laptop jobs and live screen/camera video when a compatible
  Windows companion is paired and online.

DeepSeek handles responses and Fish Audio provides the configured speech
services. Provider access is routed through the server. Voice profiles and
credentials belong to the deployment, not the repository.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000`. Fill in the server configuration needed for the
features you want to use. The template contains no working credentials.

Without `DATABASE_URL`, development uses an ignored `.local/` data store.
Production requires PostgreSQL. Set `OWNER_EMAIL` and `OWNER_PASSWORD_HASH` to
bootstrap the reserved owner account; laptop access stays disabled when the
owner configuration is missing. See [configuration](docs/CONFIGURATION.md).

```sh
npm test
npm run build
```

The build script copies the speech detector and its license from the pinned
dependency. There is no runtime CDN download for that detector.

## Deploy

Import this repository into Vercel as a Next.js project, keep the root directory
at the repository root, and configure server environment variables there.
The live app was originally deployed directly from a local folder; publishing
this repository does not expose its private settings.

Keep provider keys out of `NEXT_PUBLIC_*` variables. Never commit `.env.local`,
Vercel metadata, database exports, recordings or device pairing tokens.

## Project layout

| Directory | Purpose |
| --- | --- |
| `app/` | Interface, live laptop view and Next.js API route |
| `lib/` | Account checks, AI routing, audio, tools and companion protocols |
| `public/` | Brand assets and the small speech detector distribution |
| `scripts/` | Build-time audio asset preparation |
| `tests/` | Account isolation, tool validation, audio and stream checks |

## Practical limits

Hosted AI and speech services have their own costs and quotas. This project does
not provide unlimited hosted inference. Browser permissions and audio routing
vary by device; physical iPhone behavior still needs device testing.

Free live video uses STUN. Restrictive networks may need an authenticated TURN
relay. Laptop commands need the separate Windows companion; the public website
cannot control another user's laptop. Stopping cannot undo a completed action.

Reminder delivery depends on the app, companion tick or notification service.
Gmail sending and remote incoming iPhone calls are not configured by this repo.
See [architecture and privacy](docs/ARCHITECTURE.md).

## Publication history

The first commits import the existing project in logical groups: configuration,
application code, regression tests and documentation. They are current
publication commits, not a backdated reconstruction of development.

## Keeping watch

Explicit requests such as “Notify me when a job email arrives” create persistent, account-scoped Gmail watches. The Keeping watch panel shows criteria, last check, failures and new matching messages, with pause/resume/remove and read controls. Gmail remains read-only. Matching mail is never treated as instructions.

Open web/iOS client syncs and the desktop companion drive checks, leased at 30-second intervals to prevent duplicate work. A daily Vercel cron is catch-up only; this is **not** an always-on instant Gmail push service. Gmail Pub/Sub is not configured. No AI request is made during routine polling; a custom criterion can use the model once during setup.

Alerts are saved once per Gmail message and account. Web push uses generic notices when that device has subscribed. Slack delivery requires explicit consent in that individual watch request; reminder consent does not authorize forwarding email alerts. The desktop update adds a generic spoken notice when idle, without interrupting an active turn.

Native iOS chat uses the same watch backend; its existing state sync triggers checks while open. Lock-screen delivery to a closed native app still needs the separate Apple push setup. The web Keeping watch panel is the complete management interface for this release.
