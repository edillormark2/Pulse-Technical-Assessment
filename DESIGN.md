---
name: Pulse
description: A world-time dial at night, with every stranger awake right now marked at their own hour.
colors:
  signal: "#e5483a"
  signal-strong: "#cf3a2c"
  lacquer-950: "#0a1428"
  lacquer-900: "#0f1b33"
  lacquer-850: "#142344"
  lacquer-800: "#1a2b50"
  lacquer-700: "#22375f"
  opaline-50: "#f3f5f8"
  opaline-200: "#dcdfe4"
  opaline-400: "#a3aec2"
  opaline-500: "#7f8ba3"
  globe-ocean: "#14274a"
  globe-land: "#2b4268"
  globe-border: "#3a5383"
  globe-night: "#040a17"
typography:
  face:
    fontFamily: "Archivo, Geist, ui-sans-serif, sans-serif"
    fontWeight: 650
    lineHeight: 0.86
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 72"
  display:
    fontFamily: "Archivo, Geist, ui-sans-serif, sans-serif"
    fontSize: "72px"
    fontWeight: 650
    lineHeight: 0.86
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 72"
  display-talking:
    fontFamily: "Archivo, Geist, ui-sans-serif, sans-serif"
    fontSize: "80px"
    fontWeight: 650
    lineHeight: 0.86
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 72"
  display-talking-compact:
    fontFamily: "Archivo, Geist, ui-sans-serif, sans-serif"
    fontSize: "56px"
    fontWeight: 650
    lineHeight: 0.86
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 72"
  wordmark:
    fontFamily: "Archivo, Geist, ui-sans-serif, sans-serif"
    fontSize: "44px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 72"
  wordmark-compact:
    fontFamily: "Archivo, Geist, ui-sans-serif, sans-serif"
    fontSize: "34px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 72"
  dial-figure:
    fontFamily: "Archivo, Geist, ui-sans-serif, sans-serif"
    fontSize: "21px"
    fontWeight: 650
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 72"
  dial-figure-compact:
    fontFamily: "Archivo, Geist, ui-sans-serif, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 72"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.2
  headline-compact:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.375
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
rounded:
  tick: "2px"
  bubble-tail: "6px"
  tile: "16px"
  bubble: "18px"
  panel: "28px"
  pill: "999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "28px"
  "8": "32px"
components:
  panel:
    backgroundColor: "{colors.lacquer-850}"
    textColor: "{colors.opaline-50}"
    rounded: "{rounded.panel}"
    padding: "24px"
  panel-strip:
    padding: "12px 24px"
  hour-face:
    backgroundColor: "{colors.lacquer-850}"
    textColor: "{colors.opaline-50}"
    typography: "{typography.face}"
    rounded: "{rounded.pill}"
  button-primary:
    backgroundColor: "{colors.opaline-50}"
    textColor: "{colors.lacquer-900}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "#ffffff"
  button-quiet:
    backgroundColor: "{colors.lacquer-800}"
    textColor: "{colors.opaline-50}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-quiet-hover:
    backgroundColor: "{colors.lacquer-700}"
  button-compact:
    padding: "0 16px"
    height: "40px"
  icon-button:
    textColor: "{colors.opaline-200}"
    rounded: "{rounded.pill}"
    size: "40px"
  icon-button-hover:
    backgroundColor: "{colors.lacquer-800}"
    textColor: "{colors.opaline-50}"
  icon-button-end:
    textColor: "{colors.signal}"
  round-control:
    backgroundColor: "rgb(26 43 80 / 0.92)"
    textColor: "{colors.opaline-50}"
    rounded: "{rounded.pill}"
    size: "56px"
  round-control-hover:
    backgroundColor: "{colors.lacquer-700}"
  round-control-off:
    backgroundColor: "{colors.opaline-50}"
    textColor: "{colors.lacquer-900}"
  round-control-end:
    backgroundColor: "{colors.signal-strong}"
    textColor: "#ffffff"
  round-control-end-hover:
    backgroundColor: "#b9301f"
  input-message:
    backgroundColor: "{colors.lacquer-800}"
    textColor: "{colors.opaline-50}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "48px"
  button-send-resting:
    backgroundColor: "{colors.lacquer-800}"
    textColor: "{colors.opaline-400}"
    rounded: "{rounded.pill}"
    size: "48px"
  bubble-mine:
    backgroundColor: "{colors.opaline-50}"
    textColor: "{colors.lacquer-900}"
    rounded: "{rounded.bubble}"
    padding: "10px 14px"
  bubble-theirs:
    backgroundColor: "{colors.lacquer-800}"
    textColor: "{colors.opaline-50}"
    rounded: "{rounded.bubble}"
    padding: "10px 14px"
  mark:
    backgroundColor: "{colors.opaline-50}"
    rounded: "{rounded.pill}"
    size: "9px"
  mark-on-map:
    size: "10px"
  mark-talking:
    backgroundColor: "{colors.signal}"
  stage-tick-done:
    backgroundColor: "{colors.opaline-50}"
    rounded: "{rounded.tick}"
    width: "3px"
    height: "14px"
  stage-tick-current:
    backgroundColor: "{colors.signal}"
  stage-tick-pending:
    backgroundColor: "{colors.lacquer-700}"
  dial-band-day:
    backgroundColor: "{colors.opaline-200}"
    textColor: "{colors.lacquer-700}"
    typography: "{typography.dial-figure}"
    height: "36px"
  dial-band-night:
    backgroundColor: "{colors.lacquer-700}"
    textColor: "{colors.opaline-200}"
    typography: "{typography.dial-figure}"
    height: "36px"
  toast:
    backgroundColor: "{colors.lacquer-800}"
    textColor: "{colors.opaline-50}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
