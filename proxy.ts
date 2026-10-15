import { NextResponse, type NextRequest } from "next/server";

/**
 * A Content Security Policy with a fresh nonce for every page view. Next.js
 * reads the nonce from this request header and puts it on its own scripts;
 * `strict-dynamic` then lets those scripts load the app's chunks, while any
 * injected script, inline or remote, is refused.
 *
 * Mapbox needs its API and tile hosts, and blob: workers. Styles allow
 * 'unsafe-inline' because React renders style attributes and toasts inject a
 * <style>; CSS cannot run code, so that is the lower-risk trade.
 */
function policy(nonce: string, request: NextRequest): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com${dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "child-src blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(request.nextUrl.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = policy(nonce, request);

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API, static chunks, or the generated icons and images.
      source: "/((?!api|_next/static|_next/image|icon.svg|apple-icon|opengraph-image).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
