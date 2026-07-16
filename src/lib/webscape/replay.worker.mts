/* web worker */

import { parseGIF, decompressFrames, ParsedFrame } from "gifuct-js";
import { DEEP_FRY_ITERATIONS } from "./constants.mjs";

interface ReplayEvent {
  type: "replay";
  canvas: OffscreenCanvas;
  buffer: ArrayBuffer;
  chunkSize: number;
  scale: number;
  vw: number;
  vh: number;
}

export async function replay(
  canvas: OffscreenCanvas,
  buffer: ArrayBuffer,
  chunkSize: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
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
  const vxChunks = Math.ceil(viewportWidth / scale / chunkSize);
  const vyChunks = Math.ceil(viewportHeight / scale / chunkSize);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("unable to get 2d context");

  const queuedFrames: ParsedFrame[] = [];

  // skip every other deep fry frame, for speed
  // for (let i = 0; i < deepFryFrames; i += 2) {
  //   queuedFrames.push(frames[i]);
  // }

  // queuedFrames.push(...frames.slice(deepFryFrames, chunkFramesStart - 1));
  queuedFrames.push(...frames.slice(0, chunkFramesStart - 1));

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
    const delay = 30;
    async function drawFrame() {
      try {
        const frame = queuedFrames[currentFrame];
        const start = new Date().getTime();

        const image = context!.createImageData(width, height);
        image.data.set(frame.patch);
        const bitmap = await createImageBitmap(image);
        context!.drawImage(bitmap, 0, 0);
        bitmap.close();

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
      } catch (err) {
        reject(err);
      }
    }

    drawFrame();
  });
}

self.addEventListener("message", async (event: MessageEvent<ReplayEvent>) => {
  try {
    const { canvas, buffer, chunkSize, scale, vw, vh } = event.data;
    await replay(canvas, buffer, chunkSize, scale, vw, vh);

    self.postMessage({ type: "done" });
  } catch (error) {
    console.log(error);
    self.postMessage({
      type: "error",
      error: (error as Error).message,
    });
  }
});