---

# Design System: Pulse

## Overview

**Creative North Star: "The World-Time Dial at Night"**

Pulse is read like a watch face. The globe sits inside an engraved 24-hour bezel with your hour fixed at 12 o'clock, and every stranger online is a mark on the track outside it at their own hour, so who is in daylight and who is awake in the dark reads at a glance. The materials are a lacquered dial's: night-lacquer blue owns the ground, enamel blues carry the night band and the land, opaline silver carries the day band, the ink and the calm controls, and one signal red is lit only by a live connection.

The density is an instrument's, not an app's: one dial, one panel, one primary action at a time, and little on screen that is not the time, a person, or the way to reach them. Type carries the warmth. A condensed Archivo bills every hour like a station clock, and Geist speaks plainly beside it in short sentence-case lines. Motion is state change on a strong ease-out curve, with one authored moment (the call arc) and one measured reveal on arrival; nothing jumps, and every wait develops in stages you can see.

Confirmed rejections: the category default (a dark map of glowing dots beside a glass chat sidebar); anything that reads as surveillance (tactical maps, crosshairs, people as targets); neon gamer or crypto styling; corporate SaaS. The world's own risk is going cold: if the enamels drift to grey it becomes a luxury watch or a newsroom clock wall, so the blue stays blue and the warmth lives in the type and the red.

**Key Characteristics:**
- A real globe inside an engraved 24-hour day/night bezel, your hour fixed at 12 o'clock.
- One ground, lacquer-900, from the page to the globe's space; no glow anywhere.
- One lit pane: signal red only for the live connection.
- Condensed, tabular Archivo for the wordmark and every hour; Geist for everything said.
- One mark per state, identical on the dial, the globe, the panels and the legend.
- Raised lacquer panels that grow from the side facing the dial; never glass.
- Waits shown as a sweep hand and named stages; never a spinner.

## Colors

A night-lacquer palette: five steps of deep blue enamel for ground and surfaces, four opaline silvers for ink, a globe painted in the same blues, and one signal red that only a live connection lights.

