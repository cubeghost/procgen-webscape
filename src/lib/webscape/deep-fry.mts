import { randomLcg, randomUniform } from "d3-random";
import type { Image } from "canvas";
import { Context2DFunc } from "./generate.mts";

export type ToJpegFunc<
  C extends CanvasRenderingContext2D = CanvasRenderingContext2D,
> = (context: C, quality: number) => Promise<HTMLImageElement | Image>;

export function deepFryFactory<
  C extends CanvasRenderingContext2D = CanvasRenderingContext2D,
>(context2d: Context2DFunc<C>, toJpeg: ToJpegFunc<C>) {
  /**
   *
   * @param context
   * @param seed
   * @param quality JPEG quality (0-1)
   * @param iterations
   * @param jitterX amount (px) to randomly shift image on X axis
   * @param jitterY amount (px) to randomly shift image on Y axis
   */
  return async function deepFry(
    context: C,
    seed = 42,
    quality = 0.1,
    iterations = 50,
    jitterX = 10,
    jitterY = jitterX,
  ) {
    const { width, height } = context.canvas;
    const context2 = await context2d(
      width + jitterX * 2,
      height + jitterY * 2,
      1,
    );
    const random = randomUniform.source(randomLcg(seed))(0, 1);

    for (let i = 0; i < iterations; i++) {
      const x = (random() * jitterX) | 0;
      const y = (random() * jitterY) | 0;
      context2.drawImage(context.canvas, x, y, width, height);
      const image = (await toJpeg(context2, quality)) as CanvasImageSource;
      context.drawImage(image, x, y, width, height, 0, 0, width, height);
      if ("src" in image && image.src?.startsWith("blob"))
        URL.revokeObjectURL(image.src);
    }
  };
}
