import { ImageResponse } from "next/og";
import { flowGlyphStyle, flowMarkStyle } from "@/lib/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={flowMarkStyle(180)}>
        <div style={flowGlyphStyle(180)}>if</div>
      </div>
    ),
    { ...size }
  );
}
