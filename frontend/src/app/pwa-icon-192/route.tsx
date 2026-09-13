import { ImageResponse } from "next/og";
import { flowGlyphStyle, flowMarkStyle } from "@/lib/brand-mark";

export async function GET() {
  return new ImageResponse(
    (
      <div style={flowMarkStyle(192)}>
        <div style={flowGlyphStyle(192)}>if</div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
