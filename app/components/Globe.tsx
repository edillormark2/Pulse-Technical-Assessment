"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot, PublicSelf } from "@/lib/types";
import { nightRing } from "@/lib/sun";
import { greatCirclePath } from "@/lib/geo";

// Public (pk.*) token, inlined at build time. Deliberately no fallback: a
// missing token must surface the setup hint below, not a silently blank map.
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** One mark per state, identical on the globe, the dial and the panel. */
export type MarkState = "free" | "busy" | "selected" | "calling" | "ringing" | "talking";

/** Where the globe sits on screen: the dial is drawn around it. */
export interface GlobeView {
  x: number;
  y: number;
  radius: number;
}

// The globe in the dial's own lacquer. Ocean sits a step above the page's
// ground so the globe reads as an object against space.
const INK = {
  space: "#0a1428",
  ocean: "#14274a",
  land: "#2b4268",
  border: "#3a5383",
  road: "#22375f",
  label: "#7f8ba3",
  city: "#a3aec2",
  night: "#040a17",
  signal: "#e5483a",
};
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const PRIVACY_KM = 3;
const EARTH_KM = 6371;

/** Mapbox zoom at which the globe's radius on screen is `px` (equator scale). */
function zoomForRadius(px: number): number {
  return Math.log2((px * 2 * Math.PI) / 512);
}

/** Pixels per radian at the centre of an orthographic globe = its radius. */
function measureRadius(map: MapboxMap): number {
  const c = map.getCenter();
  const a = map.project(c);
  const step = c.lat > 80 ? -1 : 1;
  const b = map.project([c.lng, c.lat + step]);
  return Math.hypot(b.x - a.x, b.y - a.y) / (Math.PI / 180);
}

/** Restyle Mapbox's dark style into the World Time palette. */
function paintWorldTime(map: MapboxMap) {
  for (const layer of map.getStyle()?.layers ?? []) {
    const { id, type } = layer;
    const hide = () => map.setLayoutProperty(id, "visibility", "none");
    if (type === "background") {
      map.setPaintProperty(id, "background-color", INK.land);
    } else if (type === "fill") {
      if (/water/.test(id)) map.setPaintProperty(id, "fill-color", INK.ocean);
      else if (/building/.test(id)) map.setPaintProperty(id, "fill-color", INK.road);
      else hide(); // landcover, parks, land use, hillshade: noise at this scale
    } else if (type === "line") {
      if (id === "admin-0-boundary") {
        map.setPaintProperty(id, "line-color", INK.border);
        map.setPaintProperty(id, "line-opacity", 0.7);
      } else if (/water/.test(id)) map.setPaintProperty(id, "line-color", INK.ocean);
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
      } else hide(); // continents, POIs, roads, water names: tiny tracked caps
    } else if (type === "fill-extrusion" || type === "hillshade") {
      hide();
    }
  }
  map.setFog({
    range: [0.8, 8],
    color: "#1d2f55",
    "high-color": INK.space,
    "horizon-blend": 0.03,
    "space-color": INK.space,
    "star-intensity": 0,
  });
}

function nightData(now: Date): GeoJSON.FeatureCollection {
  // Three bands (sunset, civil and nautical twilight) stack into a soft edge.
  return {
    type: "FeatureCollection",
    features: [0, -6, -12].map((altitude) => ({
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
  core.className = "globe-dot__core";
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
  live,
  focus,
  dialRadius,
  padding,
  onSelect,
  onView,
}: {
  peers: PeerDot[];
  me: PublicSelf | null;
  /** States other than the default free/busy (selection and the live call). */
  marks: Record<string, MarkState>;
  /** The live call's other end; the arc is dotted until you are talking. */
  live: { lat: number; lng: number; talking: boolean } | null;
  /** Turn the globe to this point (a person picked on the dial). */
  focus: { lat: number; lng: number; key: string } | null;
  /** Globe radius in px that fits the dial at rest. */
  dialRadius: number;
  padding: { top: number; right: number; bottom: number; left: number };
  onSelect: (id: string | null) => void;
  onView: (view: GlobeView) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
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
        zoom: zoomForRadius(latest.current.dialRadius),
        minZoom: 0.4,
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
      const report = () => {
        frame = 0;
        const c = map.project(map.getCenter());
        const radius = measureRadius(map);
        latest.current.onView({ x: c.x, y: c.y, radius });
        const haloPx = Math.max(56, ((2 * PRIVACY_KM) / EARTH_KM) * radius);
        meMarkerRef.current?.getElement().style.setProperty("--halo", `${haloPx}px`);
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(report);
      };

      map.on("style.load", () => {
        paintWorldTime(map);
        const firstLabel = map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;
        map.addSource("night", { type: "geojson", data: nightData(new Date()) });
        map.addLayer(
          {
            id: "night",
            type: "fill",
            source: "night",
            paint: { "fill-color": INK.night, "fill-opacity": 0.2, "fill-antialias": false },
          },
          firstLabel,
        );
        map.addSource("call-arc", { type: "geojson", data: EMPTY });
        map.addLayer({
          id: "call-arc",
          type: "line",
          source: "call-arc",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": INK.signal, "line-width": 2.25, "line-opacity": 0.95 },
        });
        nightTimer = setInterval(() => {
          (map.getSource("night") as GeoJSONSource | undefined)?.setData(nightData(new Date()));
        }, 60_000);
      });
      map.on("load", () => {
        if (cancelled) return;
        // Fit the globe inside the dial: one measured correction makes it exact.
        const target = latest.current.dialRadius;
        const measured = measureRadius(map);
        if (measured > 0) map.jumpTo({ zoom: map.getZoom() + Math.log2(target / measured) });
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

  // Keep the dial's reserved space (panel, sheet) out of the globe's centre.
  const { top, right, bottom, left } = padding;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.easeTo({ padding: { top, right, bottom, left }, duration: 240 });
  }, [ready, top, right, bottom, left]);

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
        marker.getElement().dataset.state = marks[peer.id] ?? (peer.busy ? "busy" : "free");
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

  // The call arc: a great circle between the two of you.
  const liveLat = live?.lat;
  const liveLng = live?.lng;
  const talking = live?.talking ?? false;
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("call-arc") as GeoJSONSource | undefined;
    if (!map || !ready || !source) return;
    if (liveLat === undefined || liveLng === undefined || !me) {
      source.setData(EMPTY);
      return;
    }
    source.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: greatCirclePath(me, { lat: liveLat, lng: liveLng }),
      },
    });
    map.setPaintProperty("call-arc", "line-dasharray", talking ? [1, 0] : [0.6, 1.8]);
  }, [ready, me, liveLat, liveLng, talking]);

  // Turn the world to a person picked on the dial.
  const focusKey = focus?.key;
  const focusLat = focus?.lat;
  const focusLng = focus?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || focusLat === undefined || focusLng === undefined) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({
      center: [focusLng, focusLat],
      duration: reduce ? 0 : 900,
      easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    });
  }, [ready, focusKey, focusLat, focusLng]);

  return (
    <div className="absolute inset-0 bg-lacquer-950">
      <div ref={containerRef} className="h-full w-full" />
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