### Primary
- **Signal Red** (#e5483a): the live connection and nothing else. Your call's marks (hollow while asking, half while connecting, full while talking), the asking-you mark and its tick (reduced to a dot on the tab's icon while it waits), the sweep hand and its countdown, the call arc, the stage developing now, the stranger's hour while you talk, and the icon that ends the conversation. It holds 4.3:1 on the ground and 3.9:1 on a panel, so it is a colour for marks, strokes and numerals of 28px and up, never body text.
- **Signal Strong** (#cf3a2c): the filled form of the same red, behind a white icon (4.9:1), for the one filled control that ends something: the end-video control. Its hover deepens to #b9301f.

### Neutral
- **Deep Lacquer** (#0a1428): the ground of the brand assets only (favicon and its ringing variant, home-screen icon, share image); never used in the page itself.
- **Night Lacquer** (#0f1b33): the ground. The page, the globe's space, its fog and horizon, the browser's theme colour; also the primary button's ink and the keyline that cuts a mark out of the land.
- **Panel Lacquer** (#142344): panels and the hour face's disc.
- **Raised Lacquer** (#1a2b50): what is raised inside a panel or over the map: quiet buttons, their messages, the message field, toasts, icon-button hover, the round video controls (at 92%).
- **Night Enamel** (#22375f): the bezel's night band and the engraving on its day band; the ticks of stages still to come, scrollbar thumbs, quiet-button hover, roads on the map.
- **Opaline** (#f3f5f8): primary ink; the primary button; your messages; the free mark; your index at 12 o'clock; the caret and the focus ring.
- **Day Opaline** (#dcdfe4): the bezel's day band and the engraving on its night band; secondary ink (the status line, the gap between you); icon buttons at rest; the busy mark's ring; text selection.
- **Muted Opaline** (#a3aec2): muted ink, AA on every surface it sits on (5.3:1 on the night band, 4.5:1 on the globe's land): day words, fine print, the legend, placeholders, country and city names on the globe.
- **Faint Opaline** (#7f8ba3): faint ink, AA only on the ground (5.0:1) and on panels (4.5:1): the words of stages still to come, the idle note's fine print, the just-left mark.
- **Globe Sea** (#14274a): the ocean, one step above the ground, so the land reads without outlines.
- **Globe Land** (#2b4268): the land, painted as the map's base.
- **Globe Border** (#3a5383): country borders, at 70% opacity.
- **Terminator Shade** (#040a17): the globe's night side: six bands from sunset to -15° sun altitude, each at 12%, stacked into a soft terminator and redrawn every minute.

### Named Rules
**The One Lit Pane Rule.** Signal red is lit only by a live connection: your call, someone asking you, the line opening, the talk, and the controls that end it. Errors, warnings, counts and emphasis stay lacquer and opaline, and so do the wordmark and the icon at rest; red reaches the brand only to show a connection (the share image's call, the tab's icon while someone is asking). Outside a live connection, the only red in the app is the legend's key to it.

**The One Ground Rule.** Lacquer-900 is the ground everywhere in the app: the page, the globe's space, its fog and horizon, the browser's theme colour. The atmosphere is the ground itself, so the globe's limb stays crisp: no glow, no star field, no halo.

## Typography

**Display Font:** Archivo, condensed to 72% width at weight 650 with tabular figures (falls back to Geist, then ui-sans-serif)
**Body Font:** Geist (with ui-sans-serif, system-ui)

**Character:** A station clock and a plain voice. Condensed Archivo bills the hours and the wordmark with a departure board's authority, in tabular figures so no digit ever jitters; Geist says everything else in short sentence-case lines, never uppercase and never tracked.

### Hierarchy
- **Face** (Archivo 650, 0.42 × the globe's radius, line-height 0.86): your hour filling the dial's face when you arrive, until the globe develops over it. It runs about 137px at 1440×900, 99px at 1280×720 and 55px on a 390px phone. It is the instrument's face, not a heading, and the only type that grows past 96px.
- **Display** (Archivo 650, 72px, 0.86): the stranger's hour in the picked, asking, connecting and incoming panels, with their day word under it in 14px muted opaline.
- **Display, talking** (Archivo 650, 80px; 56px below 768px; 0.86; signal red): the stranger's hour while you talk.
- **Wordmark** (Archivo 650, 44px; 34px below 640px; 1): "Pulse", top left.
- **Secondary numerals** (Archivo 650): your own hour beside theirs at 32px in day opaline; their hour on the video stage at 28px in signal red.
- **Dial figures** (Archivo 650, 21px; 18px on phones): engraved every third hour.
- **Headline** (Geist 400, 28px; 22px below 768px; 1.2): the entry line, the one sentence that invites you in.
- **Title** (Geist 400, 20px; 19px on phones; 1.375): the idle note's lead. "Conversation ended" sits at 17px.
- **Body** (Geist 400, 15px, 1.625): explanations, the status line, stage names, a panel's state line, and messages (1.4 in bubbles); 14px for day words and secondary copy. Panel copy runs 320 to 360px wide, never a full measure.
- **Label** (Geist 400, 13px, 1.5): fine print, the legend, the header's second line, stage details; 12px on the video stage; 11px medium for the dial's "+n".
- **Button** (Geist 600, 16px; 14px in 40px buttons).

### Named Rules
**The Billing Rule.** The stranger's hour is the largest type on screen. A panel bills it at 72px against a 44px wordmark; while you talk it grows to 80px (56px on phones) in signal red and the map recedes 45% toward the ground, leaving the ring, the marks and their hours lit. Your own hour, when shown beside theirs, steps down to 32px in day opaline.

**The Dial's Voice Rule.** Condensed Archivo is for the wordmark and for hours, nothing else; every other word is Geist in sentence case. Every hour and every count is set in tabular figures.

## Layout

The dial is the layout. Everything else takes a reserved place around it, and that place exists before anything fills it.

- **Desktop (768px and up):** a panel column of clamp(360px, 30vw, 440px) is held on the right at all times, with 24px gutters and its panel centred vertically. The dial is centred in the remaining width: its outer radius is min(width − column, height − 64) / 2 − 12, and the globe takes that radius less the dial's 81px (a 14px gap, the 36px band, 17px out to the people's track with the call arc 5px from the band, a 14px margin), never less than 120px.
- **Phones (below 768px):** the header's three lines take the top 108px, a bottom sheet holds 38% of the height, and the dial spans the width between them (9px gap, 26px band, 13px out to the track with the arc 4px from the band, 11px margin; globe at least 90px). Panels rise as a sheet with 12px side gutters and at least 12px (or the safe area) below. Marks the sheet would cover fade aside.
- **Fixed chrome:** the header sits top left at 32px (20px, or the safe area if larger, below 640px). The legend holds the bottom-left corner at 28px when the dial leaves it free; otherwise it moves into the idle note. Zoomed in, "Back to the dial" takes that corner (under the Mapbox row on phones).
- **Chat height:** min(640px, 100dvh − 48px) on desktop, min(560px, 62dvh) on phones; the goodbye keeps the same height.
- **Rhythm (4px base):** 8px from an hour to its words; 12px from a heading to the billed hour and from an action to its fine print; 20px from the hour to the gap line; 24px to the action and inside panels; 28px around a wait's stages; 32px between the idle note's parts.
- **Hover** exists only for a fine pointer (`(hover: hover) and (pointer: fine)`); touch gets press states.

### Named Rules
**The Nothing Jumps Rule.** The world never re-lays out. The entry ring is drawn exactly where the live dial will be; the panel's place is reserved before a panel opens; a picked mark lifts in place (×1.6); the globe turns only to someone past its visible face (more than 80° away); the chat and its goodbye share one height; marks a sheet would cover fade aside instead of being sliced; hours and counts are tabular. Arrival and visibility changes are opacity only.

## Elevation & Depth

A hybrid of tonal lacquer and one soft shadow. The ground is flat and the globe sits on it without atmosphere. Panels are the one raised layer: a lighter lacquer (850) carrying the float shadow. Inside a panel, raised things step up one more lacquer (800) with no shadow of their own. The few things that float over the map (the "Back to the dial" control, toasts, the video self-view) take the same float shadow. Marks on the globe are not lifted at all: a keyline in the ground's colour cuts them out of the land.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 24px 48px -16px rgb(5 10 22 / 0.7), 0 8px 16px -8px rgb(5 10 22 / 0.5)`): panels, toasts, "Back to the dial", the video self-view.
- **Ground keyline** (`box-shadow: 0 0 0 2px #0f1b33`; 3px around your own mark): not depth but a cut in the ground's colour, so a mark reads against the land. The dial's index at 12 o'clock carries the same cut as a 6px stroke under its 2.5px line.

### Named Rules
**The Raised Lacquer Rule.** Panels sit over the globe as raised lacquer, never glass: opaque lacquer-850, the float shadow, no border, no backdrop blur. Translucency appears only where an overlay must sit on live video, carry the map's attribution, or keep the header legible over a zoomed map (lacquer at 72 to 92%), and never with blur.

**The Panel Entry Rule.** Panels grow out of the edge nearest the dial: the left edge on desktop, the top edge on phones. They start at 96% scale and transparent, fading over 240ms and scaling over 280ms on the ease-out curve. Nothing slides in from off-screen. The direction asked for panels to grow "from where you tapped"; the build grows them from the edge facing the dial, and that is the rule.

## Shapes

Round and concentric. The dial is circles within circles: the globe's disc, the gap, the band, the arc lane, the track. Everything a finger touches is a pill or a circle (999px): buttons, the message field, icon buttons, video controls, marks, toasts. Panels are deeply rounded (28px). Messages are 18px with a 6px tail corner on the speaker's side. Overlays on the video stage (their hour, your self-view) are 16px tiles. Ticks and hands are the only straight marks: the bezel's 1.5px round-capped ticks, the index and the sweep hand, and the waits' 3×14px bars with 2px corners. Borders appear only as 1px night-enamel hairlines that set a strip apart inside a panel; every other edge is a step in tone. The app icon is the dial reduced to its disc, band, day arc and index on a 64px square with 14px corners.

## Components

### Buttons
Calm, round, and one per decision.
- **Shape:** pill (999px), 48px tall, 24px side padding, Geist 16px at 600, 8px between icon and label. A 40px, 14px variant serves secondary placements.
- **Primary:** opaline with night-lacquer text; the one action in a panel ("Ask to talk", "Talk", "Show me who's awake", "Turn on"). Hover (fine pointer) brightens to white.
- **Quiet:** raised lacquer with opaline text, for the easy no and the way back ("Not now", "Cancel", "Hang up", "Back to the dial", "Back to video"). Hover steps to night enamel.
- **Press and states:** a press scales to 0.97 over 140ms ease-out; disabled drops to 45% opacity. A busy button says what is happening ("Finding you…", "Joining…") and sets aria-busy; it never spins.
- **Icon buttons:** 40px circles holding 22px icons in day opaline; hover fills raised lacquer and brightens the icon; a press scales to 0.94. The end-conversation icon is signal red, with a 14% signal wash on hover.
- **Round video controls:** 56px circles, raised lacquer at 92% over the video. A control that is off inverts to opaline with a night-lacquer icon; the end-video control is signal strong with a white icon.

### Icons
- Phosphor, regular weight throughout, 18 to 22px, drawn in the ink of their control. A warning is a drawn icon in opaline beside opaline text, never a red one. Icons and marks are always drawn, never typed glyphs.

### Cards / Containers
- **Corner Style:** 28px.
- **Background:** panel lacquer (#142344).
- **Shadow Strategy:** float (see Elevation & Depth).
- **Border:** none on the panel itself.
- **Internal Padding:** 24px; the chat sets its own (20px above a 24px-inset header, 16px either side of the messages, 12px around the composer).
- **One at a time:** the state of the conversation chooses the panel: the stranger you picked, asking or connecting, someone asking you, the chat, the goodbye.
- **Anatomy:** a state line (the state's mark, then the state in 15px words, as the panel's heading); the billed hour with its day word; the gap between you in 15px tabular day opaline ("9 hours ahead · about 11,200 km"); one primary action; at most one line of 13px fine print. In the chat, where the hour is billed in red, the mark moves under it beside their day word.
- **Strips:** a prompt that belongs to the conversation (asking to turn on video, being asked) is a full-width strip of the panel between 1px night-enamel hairlines: no fill, no radius, 24px side padding, 12px above and below, 14px copy, then a pair of 40px buttons (quiet, primary) or a 14px medium underlined text action. A prompt inside a panel is never a card of its own.
- **Not panels:** the entry copy and the idle note sit directly on the ground, 320 to 360px wide.

### Inputs / Fields
- **Style:** the message field is a 48px pill in raised lacquer with opaline text at 16px (smaller makes iOS zoom), a muted-opaline placeholder ("Say something"), 20px side padding.
- **Focus:** a 2px opaline ring. Everywhere else, focus is a 2px opaline outline 3px out (1px out on the dial's marks).
- **Send:** a 48px circle beside the field: primary when there is something to send, resting in raised lacquer with a muted-opaline icon when there is not. It never fades out.

### Header
- The only chrome: the wordmark, then "21:42 here · 16 people awake" (15px tabular day opaline; the count fades in once the first presence check lands), then "8 of them in the dark" (13px muted opaline). There is no navigation. Zoomed in, a 176px scrim of the ground at 92% falling to clear keeps it legible. Mapbox's required attribution is set in muted opaline on the ground at 72%, and on phones it moves to the header's third line, at the right.

### Browser Tab
- At rest the tab shows the app icon and "Pulse · strangers awake right now". While someone is asking, the title becomes "Someone wants to talk · Pulse" and the icon gains the asking-you mark, reduced to a signal-red dot at its top right and cut out with a 4-unit deep-lacquer keyline (the tick has no room at tab size). Both return to rest the moment the ask ends.

### State Marks (signature)
A 9px dot whose form carries the state:
- **Free:** filled opaline.
- **Busy:** hollow, a 2px day-opaline ring.
- **Picked:** the same mark grown ×1.6 in place.
- **Your call, asking:** a hollow 2px signal ring, ×1.45.
- **Your call, connecting:** the ring half filled with signal from below, ×1.45.
- **Your call, talking:** filled signal, ×1.45.
- **Asking you:** filled signal at ×1.35, carrying a 2×5px tick above it (the head of the sweep hand counting their 30 seconds), breathing between ×1.15 and ×1.45 over 1.4s each way.
- **Just left:** a 1.5px faint-opaline ring that shrinks to 60% and fades over 1.2s.
- **Where:** on the dial each mark is a 28px button; on the globe it is 10px with the ground keyline inside a 32px target; in the legend the marks hold still. Marks change over 180ms, and a press shrinks them to 0.9.
- **You:** a 12px opaline core with a 3px ground keyline inside a dashed 1.5px halo (opaline at 50%) drawn to your real 1 to 3 km offset, never smaller than 40px.

**The State Grammar Rule.** Free, busy, picked, your call (asking, connecting, talking), asking you, and just left each have exactly one mark, identical on the dial, the globe, the panels and the legend. A new state earns a new mark in this grammar or does not ship; nothing draws a person any other way.

### The Dial (signature)
- **Bezel:** a 36px band (26px on phones), 14px (9px) outside the globe: night enamel all round, with the opaline day laid over 06 to 18 and widened just enough that the 06 and 18 figures sit wholly on the day.
- **Engraving:** a figure every third hour (00, 03 … 21) at the band's centre, and a 1.5px round-capped tick at the rim for each hour between.
- **Your index:** a 2.5px opaline line across the band at 12 o'clock over a 6px ground keyline, with a small pointer in the gap beneath it. The band turns once a day; you stay at the top.
- **People:** on the track outside the band at their own hour (a quarter degree per minute), as buttons ordered clockwise from you, so the dial is also the list. People sharing an hour fan out a mark's width apart; past seven, the rest collapse into "+n".
- **Arc lane:** 5px (4px) outside the band, inside the people's track, run the countdown, the sweep hand's tip and the call arc.
- **Zoomed in:** the dial fades out over 240ms for the map and returns with "Back to the dial".

**The Engraved Bezel Rule.** The ink follows the enamel under it: night-enamel engraving on the opaline day band, day-opaline engraving on the night band, clipped exactly at dawn and dusk (8.8:1 either way). Figures every third hour, ticks between, and nothing printed over the band.

**The Measured Reveal Rule.** Arrival happens once and in opacity only. The bezel fades up over 400ms, the hours light clockwise from yours 25ms apart, your hour develops inside the ring (its disc from 150ms, its numerals from 450ms), and people already online appear in hour order clockwise from you (380ms each, 45ms apart, within the first 2.5s). Anyone who joins later simply fades in.

### Waits (signature)
- **Sweep hand:** while you ask or are asked, a 2px signal hand sweeps the ring once in 30s (linear) while a 2px countdown arc at 55% draws behind it. Under reduced motion both are removed, because a frozen hand would misreport the time left.
- **Call arc:** once they say yes, a 3px signal arc joins your hour to theirs the short way round: dotted while the line opens, drawn solid over 700ms when you talk, retracting into your hour over 600ms on goodbye.
- **Stage ticks:** 3×14px bars beside each named step, drawn like the bezel's ticks so they never read as people: done (opaline), developing now (signal, breathing down to 35% over 1.1s each way), still to come (night enamel, its words in faint opaline). The step developing now names what the line is doing ("Finding a route between your two devices").

**The Waits Develop Rule.** Every wait advances in stages you can watch: the sweep hand on the ring, named steps with ticks in the panel, button words that say what is happening, "Waiting for their camera…" on the video stage. Never a spinner, a skeleton or an indeterminate bar.

### Messages
- **Bubbles:** up to 82% of the panel's width, 10px by 14px padding, 18px corners with a 6px tail on the speaker's side, 15px at 1.4. Yours are opaline with night-lacquer text, on the right; theirs are raised lacquer with opaline text, on the left. A run from one speaker sits 6px apart, 12px between speakers. A new message rises 6px and fades in over 200ms.
- **Goodbye:** the conversation holds where it stood for a beat, then each bubble blurs 6px, rises and fades over 1s, newest first and 35ms apart, under "Conversation ended" and "Nothing was kept.", set at the chat header's height so nothing moves.

### Video Stage
- It covers the dial's side: everything left of the column on desktop, the whole screen on phones. Their hour stays in a 16px tile at the top left (night lacquer at 80%, a 28px signal numeral, a 12px day word): you are still on the dial. Your self-view is a mirrored 4:3 tile (144px; 208px from 640px) with the float shadow, and the 56px round controls sit centred at the foot.

### Toasts
- Pill, raised lacquer, 15px opaline text, the float shadow, 20px from the top: at the right on desktop and centred on phones, where the conversation is.

## Do's and Don'ts

### Do:
- **Do** keep lacquer-900 (#0f1b33) as the only ground inside the app: the page, the globe's space and fog, the theme colour.
- **Do** reserve signal (#e5483a) for the live connection: your call's marks, the sweep hand and countdown, the call arc, the developing stage, the talking hour, and the controls that end the line.
- **Do** set the wordmark and every hour in Archivo at 72% width and weight 650, and every hour and count in tabular figures.
- **Do** draw people only with the state marks (9px; 10px with a 2px ground keyline on the globe), the same on the dial, the globe, the panels and the legend.
- **Do** bill the stranger's hour largest: 72px in a panel, 80px (56px on phones) in signal while you talk, with the map receded 45% toward the ground.
- **Do** reserve the panel's place before anything opens: the 360 to 440px column on desktop, the 38% sheet on phones.
- **Do** grow panels from the edge facing the dial (scale 0.96 to 1 over 240 to 280ms, ease-out).
- **Do** show every wait as named stages with stage ticks and the sweep hand.
- **Do** theme the browser's own surfaces from the palette: day-opaline selection, opaline caret and focus ring, thin night-enamel scrollbars, the map's attribution in muted ink.
- **Do** keep hover behind a fine pointer and give every press a scale between 0.9 and 0.97.
- **Do** keep reduced motion to opacity: remove the sweep, show the arc already drawn, make camera moves instant.

### Don't:
- **Don't** use signal red for errors, warnings, counts or emphasis; an error is opaline text beside a drawn warning icon.
- **Don't** set signal red at body size; it holds 3.9:1 on a panel, so it is for marks, strokes and numerals of 28px and up.
- **Don't** add glow, glass or gradient text: no backdrop blur, no atmosphere halo or star field on the globe, no luminous dots.
- **Don't** give another person's mark concentric rings, a reticle or a crosshair: nobody here is a target. A mark is a single dot or a single ring, and the dashed halo is yours alone.
- **Don't** show a spinner, a skeleton or an indeterminate bar.
- **Don't** move the globe or the ring to make room, re-lay out the world on selection, or slide a panel in from off-screen.
- **Don't** put faint opaline (#7f8ba3) on anything lighter than a panel; it falls below 4.5:1 on raised lacquer and on the land.
- **Don't** show more than one panel at a time.
- **Don't** put a card inside a panel; a prompt within a panel is a strip between hairlines.
- **Don't** let the lacquer drift to grey; the blue is what keeps the dial from reading as a cold luxury watch.
