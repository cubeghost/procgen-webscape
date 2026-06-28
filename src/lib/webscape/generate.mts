import { randomLcg, randomUniform, randomInt } from "d3-random";
import { shuffler, rank, min, rollup, ascending, InternMap } from "d3-array";
import CanvasDither from "canvas-dither";

import { noiseImageData } from "./noise.mts";
import { deepFryFactory, type ToJpegFunc } from "./deep-fry.mts";
import { drawLoopedSquare } from "./looped-square.mts";
import { sparkles, cumulativeSparkleWeights } from "./sparkles.mts";
import { drawHappyMac } from "./happy-mac.mts";
import { DEEP_FRY_ITERATIONS } from "./constants.mts";

export type Context2DFunc<
  C extends CanvasRenderingContext2D = CanvasRenderingContext2D,
> = (width: number, height: number, dpi: number) => C;

type Direction =
  | "north"
  | "northEast"
  | "east"
  | "southEast"
  | "south"
  | "southWest"
  | "west"
  | "northWest";
const CARDINAL_DIRECTIONS = ["north", "east", "south", "west"] as const;
type SurroundingChunkIndicies = {
  [key in Direction]: number | undefined;
};
type ChunkMeta = {
  i: number;
  x: number;
  y: number;
  value: number;
  rank: number;
  indicies: SurroundingChunkIndicies;
  category: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

export function generatorFactory<
  C extends CanvasRenderingContext2D = CanvasRenderingContext2D,
>(context2d: Context2DFunc<C>, toJpeg: ToJpegFunc<C>) {
  const deepFry = deepFryFactory(context2d, toJpeg);

  return async function* generate(
    seed: number,
    width: number,
    height: number,
    chunkSize: number,
    animate = false,
  ): AsyncGenerator<C, C, void> {
    const context = context2d(width, height, 1);

    const { width: canvasWidth, height: canvasHeight } = context.canvas;
    const cs = chunkSize;
    const xChunks = canvasWidth / cs;
    const yChunks = canvasHeight / cs;

    const { chunkLoop, chunkReverseLoop, surroundingChunkIndicies } =
      chunkHelperFactory(xChunks, yChunks);

    // randomization (need to be initialized here )
    const random = randomUniform.source(randomLcg(seed))();
    const randomLoopedSquareSize = randomInt.source(randomLcg(seed))(
      Math.max(cs - 6, 10),
      cs - 2,
    );
    const randomLoopedSquareRatio = randomUniform.source(randomLcg(seed))(
      0.22,
      0.55,
    );
    const shuffleQuadrant = shuffler(randomLcg(seed));
    const shuffleRank = shuffler(randomLcg(seed));
    const maxCumulativeWeight =
      cumulativeSparkleWeights[cumulativeSparkleWeights.length - 1];
    const randomSparkleWeight = randomUniform.source(randomLcg(seed))(
      0,
      maxCumulativeWeight,
    );

    context.putImageData(noiseImageData(context, seed, 1), 0, 0);

    // fade top and right edges into background
    const cornerFade = context.createRadialGradient(
      width,
      0,
      0,
      width - Math.min(width, height),
      Math.min(width, height),
      Math.min(width, height),
    );
    cornerFade.addColorStop(0, "white");
    cornerFade.addColorStop(0.55, "rgba(255, 255, 255, 0)");
    context.fillStyle = cornerFade;
    context.globalCompositeOperation = "source-over";
    context.fillRect(0, 0, width, height);
    const topFade = context.createLinearGradient(width / 2, 0, width / 2, height); // prettier-ignore
    topFade.addColorStop(0, "rgba(255, 255, 255, 0.75)");
    topFade.addColorStop(
      Math.round((1 / yChunks) * 100) / 100,
      "rgba(255, 255, 255, 0)",
    );
    context.fillStyle = topFade;
    context.globalCompositeOperation = "source-over";
    context.fillRect(0, 0, width, height);
    const rightFade = context.createLinearGradient(width, height / 2, 0, height / 2); // prettier-ignore
    rightFade.addColorStop(0, "rgba(255, 255, 255, 0.75)");
    rightFade.addColorStop(
      Math.round((1 / xChunks) * 100) / 100,
      "rgba(255, 255, 255, 0)",
    );
    context.fillStyle = rightFade;
    context.globalCompositeOperation = "source-over";
    context.fillRect(0, 0, width, height);

    // if (animate) yield context.canvas;

    // mean darkness in chunks
    const chunkValues = [
      ...chunkLoop(function* (i, cx, cy) {
        const image = context.getImageData(cx * cs, cy * cs, cs, cs);
        let black = 0;
        for (let i = 0; i < image.data.length; i += 4) {
          black += image.data[i];
        }
        const mean = Math.floor(black / (image.data.length / 4));
        yield mean;
      }),
    ];

    // EFFECTS

    // fade white from top
    const gradient = context.createLinearGradient(width, 0, 0, height);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.1)");
    context.fillStyle = gradient;
    context.globalCompositeOperation = "overlay";
    context.fillRect(0, 0, width, height);
    // if (animate) yield await delay(100, context);

    // contrast-y overlay
    context.globalCompositeOperation = "overlay";
    context.fillStyle = "rgba(255, 255, 255, 0.5)";
    context.fillRect(0, 0, width, height);
    // if (animate) yield await delay(100, context);

    // baseLayer: artifacts (deep fry)
    const baseLayer = context2d(width, height, 1);
    const baseImage = context.getImageData(0, 0, canvasWidth, canvasHeight);
    context.putImageData(baseImage, 0, 0);
    context.globalCompositeOperation = "source-over";
    const deepFrySteps = deepFry(
      context,
      seed,
      0.05,
      DEEP_FRY_ITERATIONS,
      2,
      10,
    );
    for await (const frame of deepFrySteps) {
      if (animate) {
        // const friedFrame = CanvasDither.atkinson(
        //   frame.getImageData(0, 0, canvasWidth, canvasHeight),
        // );
        // baseLayer.putImageData(friedFrame, 0, 0);
        // yield await delay(0, baseLayer);
      }
    }
    const friedImage = CanvasDither.atkinson(
      context.getImageData(0, 0, canvasWidth, canvasHeight),
    );
    baseLayer.putImageData(friedImage, 0, 0);
    // if (animate) yield await delay(100, baseLayer);

    // lighterLayer: lighten
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "rgba(255, 255, 255, 0.2)";
    context.fillRect(0, 0, width, height);
    const lighterLayer = context2d(width, height, 1);
    const lighterImage = context.getImageData(0, 0, canvasWidth, canvasHeight);
    lighterLayer.putImageData(CanvasDither.atkinson(lighterImage), 0, 0);
    // if (animate) yield await delay(100, lighterLayer);

    // lightestLayer: lighten more
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "rgba(255, 255, 255, 0.3)";
    context.fillRect(0, 0, width, height);
    const lightestImage = context.getImageData(0, 0, canvasWidth, canvasHeight);
    const lightestLayer = context2d(width, height, 1);
    lightestLayer.putImageData(CanvasDither.atkinson(lightestImage), 0, 0);
    context.drawImage(lightestLayer.canvas, 0, 0);
    if (animate) yield await delay(100, lightestLayer);

    // reset blending
    context.globalCompositeOperation = "source-over";

    // categorize each chunk
    const minValue = min(chunkValues)!;
    const chunkRanks = rank(chunkValues);
    const adjacent = compareAdjacentFactory(chunkValues, chunkRanks);

    const categorizedChunks = [
      ...chunkLoop(function* (i, cx, cy): Generator<ChunkMeta, void, void> {
        const x = cx * cs;
        const y = cy * cs;
        const value = chunkValues[i];
        const rank = chunkRanks[i];
        const indicies = surroundingChunkIndicies(i);

        let category: ChunkMeta["category"];
        if (rank === 0) {
          category = 0;
        } else if (
          value < 70 &&
          adjacent.every(indicies, (v) => v >= 70 || value <= v)
        ) {
          category = 1;
        } else if (value < 80 && adjacent.every(indicies, (_v, r) => r !== 0)) {
          category = 2;
        } else if (value < 80) {
          category = 3;
        } else if (adjacent.some(indicies, (v) => v < 70)) {
          category = 4;
        } else if (value < 128) {
          category = 5;
        } else if (
          indicies.north === undefined ||
          indicies.east === undefined ||
          (cx >= xChunks - 3 && cy < 3) // top right corner
        ) {
          category = 6;
        } else {
          category = 7;
        }

        yield { i, x, y, value, rank, indicies, category };
      }),
    ];

    // rank within categories
    const categoryRanks = rollup(
      categorizedChunks,
      (g) => ({
        indicies: new InternMap(g.map((d, i) => [d.i, i])),
        ranks: rank(g, (a: ChunkMeta, b: ChunkMeta) => ascending(a.value, b.value) || 1), // prettier-ignore
      }),
      (d) => d.category,
    );
    const category2Ranks = categoryRanks.get(2)?.ranks;
    const random2Ranks = category2Ranks ? shuffleRank(category2Ranks) : [];

    // render chunks
    const frameContext = context2d(width, height, 1);
    const layersByCategory = new Map<ChunkMeta["category"], C>([
      [0, lighterLayer],
      [1, lighterLayer],
      [2, baseLayer],
      [3, baseLayer],
      [4, lighterLayer],
      [5, lightestLayer],
      [6, lighterLayer],
      [7, lighterLayer],
    ]);
    yield* chunkReverseLoop(function* (i) {
      const { x, y, category } = categorizedChunks[i];

      const fromCtx = layersByCategory.get(category)!;
      context.drawImage(fromCtx.canvas, x, y, cs, cs, x, y, cs, cs);

      if (animate) {
        frameContext.clearRect(0, 0, width, height);
        frameContext.putImageData(context.getImageData(x, y, cs, cs), x, y);
        yield delay(0, frameContext);
      }
    });
    yield* chunkReverseLoop(function* (i, cx, cy) {
      const { x, y, value, rank, category } = categorizedChunks[i];
      const cr = categoryRanks.get(category)!;
      const categoryRank = cr.ranks[cr.indicies.get(i)!];

      switch (category) {
        case 0:
          fillChunkLoopedSquare(context, x, y, Math.max(cs - 2, 10), 0.25);
          break;
        case 1: {
          if (rank < 7) {
            const ratio = chunkRanks[i] < 2 ? 0.25 : randomLoopedSquareRatio();
            fillChunkLoopedSquare(context, x, y, randomLoopedSquareSize(), ratio); // prettier-ignore
          } else {
            fillChunkSparkles(context, x, y, 1);
          }
          break;
        }
        case 2: {
          if (categoryRank === random2Ranks[0]) {
            const offset = Math.ceil((cs - 9) / 2);
            drawHappyMac(context, x + offset, y + offset);
          } else {
            const count = Math.ceil(((value - minValue) / (80 - minValue)) * 2);
            fillChunkSparkles(context, x, y, count);
          }
          break;
        }
        case 3: {
          const count = Math.ceil(((value - minValue) / (80 - minValue)) * 2);
          fillChunkSparkles(context, x, y, count);
          break;
        }
        case 4: {
          const scatter = random();
          if (scatter > 0.5) {
            fillChunkSparkles(context, x, y, 1);
          }
          break;
        }
        case 5: // no decorations
        case 6: // no decorations on faded edges
          break;
        case 7: {
          const scatter = random();
          if ((value > 200 && scatter > 0.4) || scatter > 0.95) {
            console.log("scattered sparke at", cx, cy);
            fillChunkSparkles(context, x, y, 1);
          }
          break;
        }
      }

      if (animate) {
        frameContext.clearRect(0, 0, width, height);
        frameContext.putImageData(context.getImageData(x, y, cs, cs), x, y);
        yield delay(0, frameContext);
      }
    });

    yield context;
    return context;

    // CHUNK DECORATION HELPERS

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
  };
}

