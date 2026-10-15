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

## Phase 3 — Make it secure

### How I reviewed it

I read every API route and the client code that drives them, asked what each endpoint
trusts, and ran `npm audit`. Then I attacked the running API with a script and kept
fixing until every attack was refused. That script is committed:
`npm run test:security` runs 39 checks against a local server.

### What I found, ranked, and what I did

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **Critical** | **Anyone could act as anyone.** The session id was the only credential, and `/api/poll` sent every client everyone else's. With someone's id you could drain their mailbox (take their WebRTC offer, answer it, and sit in on their "private" call), send signals as them, end their calls, or remove them from the map. | The server issues a public id plus a 256-bit secret token, and stores only the token's SHA-256. Every call authenticates, and a signal's sender is whoever owns the token, never a field in the body. Poll is now a POST, so tokens never land in URLs or logs. |
| 2 | **Critical** | **Next.js 16.2.7** has a critical advisory (a proxy/middleware bypass with Turbopack), plus DoS issues and vulnerable postcss and sharp. | Upgraded to 16.4.1 and applied `npm audit fix`. |
| 3 | **High** | **Calls were whatever clients claimed.** Anyone could accept, decline or end for anyone, mark people busy or free mid-call, push offers and ICE at anyone, and ask the same person forever. | The server records each call as two rows: one per person, inserted in a single INSERT. One call per person is a database guarantee. You can only ask someone free and online, answer someone who asked you, and exchange SDP/ICE with the person you're connected to. "Not now" adds a one-minute cooldown. |
| 4 | **High** | **No rate limits.** Unlimited joins (fake people), signals (mailbox floods) and polls (about 6 queries each). | Atomic counters in Postgres: 30 joins per 10 minutes per network (a salted IP hash, never the IP); per session, 150 signals per 10 s, 10 asks per minute, and one poll per 100 ms. |
| 5 | Medium | **The exact location went to the server**, and each rejoin re-rolled the 1–3 km offset, so averaging a few rejoins would close in on the real spot. | The offset is applied on the device, once per visit, and rejoins reuse that same spot. The server never sees raw coordinates. |
| 6 | Medium | **No security headers.** No CSP, framing was allowed (clickjacking), and camera, mic and location weren't scoped. | A nonce-based CSP with `strict-dynamic`, plus HSTS, nosniff, frame denial, a referrer policy, a Permissions-Policy and COOP. |
| 7 | Medium | **Unbounded input.** 64 KB payloads were accepted on any signal type, and everything a stranger sent over the data channel was rendered. | Payloads are capped by type (32 KB SDP, 4 KB ICE, nothing otherwise), bodies at 48 KB before parsing, and other origins are refused. On the data channel: 4 KB frames, 1000-character lines, 20 lines per 5 s, and only the known control words. |
| 8 | Low | The session id travelled in a GET query string, that GET changed state, and an ngrok dev host was left in the config. | Poll uses POST with an `Authorization` header, and the dev host is removed. |

The migration clears the live-session tables (presence and undelivered signals). Old
rows carry no token; anyone online simply rejoins.

### Not fixed, and why

- **Peers learn each other's IP address.** WebRTC over STUN exchanges public IPs. The fix
  is a TURN relay (`iceTransportPolicy: "relay"`) with short-lived credentials minted by
  the server, which needs a TURN provider such as Cloudflare or Twilio. It's the first
  thing I would add.
- **Prisma CLI advisories** (mysql2, deepmerge-ts). They're build-time tooling, not in
  the deployed bundle, and the only fix offered is a breaking downgrade. Revisit with
  Prisma 8.
- **The Mapbox token** is public by design (`pk.`), but it should be URL-restricted to
  the Vercel domain in the Mapbox dashboard. That's an account setting.
- **Abuse inside a chat** (insults, spam) needs block, report and moderation. That's
  product work beyond the API.
- **Join limits are per network**, so a botnet with many IPs could still add people
  slowly. Proof-of-work or a CAPTCHA at join would be the next step.

### How I checked it

- `npm run test:security`: 39 attacks against a running server. All are refused, and a
  real call still works.
- `npm test`: 21 unit tests, including tokens, body and origin checks, and IP-key
  hashing.
- The full two-person flow (desktop and phone, headless Chromium) on a production build:
  entry, call, chat, video and goodbye, with zero CSP violations.

