import { Buffer } from "buffer";
import { CanvasRenderingContext2D, Image } from "canvas";

import { generatorFactory } from "../../lib/generate.mts";
import { context2d } from "../../lib/context2d.node.mjs";
import type { LibJpegTurbo } from "@cornerstonejs/codec-libjpeg-turbo-8bit";

const SEED = 927517863;

export default async function (request: Request) {
  const { default: libjpegturbojs } = await import(
    import.meta
      .resolve("@cornerstonejs/codec-libjpeg-turbo-8bit/dist/libjpegturbowasm.js")
  );
  const toJpegTurbo = toJpegFactory(await libjpegturbojs());

  const generate = generatorFactory<CanvasRenderingContext2D>(
    context2d,
    toJpegTurbo,
  );
  const generator = generate(SEED, 256, 256, 16);
  while (true) {
    const { done, value: canvas } = await generator.next();
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