const delay = <T,>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function chunkHelperFactory(xChunks: number, yChunks: number) {
  const maxChunk = xChunks * yChunks - 1;

  return {
    chunkLoop: function* <T>(
      func: (i: number, cx: number, cy: number) => Generator<T, void, void>,
    ): Generator<T, void, void> {
      for (let chunkY = 0, i = 0; chunkY < yChunks; ++chunkY) {
        for (let chunkX = 0; chunkX < xChunks; ++chunkX, i++) {
          yield* func(i, chunkX, chunkY);
        }
      }
    },
    chunkReverseLoop: function* <T>(
      func: (i: number, cx: number, cy: number) => Generator<T, void, void>,
    ): Generator<T, void, void> {
      for (let chunkY = yChunks - 1, i = maxChunk; chunkY >= 0; --chunkY) {
        for (let chunkX = xChunks - 1; chunkX >= 0; --chunkX, i--) {
          yield* func(i, chunkX, chunkY);
        }
      }
    },
    surroundingChunkIndicies: (i: number): SurroundingChunkIndicies => {
      const hasNorth = i >= xChunks;
      const hasEast = (i + 1) % xChunks > 0;
      const hasSouth = i < xChunks * (yChunks - 1);
      const hasWest = i % xChunks > 0;

      return {
        north: hasNorth ? i - xChunks : undefined,
        northEast: hasNorth && hasEast ? i - xChunks + 1 : undefined,
        east: hasEast ? i + 1 : undefined,
        southEast: hasSouth && hasEast ? i + xChunks + 1 : undefined,
        south: hasSouth ? i + xChunks : undefined,
        southWest: hasSouth && hasWest ? i + xChunks - 1 : undefined,
        west: hasWest ? i - 1 : undefined,
        northWest: hasNorth && hasWest ? i - xChunks - 1 : undefined,
      };
    },
  };
}

function compareAdjacentFactory(
  chunkValues: number[],
  chunkRanks: Float64Array,
) {
  const fn =
    (method: "some" | "every") =>
    (
      indicies: SurroundingChunkIndicies,
      compare: (value: number, rank: number | undefined) => boolean,
    ) =>
      CARDINAL_DIRECTIONS[method]((dir) => {
        const index = indicies[dir];
        return index !== undefined
          ? compare(chunkValues[index], chunkRanks[index])
          : compare(255, undefined);
      });

  return {
    some: fn("some"),
    every: fn("every"),
  };
}
