# Notes

**Live:** https://pulse-technical-assessment-alpha.vercel.app · **Repo:** https://github.com/edillormark2/Pulse-Technical-Assessment

## Phase 1 — Make it run

**How I found the bugs.** I ran the README setup, read every file, and reproduced each
bug before fixing it, using API scripts on a real Postgres, a WebRTC harness that
reorders signals the way `/api/poll` does, a scripted fake peer, and two tabs on the real
map. Each commit records its before/after evidence.

| # | What users saw | Cause → fix |
|---|---|---|
| 1 | Every API call failed (500) on a fresh setup | Prisma 7 no longer generates the client on `db push` → `postinstall: prisma generate` |
| 2 | A blank map | A fake hardcoded Mapbox token hid the setup hint → removed; the map explains token problems |
| 3 | **Dots stayed for ages after people left** (the README example) | The heartbeat refreshed every row → only the caller's |
| 4 | Peers never connected | ICE candidates flushed before the remote description, or never → signals applied strictly in order |
| 5 | Chat never arrived | Sent as `msg`, received as `chat` → one tag |
| 6 | One conversation per session | `end` never released `busy` → it does; `decline` no longer frees anyone mid-call |
| 7 | Stuck in a dead chat or on "Connecting…" | Closed channels, ICE failures and vanished peers were unhandled → every involuntary hang-up sends `end`; 20 s timeout |
| 8 | Both stuck busy after a cancel crossed an accept | The idle side ignored the accept → it replies `end` |
| 9 | Toggling video broke the call | Concurrent POSTs reordered SDP → one request at a time per peer |
| 10 | Invisible after the tab sat in the background | A reaped row was never recreated → poll reports `present` and the client re-joins |
| 11 | Camera stayed on after hanging up | A late `getUserMedia` stream was never stopped → one shared request |
| 12 | Crossing taps → both "declined"; crossing Video → both waiting | Each side rejected the other → a deterministic tie-break; crossing video requests accept each other |
| 13 | A frozen call for 16–60 s after the other tab closed | Nobody told the survivor → the leave beacon ends the call; a dropped connection hangs up after 5 s |

- **Local database:** PGlite (`prisma dev`) broke under concurrent connections, so I
  tested on an embedded Postgres.
- **Deploy:** Vercel and Neon, both in `iad1` (each poll makes sequential queries).
  Migrations run on production deploys only.

## Phase 2 — Make it good

**The idea: World Time.** Pulse is about who is awake right now, so the interface became
a world-time dial: the globe inside a 24-hour day/night bezel, your hour fixed at 12
o'clock, and everyone marked at their own hour, read at a glance like a watch face. It
avoids the category default (glowing dots beside a glass chat sidebar), anything that
feels like surveillance, and neon or corporate styling. I wrote the product truth first
(`PRODUCT.md`), explored seven directions, and kept a rule from each runner-up.
`DESIGN.md` records the system.

- **Colour:** night-lacquer blues, opaline silver ink, and **red only for the live
  connection**. Text is at least 4.5:1 everywhere.
- **Type:** condensed, tabular Archivo for every hour, so times never jitter; Geist for
  words.
- **One state grammar** on the dial, the globe and every card: filled is free, hollow is
  busy, grown is picked. Your call goes hollow → half → full red (asking, connecting,
  talking). A breathing red mark is someone asking you; a fading ring, someone who just
  left.
