import type { NextConfig } from "next";

// Sent with every response. The Content Security Policy is set per page view
// in proxy.ts, because it carries a fresh nonce.
const securityHeaders = [
  // HTTPS only, for two years, here and on every subdomain.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Never guess a response's type from its contents.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never inside someone else's frame (clickjacking); CSP frame-ancestors says
  // the same to newer browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Other sites see our origin, never the path. Mapbox's token URL
  // restrictions rely on that origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera, microphone and location for this site only; nothing else at all.
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), geolocation=(self), display-capture=(), payment=(), usb=(), serial=(), bluetooth=(), hid=()",
  },
  // A page opened from here cannot reach back into this one.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The demo's files carry a version in their names, so they never change.
      { source: "/demo/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
