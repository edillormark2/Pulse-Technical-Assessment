"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot, PublicSelf } from "@/lib/types";
import { distanceKm, nightRing } from "@/lib/sun";
import { useViewport } from "@/lib/use-world-clock";

// Public (pk.*) token, inlined at build time. Deliberately no fallback: a
// missing token must surface the setup hint below, not a silently blank map.
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * One mark per state, identical on the globe, the dial and the panel. Your own
 * call reads hollow red (asking), half red (connecting), full red (talking);
 * someone asking you is red and pulsing; someone who just left fades out.
 */
export type MarkState =
  | "free"
  | "busy"
  | "selected"
  | "calling"
  | "connecting"
  | "talking"
  | "ringing"
  | "gone";

/** Where the globe sits on screen: the dial is drawn around it. */
export interface GlobeView {
  x: number;
  y: number;
  radius: number;
}

// The globe in the dial's own lacquer. Space is the page's ground, so the
// globe sits on the same night as everything else; ocean is a step above it.
const INK = {
  space: "#0f1b33",
  ocean: "#14274a",
  land: "#2b4268",
  border: "#3a5383",
  road: "#22375f",
  label: "#a3aec2", // country names: 4.5:1 on the land (AA)
  city: "#a3aec2",
  night: "#040a17",
};
/** Sun altitudes for the night's edge: sunset down through nautical twilight. */
const NIGHT_BANDS = [0, -3, -6, -9, -12, -15];
const NIGHT_OPACITY = 0.12;
/** While you talk, the world steps back this far towards the ground. */
const RECEDE = 0.45;
const RECEDE_MS = 700;
const PRIVACY_KM = 3;
const EARTH_KM = 6371;
/** Turn the globe to someone only when they are past its visible face. */
const FACE_DEG = 80;

/** Mix two #rrggbb colours: t = 0 gives `a`, t = 1 gives `b`. */
function mix(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

type ColorProp = "background-color" | "fill-color" | "line-color";

/** Layers that carry the world's colour, collected while painting, so the
 *  globe can recede during a call and come back after. */
interface WorldLayers {
  paint: { id: string; prop: ColorProp; color: string }[];
}

/**
 * Mapbox zoom at which the globe's scale at the centre is `px` per radian.
 * Mapbox sizes its globe to match Mercator at 45° latitude, hence the √2.
 */
function zoomForScale(px: number): number {
  return Math.log2((px * 2 * Math.PI) / (512 * Math.SQRT2));
}

/** Pixels per radian where the globe faces you. */
function measureScale(map: MapboxMap): number {
  const c = map.getCenter();
  const a = map.project(c);
  const step = c.lat > 80 ? -1 : 1;
  const b = map.project([c.lng, c.lat + step]);
  return Math.hypot(b.x - a.x, b.y - a.y) / (Math.PI / 180);
}

/**
 * Radius of the globe's visible disc. The camera has perspective, so the edge
 * sits well inside the scale at the centre (about 20% on a desktop): walk a
 * meridian away from the centre and keep the farthest point on screen.
 */
function measureEdge(map: MapboxMap): number {
  const c = map.getCenter();
  const o = map.project(c);
  const dir = c.lat > 0 ? -1 : 1;
  let edge = 0;
  for (let deg = 45; deg <= 90; deg++) {
    const p = map.project([c.lng, c.lat + dir * deg]);
    edge = Math.max(edge, Math.hypot(p.x - o.x, p.y - o.y));
  }
  return edge;
}

/** The zoom at which the globe's visible edge has this radius on screen. */
function fitZoom(map: MapboxMap, radius: number): number {
  const zoom = map.getZoom();
  map.setMinZoom(-2);
  let fit = zoomForScale(radius);
  for (let i = 0; i < 4; i++) {
    map.jumpTo({ zoom: fit });
    const edge = measureEdge(map);
    if (!(edge > 0)) break;
    fit += Math.log2(radius / edge);
  }
  map.jumpTo({ zoom });
  return Math.max(-2, fit);
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Restyle Mapbox's dark style into the World Time palette. */
function paintWorldTime(map: MapboxMap): WorldLayers {
  const world: WorldLayers = { paint: [] };
  const tint = (id: string, prop: ColorProp, color: string) => {
    map.setPaintProperty(id, prop, color);
    map.setPaintProperty(id, `${prop}-transition` as `${ColorProp}-transition`, { duration: RECEDE_MS, delay: 0 });
    world.paint.push({ id, prop, color });
  };
  for (const layer of map.getStyle()?.layers ?? []) {
    const { id, type } = layer;
    const hide = () => map.setLayoutProperty(id, "visibility", "none");
    if (type === "background") {
      tint(id, "background-color", INK.land);
    } else if (type === "fill") {
      if (/water/.test(id)) tint(id, "fill-color", INK.ocean);
      else if (/building/.test(id)) map.setPaintProperty(id, "fill-color", INK.road);
      else hide(); // landcover, parks, land use, hillshade: noise at this scale
    } else if (type === "line") {
      if (id === "admin-0-boundary") {
        tint(id, "line-color", INK.border);
        map.setPaintProperty(id, "line-opacity", 0.7);
      } else if (/water/.test(id)) tint(id, "line-color", INK.ocean);
      else if (/road|bridge|tunnel/.test(id)) map.setPaintProperty(id, "line-color", INK.road);
      else hide();
    } else if (type === "symbol") {
      if (id === "country-label") {
        // Quiet at the dial; names arrive once you zoom in to explore.
        map.setLayerZoomRange(id, 2.6, 24);
        map.setPaintProperty(id, "text-color", INK.label);
        map.setPaintProperty(id, "text-halo-width", 0);
      } else if (id === "settlement-major-label") {
        map.setPaintProperty(id, "text-color", INK.city);
        map.setPaintProperty(id, "text-halo-width", 0);
        // Names sit beside their city, never under your own mark and its halo.
        map.setLayoutProperty(id, "text-variable-anchor", ["top", "bottom", "left", "right"]);
        map.setLayoutProperty(id, "text-radial-offset", 2);
      } else hide(); // continents, POIs, roads, water names: tiny tracked caps
    } else if (type === "fill-extrusion" || type === "hillshade") {
      hide();
    }
  }
  // No glow: the atmosphere is the ground itself, so the limb stays crisp.
  map.setFog({
    range: [0.8, 8],
    color: INK.space,
    "high-color": INK.space,
    "horizon-blend": 0.02,
    "space-color": INK.space,
    "star-intensity": 0,
  });
  return world;
}

function nightData(now: Date): GeoJSON.FeatureCollection {
  // Bands from sunset down through nautical twilight stack into a soft edge.
  return {
    type: "FeatureCollection",
    features: NIGHT_BANDS.map((altitude) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [nightRing(now, altitude)] },
    })),
  };
}

