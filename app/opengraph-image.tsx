import { ImageResponse } from "next/og";

export const alt = "Pulse: a world-time dial of strangers awake right now, each at their own hour";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = {
  ground: "#0a1428",
  disc: "#142344",
  night: "#22375f",
  day: "#dcdfe4",
  ink: "#f3f5f8",
  muted: "#a3aec2",
  faint: "#7f8ba3",
  signal: "#e5483a",
};

const TITLE = "Pulse";
const HOUR = "22:00";
const LINES = ["Strangers awake right now,", "each at their own hour."];
const NOTE = "Ask one to talk. Nothing is kept.";

/** A static font instance from Google Fonts, subset to `text` (TTF, which Satori reads). */
async function googleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": "Mozilla/4.0" } }, // an old agent gets TTF, not WOFF2
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null; // fall back to the default face rather than fail the build
  }
}

// The dial as it would look at 22:00, mid-conversation with someone 9 hours ahead.
const C = { x: 330, y: 315 };
const R = { disc: 176, track: 196, r1: 212, r2: 238, arc: 248 };
const MY_HOUR = 22;
const DEG = Math.PI / 180;
const angleOf = (hoursAhead: number) => -90 + hoursAhead * 15;
const hourAngle = (h: number) => angleOf(h - MY_HOUR);
const polar = (r: number, deg: number) => [C.x + r * Math.cos(deg * DEG), C.y + r * Math.sin(deg * DEG)];
function arc(r: number, a0: number, a1: number): string {
  const sweep = (((a1 - a0) % 360) + 360) % 360;
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a0 + sweep);
  return `M${x0} ${y0}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}
const PEOPLE: [hoursAhead: number, state: "free" | "busy" | "talking"][] = [
  [1, "free"], [2.5, "free"], [3, "busy"], [5, "free"], [6, "free"], [8, "free"], [9, "talking"],
  [11, "free"], [-2, "free"], [-3, "free"], [-4.5, "busy"], [-6, "free"], [-7, "free"], [-10, "free"],
];

export default async function OpengraphImage() {
  const [archivo, geist] = await Promise.all([
    googleFont("Archivo:wdth,wght@72,650", TITLE + HOUR),
    googleFont("Geist:wght@400", LINES.join("") + NOTE + "your night"),
  ]);
  const fonts = [
    ...(archivo ? [{ name: "Archivo", data: archivo, weight: 700 as const }] : []),
    ...(geist ? [{ name: "Geist", data: geist, weight: 400 as const }] : []),
  ];
  const band = (R.r1 + R.r2) / 2;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: INK.ground, fontFamily: "Geist" }}>
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <circle cx={C.x} cy={C.y} r={R.disc} fill={INK.disc} />
          <circle cx={C.x} cy={C.y} r={band} fill="none" stroke={INK.night} strokeWidth={R.r2 - R.r1} />
          <path d={arc(band, hourAngle(6), hourAngle(18))} fill="none" stroke={INK.day} strokeWidth={R.r2 - R.r1} />
          {Array.from({ length: 24 }, (_, h) => {
            const [x0, y0] = polar(R.r1 + 3, hourAngle(h));
            const [x1, y1] = polar(h % 6 === 0 ? R.r2 - 3 : R.r1 + 9, hourAngle(h));
            const day = h >= 6 && h < 18;
            return (
              <line key={h} x1={x0} y1={y0} x2={x1} y2={y1} stroke={day ? INK.night : INK.faint} strokeWidth={h % 6 === 0 ? 3 : 2} strokeLinecap="round" />
            );
          })}
          <path d={arc(R.arc, -90, angleOf(9))} fill="none" stroke={INK.signal} strokeWidth={4} strokeLinecap="round" />
          <line x1={C.x} y1={C.y - R.r1 + 2} x2={C.x} y2={C.y - R.r2 - 8} stroke={INK.ink} strokeWidth={5} strokeLinecap="round" />
          {PEOPLE.map(([ahead, state]) => {
            const [x, y] = polar(R.track, angleOf(ahead));
            return state === "busy" ? (
              <circle key={ahead} cx={x} cy={y} r={5.5} fill="none" stroke={INK.day} strokeWidth={2.5} />
            ) : (
              <circle key={ahead} cx={x} cy={y} r={state === "talking" ? 8 : 6} fill={state === "talking" ? INK.signal : INK.ink} />
            );
          })}
        </svg>

        {/* Your hour inside the ring. */}
        <div
          style={{
            position: "absolute",
            left: C.x - R.disc,
            top: C.y - R.disc,
            width: R.disc * 2,
            height: R.disc * 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", fontFamily: "Archivo", fontWeight: 700, fontSize: 104, lineHeight: 1, color: INK.ink }}>
            {HOUR}
          </div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 24, color: INK.muted }}>your night</div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 660,
            top: 0,
            bottom: 0,
            width: 520,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", fontFamily: "Archivo", fontWeight: 700, fontSize: 132, lineHeight: 1, color: INK.ink }}>
            {TITLE}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 28, fontSize: 38, lineHeight: 1.25, color: INK.day }}>
            {LINES.map((line) => (
              <div key={line} style={{ display: "flex" }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 26, lineHeight: 1.3, color: INK.faint }}>{NOTE}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
