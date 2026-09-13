export function flowMarkStyle(size: number): Record<string, string | number> {
  return {
    width: size,
    height: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Math.round(size * 0.28),
    background: "linear-gradient(135deg, #b6338a 0%, #e05a8f 45%, #e8935a 100%)",
  };
}

export function flowGlyphStyle(size: number): Record<string, string | number> {
  return {
    fontSize: Math.round(size * 0.5),
    fontWeight: 700,
    color: "#fbeee2",
    fontFamily: "sans-serif",
  };
}
