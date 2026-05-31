/* browser-only */

import { parseGIF, decompressFrames, ParsedFrame } from "gifuct-js";
import { DEEP_FRY_ITERATIONS, type Context2DFunc } from "./generate.mts";

export async function replay(
  container: HTMLElement,
  context2d: Context2DFunc<CanvasRenderingContext2D>,
  buffer: ArrayBuffer,
  chunkSize: number,
  scale: number,
): Promise<void> {
  const gif = await parseGIF(buffer);
  const frames = await decompressFrames(gif, true);
  if (!frames.length) throw new Error("no frames");

  const { width, height } = frames[0].dims;
  const xChunks = width / chunkSize;
  const yChunks = height / chunkSize;
  const chunkFrames = xChunks * yChunks;
  const deepFryFrames = DEEP_FRY_ITERATIONS;
  // const effectFrames = frames.length - chunkFrames * 2 - deepFryFrames;
  const chunkFramesStart = frames.length - chunkFrames * 2;
  const vxChunks = Math.ceil(window.innerWidth / scale / chunkSize);
  const vyChunks = Math.ceil(window.innerHeight / scale / chunkSize);

  const context = context2d(width, height, 1);
  container.replaceChildren(context.canvas);

  const queuedFrames: ParsedFrame[] = [];

  // skip every other deep fry frame, for speed
  for (let i = 0; i < deepFryFrames; i += 2) {
    queuedFrames.push(frames[i]);
  }

  queuedFrames.push(...frames.slice(deepFryFrames, chunkFramesStart - 1));

  for (let cy = yChunks - 1, i = chunkFramesStart - 1; cy >= 0; --cy) {
    for (let cx = xChunks - 1; cx >= 0; --cx, i++) {
      if (cy >= yChunks - vyChunks && cx <= vxChunks) {
        queuedFrames.push(frames[i]);
      }
    }
  }
  for (
    let cy = yChunks - 1, i = chunkFramesStart + chunkFrames - 1;
    cy >= 0;
    --cy
  ) {
    for (let cx = xChunks - 1; cx >= 0; --cx, i++) {
      if (cy >= yChunks - vyChunks && cx <= vxChunks) {
        queuedFrames.push(frames[i]);
      }
    }
  }

  return new Promise((resolve, reject) => {
    let currentFrame = 0;
    const delay = 60;
    function drawFrame() {
      const frame = queuedFrames[currentFrame];
      const start = new Date().getTime();

      const image = context.createImageData(width, height);
      image.data.set(frame.patch);
      context.putImageData(image, 0, 0);

      currentFrame++;
      if (currentFrame >= queuedFrames.length) {
        resolve();
        return;
      }

      const end = new Date().getTime();
      const diff = end - start;

      setTimeout(
        () => requestAnimationFrame(drawFrame),
        Math.max(0, Math.floor(delay - diff)),
      );
    }

    drawFrame();
  });
}
