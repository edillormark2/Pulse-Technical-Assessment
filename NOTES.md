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

## Phase 2 — Make it good

### The idea: World Time

- Pulse is about *who is awake right now*, so the interface became a **world-time dial**:
  the globe sits inside a 24-hour day/night ring, your hour is always at 12 o'clock, and
  everyone online is marked at *their* hour. Who is in daylight and who is awake in the
  dark reads at a glance, like a watch face.
- It refuses the category default (a dark map with glowing dots beside a glass chat
  sidebar) and the three anti-goals agreed up front: no surveillance feel, nothing neon or
  crypto, nothing corporate.
- Process: product truth first (`PRODUCT.md`), then seven candidate directions. World Time
  won, and each declined direction donated one rule (the six below). The shipped system,
  tokens and rules are recorded in `DESIGN.md`.

### The system

- **Colour:** night-lacquer blues for the ground and the land, opaline silver for ink and
  the day arc, and **signal red only for the live connection** (your call, their mark, the
  arc between you). Text is at least 4.5:1 on every surface it sits on.
- **Type:** condensed Archivo for the wordmark and every hour, in tabular figures so times
  never jitter; Geist for everything else.
- **The bezel:** a day/night band engraved with every third hour (dark ink on the day,
  light on the night), your hour pinned at 12, people marked outside it at theirs.
- **One state grammar** on the dial, the globe and every card: filled = free,
  hollow = busy, grown = picked. Your own call goes hollow red (asking) → half red
  (connecting) → full red (talking); pulsing red = someone asking you; a fading ring =
  someone who just left. A legend keeps its own corner on desktop.

### Six rules the build keeps

1. **Measured reveal:** on arrival the hours light clockwise from yours, then people take
   their places on the ring in hour order.
2. **One lit pane:** red appears only for the live connection.
3. **Scale is billing:** while you talk, their hour is the largest type on screen and
   the map recedes; on the entry screen your own hour fills the ring.
4. **Nothing jumps:** the entry ring is drawn from the same layout as the live dial, so
   entering never moves it (the globe develops inside it). The panel column is reserved,
   cards grow out of the edge nearest the dial, the globe only turns to someone hidden
   on its far side, and the goodbye card keeps the chat's size.
5. **Waits develop:** both sides watch a red hand sweep the 30-second window, and the
   asker sees named stages driven by the real WebRTC state (asked → waiting for their
   yes → opening a direct line), never a spinner.
6. **Complete state grammar:** as above, identical everywhere.

**Signature moment:** the call arc. On yes, a red arc draws along the ring from your
hour to theirs; on goodbye it pulls back into your hour while the messages dissolve
where they stood.

### UX beyond the look

- **Real day and night:** the globe shows the actual terminator, sunset through
  nautical twilight. Each client now shares its UTC offset (validated on the server), so
  "their morning / evening / night" follows the clock they actually see, and the real
  sun adds dawn and dusk. Both ends of a call read the same hour the same way.
- **Before you ask:** their hour, yours, the hours between you and the distance.
- **Phones are first-class:** the dial spans the width and every card is a bottom sheet;
  16 px inputs, safe areas, `dvh`, hover effects only on real pointers.
- **Faster handshake:** polling drops to 400 ms only while a call is being set up.
  Tapping Talk to an open chat now takes about 0.7 s locally, down from about 2 s.
- **Accessibility:** the dial's marks are real buttons in clockwise order, labelled with
  time, distance and state, so the dial is also the keyboard and screen-reader list. The
  world behind a video goes `inert`, toggles report state with `aria-pressed`, and reduced
  motion keeps only fades.
- **Plain words:** "They said not now", "They left.", "Couldn't open a direct line.
  Try again."
- **Details:** a dial favicon and share image, themed selection, scrollbars and focus
  rings, and Mapbox restyled into the palette with its logo kept clear of every panel.

### How I checked it

- A script drives two real sessions (desktop in Manila, phone in San Francisco) through a
  whole conversation in headless Chromium against a production build, and captures every
  state: entry, idle, zoomed, picked, calling, ringing, chat, video, goodbye.
- The Impeccable detector found no anti-patterns. A fresh reviewer with no build context
  then audited the captures against the direction. The first verdict was **fix**, with 8
  material issues, among them:
  - hour marks pairing up with dots at the globe's edge;
  - "scale is billing" not honoured while talking;
  - an incomplete state grammar;
  - a ground darker than the named lacquer;
  - two words for the same hour on either end of a call.

  I fixed them in batches and recaptured each time. The final verdict was **ship**, which
  covers those fixes plus three regressions the fixes introduced. One of those
  regressions was worth catching: a ringed "asking you" mark that read as crosshairs on a
  person.
- Bugs the captures caught before shipping:
  - The dial was hidden on phones. A minimum zoom kept the globe too big, and its size was
    read from Mapbox's centre scale, but its visible disc is up to 20% smaller under
    perspective.
  - Utility classes were silently ignored, because the component CSS was unlayered.
  - React was wiping Mapbox's own class off the map container.
  - The goodbye card briefly rendered empty.

### Left for later

- Ideas the reviewer listed as headroom, not defects: a ring of reference cities around
  the bezel, a red station-clock seconds hand for the 30-second wait, and a stronger
  terminator.
