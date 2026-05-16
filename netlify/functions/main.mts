import fs from "fs";
import sharp from "sharp";
import { Image, type CanvasRenderingContext2D, jpegVersion } from "canvas";
import libjpegturbojs from "@cornerstonejs/codec-libjpeg-turbo-8bit";

import { generatorFactory } from "../../lib/generate.mts";
import { context2d } from "../../lib/context2d.node.mjs";

export default async function (request: Request) {
  const libjpegturbo = libjpegturbojs();
  console.log(libjpegturbo);
  const generate = generatorFactory(context2d, toJpeg);
  const generator = generate(859323946, 256, 256, 16);
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

// async function toJpeg(
//   context: CanvasRenderingContext2D,
//   quality: number,
// ): Promise<Image> {
//   return new Promise((resolve, reject) => {
//     context.canvas.toDataURL(
//       "image/jpeg",
//       {
//         quality,
//       },
//       (err, dataUrl) => {
//         if (err) reject(err);
//         const image = new Image();
//         image.onload = () => resolve(image);
//         image.onerror = reject;
//         image.src = dataUrl;
//       },
//     );
//   });
// }
async function toJpeg(
  context: CanvasRenderingContext2D,
  quality: number,
): Promise<Image> {
  return new Promise((resolve, reject) => {
    const { width, height } = context.canvas;
    const data = context.getImageData(0, 0, width, height);
    sharp(data.data, {
      raw: {
        width,
        height,
        channels: 4,
      },
    })
      .jpeg({ quality: quality * 100, mozjpeg: true })
      .toBuffer()
      .then((buffer) => {
        const mimeType = "image/jpeg";
        const encoded = buffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${encoded}`;
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });
  });
}
