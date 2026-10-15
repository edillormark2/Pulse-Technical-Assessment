# Notes

**Live:** https://pulse-technical-assessment-alpha.vercel.app · **Repo:** https://github.com/edillormark2/Pulse-Technical-Assessment

## Phase 1 — Make it run

### How I found the bugs

I ran the README setup exactly as written, read every file, and then reproduced each
suspected bug before changing any code. Each commit message records its before/after
evidence.

- **API scripts against a real Postgres:** busy flags, ghost rows, signal ordering.
- **A throwaway two-peer WebRTC harness:** it delivers signals in poll-sized batches and
  can reorder them, which is how `/api/poll` behaves. It covered ICE, chat, video and
  camera leaks.
- **The real UI driven by a scripted fake peer:** connect timeouts, requesters who vanish.
- **A final two-tab run on the real map:** tap → accept → chat both ways → video start,
  stop and restart → both tapping each other at once → both pressing Video at once →
  leaving mid-call.

### What was broken and how I fixed it

| # | What users saw | Root cause | Fix |
|---|---|---|---|
| 1 | Every API call failed (500) on a fresh setup | Prisma 7 no longer generates the client on `db push` | `postinstall: prisma generate`. The config no longer throws when `DATABASE_URL` is unset, so `npm install` works before `.env` exists |
| 2 | Blank map with no explanation | A hardcoded fake Mapbox token (401) also hid the "set your token" hint | Removed it. The map shows a hint when the token is missing or rejected |
| 3 | **Dots stayed for ages after people left** (the README example) | The heartbeat ran `updateMany({ where: {} })`, refreshing *every* user | Heartbeat only the caller |
| 4 | Peers never connected | Queued ICE candidates were flushed *before* `setRemoteDescription` (all failed), or never flushed because a poll batch was applied concurrently. The harness applied 0 of 4 candidates | Apply signals strictly in order; flush candidates after the remote description |
| 5 | Chat messages never arrived | The sender tagged messages `msg`; the receiver only accepts `chat` | One tag |
| 6 | One conversation per session | `end` never released `busy`; `decline` did (and could mark someone free mid-call) | Release on `end`. A decline changes nothing |
| 7 | Stuck in a dead chat or on "Connecting…" forever | No handling for a closed channel, ICE failure, or a peer who vanished | Every involuntary hang-up sends `end`. 20s connect timeout. Prompts are dropped when the other side leaves |
| 8 | Both users stuck busy after a cancel crossed an accept | The idle client ignored the stray accept | Reply `end` |
| 9 | Starting or stopping video could break the call | Concurrent POSTs reorder SDP (4 of 5 bursts arrived out of order) | Send to each peer one request at a time |
| 10 | Invisible after the tab sat in the background | A reaped row was never recreated; the heartbeat updated nothing | Poll reports `present`; the client re-joins |
| 11 | Camera stayed on after a hang-up | Two concurrent `getUserMedia` calls; a stream granted after hang-up was never stopped | One shared camera request; late streams are stopped |
| 12 | Both tapping each other → both "declined". Both pressing Video → both waiting forever | Each side auto-declined or ignored the other's request | A deterministic tie-break picks one side to accept; crossing video requests accept each other |
| 13 | Frozen call, camera on, for 16–60s after the other person closed their tab | Nobody told the survivor | The leave beacon ends the partner's call. ICE `disconnected` gets a 5s grace period, then hangs up |

### Setup, deploy and decisions

- **Local database.** This machine has no Docker or Postgres. `prisma dev` (PGlite) mixes
  concurrent connections into one session (`portal "" does not exist`), which produced
  false failures. I tested against a real embedded Postgres 18 instead.
- **Deploy.** Vercel with Neon in `iad1`, the same region as the functions; each poll
  makes several sequential queries, so the region matters. `vercel-build` (pinned in
  `vercel.json`) runs `prisma migrate deploy` on production deploys only, because Neon's
  preview roles reportedly can't log in. The Prisma CLI uses the unpooled URL; the app
  uses the pooled one.
- **Left for Phase 3.** The server doesn't know who is paired with whom, so `busy` and the
  call state are whatever clients claim. Any client can send `accept` or `end` as anyone,
  since session ids double as credentials. Connections are STUN only (no TURN), as the
  README notes.