- **The rules it keeps:** a measured reveal on arrival; red only for the live call;
  scale is billing (while you talk, their hour is the largest type and the map recedes);
  nothing jumps (entry and live share one layout, and the panel's column is reserved);
  waits develop (a red hand sweeps the 30-second window and named stages follow the real
  WebRTC state, never a spinner).
- **Signature moment:** on yes, a red arc draws along the ring from your hour to theirs.
  On goodbye it retracts while the messages dissolve.

**UX beyond the look**

- **Real day and night:** the true terminator, plus each client's UTC offset, so "their
  morning" matches their clock and both ends of a call name the hour the same way.
- **Phones are first-class:** a full-width dial, bottom-sheet cards, 16 px inputs, safe
  areas.
- **A faster handshake:** polling drops to 400 ms only while a call is set up, so Talk →
  open chat takes about 0.7 s instead of 2 s.
- **Accessible:** the dial's marks are real buttons in clockwise order, labelled with
  time, distance and state, so the dial doubles as the screen-reader list. Reduced motion
  keeps only fades.

**How I checked it.** A script captures every state of a two-person call (desktop in
Manila, phone in San Francisco) on a production build. After a clean Impeccable detector
run, a fresh reviewer audited the captures: **fix** (8 issues, such as "scale is
billing" not honoured while talking), then **ship**, after it caught a ringed mark that
read as crosshairs. The captures also caught a dial hidden on phones and unlayered CSS
overriding utilities.

## Phase 3 — Make it secure

**How I reviewed it.** I read every route and the client code behind it, asked what each
endpoint trusts, and ran `npm audit`. Then I attacked the running API with a script
(`npm run test:security`) until every attack was refused.

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **Critical** | **Anyone could act as anyone.** The session id was the only credential, and `/api/poll` handed out everyone's. With one you could drain someone's mailbox (and join their "private" call), signal as them, or remove them. | A public id plus a 256-bit secret token, stored only as SHA-256. The sender is whoever owns the token. Poll is a POST, so tokens stay out of URLs. |
| 2 | **Critical** | Next.js 16.2.7: a middleware-bypass advisory, DoS issues, vulnerable postcss and sharp. | Next 16.4.1 and `npm audit fix`. |
| 3 | **High** | **Calls were whatever clients claimed:** anyone could accept, end or flip busy for anyone, and ask forever. | Calls live on the server (two rows, one INSERT). You can only ask someone free, answer whoever asked you, and send SDP/ICE to your peer. "Not now" sets a one-minute cooldown. |
| 4 | **High** | **No rate limits.** | Postgres counters: joins per network (a salted IP hash), and signals, asks and polls per session. |
| 5 | Medium | **The exact location reached the server.** | The 1–3 km offset is applied on the device, once per visit. |
| 6 | Medium | **No security headers.** | A nonce CSP with `strict-dynamic`, HSTS, frame denial, a Permissions-Policy and more. |
| 7 | Medium | **Unbounded input**, from 64 KB signals to data-channel text. | Caps by type (32 KB SDP, 4 KB ICE), 48 KB bodies, same origin only, and size and rate limits on the data channel. |
| 8 | Low | The session id travelled in a state-changing GET, and an ngrok host was left in the config. | POST with an `Authorization` header; the host is removed. |

**Not fixed, and why**

- **Peers learn each other's IP** (WebRTC over STUN). The fix is a TURN relay with
  server-minted credentials, which needs a provider. It's the first thing I'd add.
- **Prisma CLI advisories:** build-time only, and the only fix is a breaking downgrade.
- **The Mapbox token** should be URL-restricted in the Mapbox dashboard (an account
  setting).
- **Chat abuse** needs block and report, and **per-network join limits** can be spread
  across a botnet (proof-of-work would be next).

**How I checked it:** 39 attacks, all refused, while a real call still works; unit tests
for the guards; and the full two-person flow on a production build with zero CSP
violations.

## Phase 4 — Make it better: Daybreak

Somewhere on Earth the sun is always a few minutes from rising. **Daybreak** marks the
strangers whose sunrise is under half an hour away, and lets you watch it come up with
them on a call.

- **On the map:** their mark sits on a horizon (a short line either side of the dot), and
  the header counts them.
- **Asking:** their card counts down ("Their sun rises in 4:12") and offers **Watch their
  sunrise**. They see "Someone wants to watch your sunrise" and their own countdown.
- **Together:** a sky strip shows their horizon, the sun's real path and their sunrise
  time. The sun touches the line at the second it rises, and screen readers hear "Their
  sun is up". **Ask to see it** asks to turn on video, and the countdown stays in the
  corner of the video.

**Why**

- **Alive:** it turns "who's awake" into something happening to a real person right now,
  on a clock you can watch: the sunrise line on the globe, made personal.
- **A reason to talk:** "Can I watch your sunrise?" is specific and kind, ends on its
  own, and gives you both something to look at besides each other.
- **Safer:** the ask says what it is for, and each side checks it against the real sun.

**How it works**

- **Computed, not fetched:** sunrise is when the sun's upper edge reaches the horizon
  (−0.833°), found with the night band's solar model, then bisected to the second. There's
  no API and no new data. The window runs from 30 minutes before to 10 after.
- **Cheap:** the sun moves at most about ¼° a minute, so dots far from the horizon skip
  the search.
- **One grammar:** Daybreak modifies any mark rather than adding a state.
- **The ask carries an intent:** exactly `{"intent":"sunrise"}`. Anything else is a 400,
  and the sunrise heading shows only if the asked person's sun really is rising.

**How I checked it**

- **26 unit tests**, including published sunrise times (within 2 minutes), polar night,
  and a 5,760-instant sweep proving the shortcut never misses.
- **42 attack checks** (up from 39): exact delivery, and made-up or padded intents
  refused.
- **End to end against the real sun:** a phone session placed where the sun would rise
  2½ minutes later (western Ireland) and a desktop in Manila watched it together over a
  call and video, with no CSP violations. I repeated it on production from the Canary
  Islands. It caught a real bug: the chart drew the sun by its centre, so it sat on the
  horizon two minutes early.

**Next, with more time:** follow the sunrise west to a new stranger every few minutes;
Nightfall at sunset, with a "remind me"; and a TURN relay before video becomes central.
