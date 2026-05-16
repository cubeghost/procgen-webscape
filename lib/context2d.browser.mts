export function context2d(
  width: number,
  height: number,
  dpi = 1,
): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width * dpi;
  canvas.height = height * dpi;
  canvas.style.setProperty("image-rendering", "pixelated");
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.scale(dpi, dpi);
  return context;
}
