import { createCanvas, type CanvasRenderingContext2D } from "canvas";

export function context2d(
  width: number,
  height: number,
  _dpi = 1,
): CanvasRenderingContext2D {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d")!;
  return context;
}
