import { Buffer } from "buffer";
import { createCanvas, Image } from "canvas";
import type { CanvasRenderingContext2D } from "canvas";

import { generatorFactory } from "../../src/lib/webscape/generate.mts";
import type { LibJpegTurbo } from "@cornerstonejs/codec-libjpeg-turbo-8bit";

const SEED = 883089543;

// TODO generate largest size, crop and cache for many sizes, and then return appropriate size

const dimensions = {
  landscape: [512, 384],
  portrait: [256, 512],
} as const;

export default async function (request: Request) {
  const { default: libjpegturbojs } = await import(
    import.meta
      .resolve("@cornerstonejs/codec-libjpeg-turbo-8bit/dist/libjpegturbowasm.js")
  );
  const toJpegTurbo = toJpegFactory(await libjpegturbojs());

  const params = new URL(request.url).searchParams;
  const orientation =
    (params.get("orientation") as keyof typeof dimensions) ?? "landscape";
  const size = dimensions[orientation] ?? dimensions.landscape;

  // @ts-expect-error need to fix generator types
  const generator = generatorFactory<CanvasRenderingContext2D>(
    context2d,
    toJpegTurbo,
  );
  const generate = generator(SEED, size[0], size[1], 16);
  while (true) {
    const { done, value: canvas } = await generate.next();
    if (done) {
      const image = canvas.toBuffer("image/png");

      return new Response(image, {
        headers: {
          "Content-Type": "image/png",
          "Content-Length": image.length,
        },
      });
    }
  }
}

export function context2d(
  width: number,
  height: number,
  _dpi = 1,
): CanvasRenderingContext2D {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d")!;
  return context;
}

function toJpegFactory(libjpegturbo: LibJpegTurbo) {
  return async function (context: CanvasRenderingContext2D, quality: number) {
    return new Promise((resolve, reject) => {
      const { width, height } = context.canvas;
      const { data: rgba } = context.getImageData(0, 0, width, height);
      // convert 4 channel rgba to 3 channel rgb
      const rgb = new Uint8Array(width * height * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
        rgb[j] = rgba[i];
        rgb[j + 1] = rgba[i + 1];
        rgb[j + 2] = rgba[i + 2];
      }

      const encoder = new libjpegturbo.JPEGEncoder();
      const decodedBytes = encoder.getDecodedBuffer({
        width,
        height,
        bitsPerSample: 8,
        componentCount: 3, // channels
        isSigned: false,
      });
      decodedBytes.set(rgb);

      encoder.setProgressive(0);
      encoder.setQuality(quality * 100);

      encoder.encode(); // iterations?

      const encodedBytes = encoder.getEncodedBuffer();

      const buffer = Buffer.from(encodedBytes);
      const encoded = buffer.toString("base64");
      const dataUrl = `data:image/jpeg;base64,${encoded}`;

      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;

      encoder.delete();
    });
  };
}