## Phase 4 — Make it better: Daybreak

### What I built

Somewhere on Earth the sun is always a few minutes from rising. **Daybreak** marks the
strangers whose sunrise is less than half an hour away, and lets you watch it come up
with them on a call.

- **On the map.** A person at daybreak keeps their usual mark, set on a horizon: a short
  line either side of the dot. It shows on the dial, the globe and the legend, and the
  header counts them ("· 2 at daybreak").
- **Asking.** Their card counts down to their sunrise ("Their sun rises in 4:12", to the
  second in the last ten minutes). The one action becomes **Watch their sunrise**.
- **Being asked.** The other person sees "Someone wants to watch your sunrise" and their
  own countdown. The browser tab says the same.
- **Together.** The call opens a sky strip: the countdown, their horizon, the sun's real
  path over the hour around sunrise (solid where it has been, dotted where it is going)
  and their local sunrise time. The sun touches the line at the second it rises for
  them: the horizon brightens, the sun fills in, and screen readers hear "Their sun is
  up." **Ask to see it** asks to turn on video, so you can watch it through their
  camera. On video, the countdown stays in the corner with their hour. Once a sunrise
  shows in a call, it stays until the call ends.

### Why this

- **Alive.** Pulse already knows who is awake and what time it is for them. Daybreak
  turns that into something happening to a real person right now, on a clock you can
  watch. The globe's night band shows the sunrise line sweeping west; Daybreak is that
  line made personal.
- **A reason to talk.** Strangers struggle with the first sentence. "Can I watch your
  sunrise?" is specific and kind, it ends on its own, and the sun gives both of you
  something to look at besides each other.
- **Safer by being specific.** The ask says what it is for. Each side checks it against
  the real sun on their own device, so a stranger can't fake an excuse to call.

### How it works

- **The sun, computed.** Sunrise is when the sun's upper edge clears the horizon, at
  −0.833° (refraction plus the sun's radius). It uses the same solar model as the night
  band: step a minute at a time, then bisect to the second. There's no API and no new
  data. Daybreak runs from 30 minutes before sunrise to 10 minutes after: enough time to
  ask, connect and settle in, plus the best of the light after.
- **Cheap.** The sun's altitude changes by at most about ¼° a minute. A dot far from the
  horizon therefore skips the search, so a full map costs almost nothing to update.
- **One grammar.** Daybreak is a modifier, not a new state. A busy person or your own
  call can also be at daybreak, and the state marks keep their meaning.
- **The ask carries an intent.** A request may carry exactly `{"intent":"sunrise"}`, byte
  for byte. Anything else is refused with a 400, and the server stores nothing new. The
  person asked only sees the sunrise heading if their own sun is really rising.
  Everything else is unchanged: asking is still a request, and video is still a separate
  yes.
- **Whose sunrise.** A call is about their sunrise if it's near, otherwise yours, so both
  ends watch the same one. Times are shown on the clock of the person whose sun it is.

### How I checked it

- `npm test` (26 unit tests):
  - sunrise matches published times (San Francisco, Manila) within 2 minutes;
  - at the sunrise found, the sun's edge sits on the horizon and is climbing;
  - polar night and the midnight sun have no sunrise;
  - the window edges are right;
  - a sweep of 5,760 instants (the equator to the Arctic, both solstices and an
    equinox) shows the fast path never misses a daybreak.
- `npm run test:security` (42 checks, up from 39): the sunrise ask is delivered exactly,
  and made-up or padded intents are refused.
- End to end against the real sun. I solved for the point in western Ireland where the
  sun would rise two and a half minutes later, and put a phone session ("Bob") there. A
  desktop session in Manila found his dawn mark and asked to watch. They talked, turned
  on video, and watched his sun reach the horizon at 07:04:56 UTC on both screens.
  Every state was captured, with no CSP violations. This run also caught a real bug:
  the chart drew the sun by its centre, so it sat on the horizon two minutes early. It
  now rises by its top edge, as sunrise is defined.

### Next, with more time

- **Follow the sunrise.** Hop west along the sunrise line to a new stranger every few
  minutes, and stay in the morning for an hour.
- **Nightfall**, the same idea at sunset, and a gentle "remind me" for when a person's
  daybreak starts.
- **A relay (TURN)** before video becomes a main feature, so peers stop learning each
  other's IP addresses (see Phase 3).
