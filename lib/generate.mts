import * as d3 from "d3";
import CanvasDither from "canvas-dither";

import { noiseImageData } from "./noise.mts";
import { deepFryFactory, type ToJpegFunc } from "./deep-fry.mts";
import { drawLoopedSquare } from "./looped-square.mts";
import { sparkles, cumulativeSparkleWeights } from "./sparkles.mts";

const DITHER_ENABLED = false;

export type Context2DFunc<
  T extends CanvasRenderingContext2D = CanvasRenderingContext2D,
> = (width: number, height: number, dpi: number) => T;

type Direction =
  | "north"
  | "northEast"
  | "east"
  | "southEast"
  | "south"
  | "southWest"
  | "west"
  | "northWest";
type SurroundingChunkInfo = {
  [key in Direction]: number | undefined;
} & {
  self: number;
};

export function generatorFactory<
  C extends CanvasRenderingContext2D = CanvasRenderingContext2D,
>(context2d: Context2DFunc<C>, toJpeg: ToJpegFunc<C>) {
  const deepFry = deepFryFactory(context2d, toJpeg);

  return async function* generate(
    seed: number,
    width: number,
    height: number,
    cs: number,
  ): AsyncGenerator<C["canvas"], C["canvas"], void> {
    const animate = false;

    const context = context2d(width, height, 1);

    const { width: canvasWidth, height: canvasHeight } = context.canvas;
    const xChunks = canvasWidth / cs;
    const yChunks = canvasHeight / cs;

    // randomization utils
    const random = d3.randomUniform.source(d3.randomLcg(seed))();
    const randomLoopedSquareSize = d3.randomInt.source(d3.randomLcg(seed))(
      Math.max(cs - 6, 10),
      cs - 2,
    );
    const randomLoopedSquareRatio = d3.randomUniform.source(d3.randomLcg(seed))(
      0.22,
      0.55,
    );
    const shuffleQuadrant = d3.shuffler(d3.randomLcg(seed));
    const maxCumulativeWeight =
      cumulativeSparkleWeights[cumulativeSparkleWeights.length - 1];
    const randomSparkleWeight = d3.randomUniform.source(d3.randomLcg(seed))(
      0,
      maxCumulativeWeight,
    );

    context.putImageData(noiseImageData(context, seed, 1), 0, 0);

    if (animate) yield context.canvas;

    // mean darkness in chunks
    const chunks = [];
    for (let y = 0; y < yChunks; ++y) {
      for (let x = 0; x < xChunks; ++x) {
        const image = context.getImageData(x * cs, y * cs, cs, cs);
        let black = 0;
        for (let i = 0; i < image.data.length; i += 4) {
          black += image.data[i];
        }
        const mean = Math.floor(black / (image.data.length / 4));
        chunks.push(mean);
      }
    }

    // EFFECTS
    const maybeDither = (image: ImageData): ImageData =>
      DITHER_ENABLED ? maybeDither(image) : image;

    // fade white from top
    const gradient = context.createLinearGradient(
      width / 2,
      0,
      width / 2,
      height,
    );
    gradient.addColorStop(0, "white");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.1)");
    context.fillStyle = gradient;
    context.globalCompositeOperation = "overlay";
    context.fillRect(0, 0, width, height);
    if (animate) yield await delay(100, context.canvas);

    // contrast-y overlay
    context.globalCompositeOperation = "overlay";
    context.fillStyle = "rgba(255, 255, 255, 0.5)";
    context.fillRect(0, 0, width, height);
    if (animate) yield await delay(100, context.canvas);

    // baseLayer: artifacts (deep fry)
    const baseLayer = context2d(width, height, 1);
    const baseImage = context.getImageData(0, 0, canvasWidth, canvasHeight);
    context.putImageData(baseImage, 0, 0);
    context.globalCompositeOperation = "source-over";
    await deepFry(context, seed, 0.05, 100, 2, 10);
    const friedImage = maybeDither(
      context.getImageData(0, 0, canvasWidth, canvasHeight),
    );
    baseLayer.putImageData(friedImage, 0, 0);
    if (animate) yield await delay(100, baseLayer.canvas);

    // lighterLayer: lighten
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "rgba(255, 255, 255, 0.2)";
    context.fillRect(0, 0, width, height);
    const lighterLayer = context2d(width, height, 1);
    const lighterImage = context.getImageData(0, 0, canvasWidth, canvasHeight);
    lighterLayer.putImageData(maybeDither(lighterImage), 0, 0);
    if (animate) yield await delay(100, lighterLayer.canvas);

    // lightestLayer: lighten more
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "rgba(255, 255, 255, 0.3)";
    context.fillRect(0, 0, width, height);
    const lightestImage = context.getImageData(0, 0, canvasWidth, canvasHeight);
    const lightestLayer = context2d(width, height, 1);
    lightestLayer.putImageData(maybeDither(lightestImage), 0, 0);
    context.drawImage(lightestLayer.canvas, 0, 0);
    if (animate) yield await delay(100, lightestLayer.canvas);

    // reset blending
    context.globalCompositeOperation = "source-over";

    // render each chunk
    const minValue = d3.min(chunks)!;
    const ranks = d3.rank(chunks);
    for (let chunkY = 0, i = 0; chunkY < yChunks; ++chunkY) {
      for (let chunkX = 0; chunkX < xChunks; ++chunkX, i++) {
        const x = chunkX * cs;
        const y = chunkY * cs;
        const chunkInfo = surroundingChunks(chunks, i);
        const copyChunk = (fromCtx: C) =>
          context.drawImage(fromCtx.canvas, x, y, cs, cs, x, y, cs, cs);

        if (ranks[i] === 0) {
          copyChunk(lighterLayer);

          fillChunkLoopedSquare(context, x, y, Math.max(cs - 2, 10), 0.25);
        } else if (
          chunkInfo.self < 70 &&
          chunkInfo.north &&
          (chunkInfo.north >= 70 || chunkInfo.self <= chunkInfo.north) &&
          chunkInfo.east &&
          (chunkInfo.east >= 70 || chunkInfo.self <= chunkInfo.east) &&
          chunkInfo.south &&
          (chunkInfo.south >= 70 || chunkInfo.self <= chunkInfo.south) &&
          chunkInfo.west &&
          (chunkInfo.west >= 70 || chunkInfo.self <= chunkInfo.west)
        ) {
          copyChunk(lighterLayer);

          if (ranks[i] < 7) {
            const ratio = ranks[i] < 2 ? 0.25 : randomLoopedSquareRatio();
            fillChunkLoopedSquare(
              context,
              x,
              y,
              randomLoopedSquareSize(),
              ratio,
            );
          } else {
            fillChunkSparkles(context, x, y, 1);
          }
        } else if (chunkInfo.self < 80) {
          copyChunk(baseLayer);

          const count = Math.ceil(
            ((chunkInfo.self - minValue) / (80 - minValue)) * 2,
          );
          fillChunkSparkles(context, x, y, count);
        } else if (
          (chunkInfo.north && chunkInfo.north < 70) ||
          (chunkInfo.east && chunkInfo.east < 70) ||
          (chunkInfo.south && chunkInfo.south < 70) ||
          (chunkInfo.west && chunkInfo.west < 70)
        ) {
          copyChunk(lighterLayer);

          const scatter = random();
          if (scatter > 0.5) {
            fillChunkSparkles(context, x, y, 1);
          }
        } else if (chunkInfo.self < 128) {
          copyChunk(lightestLayer);
        } else {
          copyChunk(lighterLayer);

          const scatter = random();
          if ((chunkInfo.self > 200 && scatter > 0.4) || scatter > 0.95) {
            fillChunkSparkles(context, x, y, 1);
          }
        }

        if (animate) yield await delay(0, context.canvas);
      }
    }

    yield context.canvas;
    return context.canvas;

    // chunk fill helpers

    function fillChunkLoopedSquare(
      context: C,
      x: number,
      y: number,
      size: number,
      loopRatio: number,
    ) {
      const loopSize = Math.round(size * loopRatio);
      const offset = Math.ceil((cs - size) / 2);
      drawLoopedSquare(context, x + offset, y + offset, size, loopSize);
    }

    function weightedRandomSparkle(): number {
      const n = randomSparkleWeight();
      for (let i = 0; i < sparkles.length; i++) {
        if (cumulativeSparkleWeights[i] >= n) return i;
      }
      return sparkles.length - 1;
    }

    function fillChunkSparkles(
      context: C,
      x: number,
      y: number,
      count: number,
    ) {
      const quadSize = cs / 2;
      const quadrants = shuffleQuadrant([
        ...Array.from({ length: 4 }, (_, j) => j < count),
      ]);
      quadrants.forEach((enabled, j) => {
        if (!enabled) return;
        const { draw, size } = sparkles[weightedRandomSparkle()];
        const quadX = x + Math.floor(j / 2) * quadSize;
        const quadY = y + (j % 2) * quadSize;
        const offsetX = Math.floor((quadSize - size) * random());
        const offsetY = Math.floor((quadSize - size) * random());

        draw(context, quadX + offsetX, quadY + offsetY);
      });
    }

    function surroundingChunks(
      chunks: number[],
      i: number,
    ): SurroundingChunkInfo {
      const xChunks = width / cs;
      const yChunks = height / cs;
      const hasEast = (i + 1) % xChunks > 0;
      const hasWest = i % xChunks > 0;

      return {
        self: chunks[i],
        north: chunks[i - xChunks],
        northEast: hasEast ? chunks[i - xChunks + 1] : undefined,
        east: hasEast ? chunks[i + 1] : undefined,
        southEast: hasEast ? chunks[i + xChunks + 1] : undefined,
        south: chunks[i + xChunks],
        southWest: hasWest ? chunks[i + xChunks - 1] : undefined,
        west: hasWest ? chunks[i - 1] : undefined,
        northWest: hasWest ? chunks[i - xChunks - 1] : undefined,
      };
    }
  };
}

const delay = <T,>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
