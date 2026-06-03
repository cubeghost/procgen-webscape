import { Config, Context } from "@netlify/functions";
import { Buffer } from "buffer";
import { createCanvas, Image } from "canvas";
import type { CanvasRenderingContext2D } from "canvas";
import GifEncoder from "gif-encoder";

import dimensions from "../../src/lib/webscape/dimensions.mts";
import { generatorFactory } from "../../src/lib/webscape/generate.mts";
import type { LibJpegTurbo } from "@cornerstonejs/codec-libjpeg-turbo-8bit";
import { getStore } from "@netlify/blobs";

const SEED = 883089543;

export default async function (request: Request, context: Context) {
  const store = getStore("webscapes");
  const { format } = context.params;
  const animated = format === "gif";
  const params = new URL(request.url).searchParams;
  const orientation =
    (params.get("orientation") as (typeof dimensions)[number]["id"]) ??
    "landscape";
  const size = dimensions.find((d) => d.id === orientation) ?? dimensions[0];
  const chunkSize = 16;

  const cached = await store.getWithMetadata(`${orientation}.${format}`, {
    type: "stream",
  });
  if (cached) {
    return new Response(cached.data, {
      headers: {
        "Content-Type": `image/${format}`,
        "X-Webscape-Chunk-Size": chunkSize.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const { default: libjpegturbojs } = await import(
    import.meta
      .resolve("@cornerstonejs/codec-libjpeg-turbo-8bit/dist/libjpegturbowasm.js")
  );
  const toJpegTurbo = toJpegFactory(await libjpegturbojs());

  // @ts-expect-error need to fix generator types
  const generator = generatorFactory<CanvasRenderingContext2D>(
    context2d,
    toJpegTurbo,
  );
  const generate = generator(SEED, size.width, size.height, 16, animated);

  if (format === "png") {
    while (true) {
      const { done, value: context } = await generate.next();
      if (done) {
        const image = context.canvas.toBuffer("image/png");

        store.set(`${orientation}.${format}`, image.buffer as ArrayBuffer, {
          metadata: { seed: SEED },
        });

        return new Response(image.buffer as ArrayBuffer, {
          headers: {
            "Content-Type": "image/png",
            "X-Webscape-Chunk-Size": chunkSize.toString(),
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }
  } else if (format === "gif") {
    const body = new ReadableStream<Buffer<ArrayBufferLike>>({
      async start(controller) {
        const encoder = new GifEncoder(size.width, size.height);
        encoder.setRepeat(-1);
        encoder.setDelay(0);
        encoder.on("data", (data) => controller.enqueue(data));
        encoder.writeHeader();

        while (true) {
          const { done, value: context } = await generate.next();
          const { data } = context.getImageData(0, 0, size.width, size.height);
          encoder.addFrame(data);
          if (done) {
            encoder.finish();
            controller.close();
            break;
          }
        }
      },
      async cancel() {
        generate.throw(new Error("Cancelled"));
      },
    });

    const streams = body.tee();

    store.set(`${orientation}.${format}`, streams[0], {
      metadata: { seed: SEED },
    });

    return new Response(streams[1], {
      headers: {
        "Content-Type": "image/gif",
        "Transfer-Encoding": "chunked",
        "X-Webscape-Chunk-Size": chunkSize.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
}

export const config: Config = {
  path: "/webscape.:format(gif|png)",
};

function context2d(
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
