import { ImageResponse } from "next/og";
import { flowGlyphStyle, flowMarkStyle } from "@/lib/brand-mark";

export async function GET() {
  return new ImageResponse(
    (
      <div style={flowMarkStyle(512)}>
        <div style={flowGlyphStyle(512)}>if</div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
