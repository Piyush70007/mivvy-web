# Architecture and privacy

The browser renders the interface, captures microphone audio after activation,
performs lightweight speech detection and plays the server's speech response.
The Next.js API authenticates the account and routes requests to the configured
reasoning and speech providers. PostgreSQL stores account-scoped conversations,
personal tools and revocable sessions.

Gmail and Slack are optional. Gmail uses read-only scope; Slack messages go to
the installing user's own DM. Stored OAuth credentials are encrypted with
AES-256-GCM and bound to the user and provider. Browser responses contain
connection status, not provider tokens. An uncertain send is not retried.

## Laptop connection

The separate Windows companion makes authenticated outbound requests. The owner
can enqueue short-lived jobs through `/api/laptop`; another registered account
cannot use this connection. Jobs are cancelled or expire instead of being
silently repeated. The companion reports the actual result to the originating
conversation.

Live video uses receive-only WebRTC negotiation through `/api/stream`. The
companion captures only during an active authenticated owner session and releases
capture when its lease or connection ends. Media are not stored as video
recordings in the account database. Some networks need TURN; those credentials
remain server-side.

Publishing these protocols does not publish a token or grant access to a laptop.
A clone has no configured owner, provider credentials, database, OAuth grants
or paired device.

## Repository boundary

Only source, synthetic tests, public assets and blank configuration examples
belong in Git. Local account data, private recordings, provider keys, Vercel
metadata and device pairing files are ignored. Keep those rules when adding
features. Passing automated tests does not verify every real-device behavior.
