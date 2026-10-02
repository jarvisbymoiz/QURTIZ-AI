import { ImageResponse } from "next/og";
import geometry from "@/lib/public/brand.json";
export const alt = "Qurtiz AI — Your AI Social Media Operating System";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#11120f",
          padding: "65px",
          color: "#f3f3ed",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            fontSize: 32,
          }}
        >
          <svg width="64" height="64" viewBox="0 0 48 48">
            <path fill="#d7ef8b" d={geometry.path} />
          </svg>
          Qurtiz AI
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 76,
            lineHeight: 1.08,
            letterSpacing: "-3px",
          }}
        >
          <span>Great ideas.</span>
          <span style={{ color: "#d7ef8b" }}>One intelligent workflow.</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#a9b197",
            fontSize: 21,
          }}
        >
          <span>Research · Create · Design · Schedule · Publish · Analyze</span>
          <span>Free + Public source</span>
        </div>
      </div>
    ),
    size,
  );
}