function createDot(): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "globe-dot";
  // The dial's marks are the keyboard and screen-reader path to each person;
  // these are pointer duplicates on the canvas.
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  const core = document.createElement("span");
  core.className = "mark mark--on-map";
  el.appendChild(core);
  return el;
}

function createMe(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "globe-me";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "You, shown 1 to 3 km from where you really are");
  el.innerHTML = '<span class="globe-me__halo"></span><span class="globe-me__core"></span>';
  return el;
}

export default function Globe({
  peers,
  me,
  marks,
  recede,
  focus,
  rest,
  dialRadius,
  padding,
  onSelect,
  onView,
}: {
  peers: PeerDot[];
  me: PublicSelf | null;
  /** States other than the default free/busy (selection, the live call, departures). */
  marks: Record<string, MarkState>;
  /** While you talk the world steps back; the ring and the marks stay lit. */
  recede: boolean;
  /** Turn the globe to this point (a person picked on the dial). */
  focus: { lat: number; lng: number; key: string } | null;
  /** Bump to zoom back out to the dial. */
  rest: number;
  /** Radius in px of the globe's visible disc at rest, inside the dial. */
  dialRadius: number;
  padding: { top: number; right: number; bottom: number; left: number };
  onSelect: (id: string | null) => void;
  onView: (view: GlobeView) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  /** Zoom that fits the dial; also the floor, so the globe never shrinks inside it. */
  const fitRef = useRef<number | null>(null);
  /** The world's coloured layers, for receding during a call. */
  const worldRef = useRef<WorldLayers | null>(null);
  const [ready, setReady] = useState(false);
  const [tokenRejected, setTokenRejected] = useState(false);

  // Values the long-lived map callbacks read without re-binding.
  const latest = useRef({ onSelect, onView, me, dialRadius, padding });
  useEffect(() => {
    latest.current = { onSelect, onView, me, dialRadius, padding };
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    let frame = 0;
    let nightTimer: ReturnType<typeof setInterval> | undefined;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const start = latest.current.me ?? { lat: 20, lng: 0 };
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        center: [start.lng, start.lat],
        zoom: zoomForScale(latest.current.dialRadius),
        minZoom: -2,
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
        attributionControl: false,
        logoPosition: "bottom-right",
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      map.setPadding(latest.current.padding);
      mapRef.current = map;

      // Report where the globe is (and size the privacy halo) once per frame.
      // The disc only changes size with zoom or the canvas, so cache it.
      let disc = { key: "", radius: 0 };
      const report = () => {
        frame = 0;
        const c = map.project(map.getCenter());
        const canvas = map.getCanvas();
        const key = `${map.getZoom()}:${canvas.clientWidth}x${canvas.clientHeight}`;
        if (disc.key !== key) disc = { key, radius: measureEdge(map) };
        latest.current.onView({ x: c.x, y: c.y, radius: disc.radius });
        const haloPx = Math.max(40, ((2 * PRIVACY_KM) / EARTH_KM) * measureScale(map));
        meMarkerRef.current?.getElement().style.setProperty("--halo", `${haloPx}px`);
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(report);
      };

      map.on("style.load", () => {
        // The globe projection is live from here: fit it inside the dial
        // before its first full frame, so it never visibly jumps.
        fitRef.current = fitZoom(map, latest.current.dialRadius);
        map.jumpTo({ zoom: fitRef.current });
        map.setMinZoom(fitRef.current);
        worldRef.current = paintWorldTime(map);
        const firstLabel = map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;
        map.addSource("night", { type: "geojson", data: nightData(new Date()) });
        map.addLayer(
          {
            id: "night",
            type: "fill",
            source: "night",
            paint: {
              "fill-color": INK.night,
              "fill-opacity": NIGHT_OPACITY,
              "fill-opacity-transition": { duration: RECEDE_MS, delay: 0 },
              "fill-antialias": false,
            },
          },
          firstLabel,
        );
        nightTimer = setInterval(() => {
          (map.getSource("night") as GeoJSONSource | undefined)?.setData(nightData(new Date()));
        }, 60_000);
      });
      map.on("load", () => {
        if (cancelled) return;
        setReady(true);
        report();
      });
      map.on("move", schedule);
      map.on("resize", schedule);
      map.on("click", () => latest.current.onSelect(null)); // empty globe: deselect
      // An invalid or revoked token fails every style/tile request with 401.
      map.on("error", (e) => {
        const status = (e.error as { status?: number } | undefined)?.status;
        if (!cancelled && (status === 401 || status === 403)) setTokenRejected(true);
      });
    })();

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      if (nightTimer) clearInterval(nightTimer);
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Keep the globe inside the dial and the panel's space out of its centre as
  // the viewport changes. One camera move for both, so neither cuts the other
  // short. At rest it follows the new fit; zoomed in, it stays where you are.
  const { top, right, bottom, left } = padding;
  const { width, height } = useViewport();
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.resize();
    const zoom = map.getZoom();
    const atRest = fitRef.current === null || zoom <= fitRef.current + 0.02;
    const fit = fitZoom(map, dialRadius);
    fitRef.current = fit;
    map.setMinZoom(fit);
    map.easeTo({
      padding: { top, right, bottom, left },
      zoom: atRest ? fit : Math.max(zoom, fit),
      duration: 240,
    });
  }, [ready, dialRadius, top, right, bottom, left, width, height]);

  // Back to the dial from wherever you wandered.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !rest || fitRef.current === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({ zoom: fitRef.current, duration: reduce ? 0 : 800, easing: easeInOutCubic });
  }, [ready, rest]);

  // You: the privacy-offset spot everyone else sees, with its 1–3 km halo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        meMarkerRef.current = new mapboxgl.Marker({ element: createMe() })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile people with their marks whenever the list or a state changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();
      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = createDot();
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            latest.current.onSelect(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el }).setLngLat([peer.lng, peer.lat]).addTo(map);
          markers.set(peer.id, marker);
        } else {
          // A session that rejoined (e.g. after being reaped) gets a new offset.
          const pos = marker.getLngLat();
          if (pos.lng !== peer.lng || pos.lat !== peer.lat) marker.setLngLat([peer.lng, peer.lat]);
        }
        const state = marks[peer.id] ?? (peer.busy ? "busy" : "free");
        const el = marker.getElement();
        (el.firstElementChild as HTMLElement).dataset.state = state;
        el.style.pointerEvents = state === "gone" ? "none" : "";
      }
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peers, marks, ready]);

  // Scale is billing: while you talk the land, the sea and the night step back
  // towards the ground, leaving the ring, the marks and their hours lit.
  useEffect(() => {
    const map = mapRef.current;
    const world = worldRef.current;
    if (!map || !ready || !world) return;
    for (const { id, prop, color } of world.paint) {
      map.setPaintProperty(id, prop, recede ? mix(color, INK.space, RECEDE) : color);
    }
    map.setPaintProperty("night", "fill-opacity", recede ? NIGHT_OPACITY * (1 - RECEDE) : NIGHT_OPACITY);
  }, [ready, recede]);

  // Turn the world to a person picked on the dial.
  const focusKey = focus?.key;
  const focusLat = focus?.lat;
  const focusLng = focus?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || focusLat === undefined || focusLng === undefined) return;
    // Nothing jumps: someone already on the visible face stays where they are.
    const away = (distanceKm(map.getCenter(), { lat: focusLat, lng: focusLng }) / EARTH_KM) * (180 / Math.PI);
    if (away < FACE_DEG) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({ center: [focusLng, focusLat], duration: reduce ? 0 : 900, easing: easeInOutCubic });
  }, [ready, focusKey, focusLat, focusLng]);

  return (
    // `isolate` keeps Mapbox's controls (z-index 2) beneath the panels above.
    <div className="absolute inset-0 isolate bg-lacquer-900">
      {/* The fade lives on a wrapper: Mapbox adds its own classes to the
          container, and React must never rewrite that element's className. */}
      <div className={`h-full w-full transition-opacity duration-700 ease-[var(--ease-out)] ${ready ? "opacity-100" : "opacity-0"}`}>
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {(!TOKEN || tokenRejected) && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <p className="max-w-md rounded-[var(--radius-panel)] bg-lacquer-850 p-5 text-sm text-opaline-200">
            {tokenRejected ? "Mapbox rejected the token. Check " : "Set "}
            <code className="text-opaline-50">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>.env</code> to load the globe.
          </p>
        </div>
      )}
    </div>
  );
}
