import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The favicon's ring on a full square: iOS rounds the corners itself.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0a1428" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="12" fill="#142344" />
          <circle cx="32" cy="32" r="21" fill="none" stroke="#22375f" strokeWidth="8" />
          <path d="M50.19 42.5A21 21 0 0 1 13.81 21.5" fill="none" stroke="#dcdfe4" strokeWidth="8" />
          <path d="M32 4V19" stroke="#f3f5f8" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
