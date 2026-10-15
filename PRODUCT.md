# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** curious people anywhere in the world, on a phone or a laptop, often in idle or
  late-evening moments, who want a brief, low-stakes human connection with a stranger somewhere
  else, without signing up for anything.
- **First real audience:** the assessment reviewers, who evaluate it on desktop with two browser
  windows (a normal and a private one, each with a mock location) and judge it on craft, taste and
  product feel.

## Product Purpose

Pulse is a living globe of anonymous people. Everyone online is a dot on a world map; tapping a dot
asks that person to connect. Once they accept, the two talk in a text chat and can agree to start a
video call. Chat and video run peer-to-peer; the server only coordinates presence and the handshake,
and nothing is stored. Success is two strangers going from "a dot on a map" to talking within
seconds, and leaving with nothing left behind.

## Positioning

Geography is the interface. You choose who to talk to by where they are on a living map, not by a
profile, a feed or an algorithm. Contact needs consent from both sides, and the product is ephemeral
by architecture (peer-to-peer media, no history), not by policy.

## Operating Context

- Reviewers test with two windows side by side and mock geolocation; real users arrive alone, so an
  empty or near-empty map is a common first view.
- Connections are STUN only (no TURN); a minority of strict networks cannot connect media.
- Coordination is serverless HTTP polling (~1.5 s), so a request, an accept and the WebRTC handshake
  each take noticeable seconds; the interface has to make that waiting feel intentional.
- Location permission is required to enter; the browser shows its own permission prompt.

## Capabilities and Constraints

- No accounts, profiles, names, history or persistence of any kind.
- A dot is placed 1–3 km from the real location, re-randomised each session; raw coordinates are
  never stored.
- One active connection at a time; busy users are shown as busy and cannot be requested.
- Request → accept/decline (or timeout) → text chat → optional video, which the other side must
  also accept; either side can end video (back to chat) or end the connection.
- Closing the tab ends the session and removes the dot.
- Stack: Next.js 16 (App Router) on Vercel, Mapbox GL JS for the globe, Postgres via Prisma for
  coordination only, WebRTC for chat and video.

## Brand Commitments

- Name: **Pulse**. Line: "A living globe of anonymous strangers. Tap a dot, start talking."
- Must not feel like: surveillance or tracking (tactical maps, crosshairs, people as targets), a
  neon gamer or crypto product, or corporate SaaS. (User-stated anti-references.)

## Evidence on Hand

- No photography, logo, illustrations, testimonials or usage numbers exist.
- The real content is the live map and the people on it. User counts, activity claims or
  testimonials must never be invented; any demonstration content must be labelled as such.

## Product Principles

1. **Consent before contact.** Nobody can message anyone until both have said yes; the interface
   makes each "yes" deliberate and each "no" painless.
2. **Ephemeral by design.** Nothing persists, and the interface should feel that way: no history,
   no traces, endings that close cleanly.
3. **Privacy you can see.** Show people what others actually see of them (an approximate, offset
   position) rather than asking them to trust it.
4. **Human, not tactical.** People are people on a planet, never targets on a grid.
5. **A stranger in seconds.** Zero setup; every wait is explained and every state is legible.

## Accessibility & Inclusion

- The full flow (enter, request, accept/decline, chat, video, end) must work by keyboard and screen
  reader, not only by tapping dots on a canvas.
- Respect `prefers-reduced-motion`; meet WCAG AA contrast for all text and controls.
- Works on phones and desktop equally (thumb-reach controls on phones, side-by-side windows on
  desktop).
