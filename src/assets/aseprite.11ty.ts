import { readdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import Aseprite from "aseprite";
import sharp from "sharp";

const dir = "./src/assets";
const output = "./dist/assets";
const entryPoints = readdirSync(dir, { withFileTypes: true })
  .filter((file) => file.isFile() && path.extname(file.name) === ".aseprite")
  .map((file) => path.basename(file.name, path.extname(file.name)));

const ChunkTypeEnum = Aseprite.Frame.Chunk.ChunkTypeEnum;
const CelTypeEnum = Aseprite.Frame.Chunk.CelChunk.CelTypeEnum;
// https://github.com/aseprite/aseprite/blob/main/src/doc/color_mode.h#L22
const ColorModeEnum = {
  RGB: 4,
  GRAYSCALE: 2,
  INDEXED: 1,
} as const;

type EntrypointData = { baseName: string };

export default class {
  async data() {
    return {
      entryPoints,
      pagination: {
        data: "entryPoints",
        alias: "baseName",
        size: 1,
      },
      permalink: ({ baseName }: EntrypointData) => `/assets/${baseName}.png`,
      eleventyExcludeFromCollections: true,
      layout: false,
    };
  }

  async render({ baseName }: EntrypointData) {
    const entrypoint = path.join(dir, `${baseName}.aseprite`);
    const file = await fs.readFile(entrypoint);
    const ase = Aseprite.parse(file, { clean: true, inflate: true });
    if (!ase.header) throw new Error(`missing header in ${entrypoint}`);

    const depth = ase.header?.pixelFormat;
    // https://github.com/aseprite/aseprite/blob/main/src/dio/aseprite_decoder.cpp#L60
    const mode =
      depth == 32
        ? ColorModeEnum.RGB
        : depth == 16
          ? ColorModeEnum.GRAYSCALE
          : ColorModeEnum.INDEXED;

    if (!ase.frames) throw new Error(`missing frames in ${entrypoint}`);

    const palette = ase.frames[0].chunks.find(
      (c) =>
        c.type === ChunkTypeEnum.PALETTE_OLD_1 ||
        c.type === ChunkTypeEnum.PALETTE,
    );
    if (!palette) {
      throw new Error(`missing palette chunk in first frame of ${entrypoint}`);
    }

    const frames = await Promise.all(
      ase.frames.map(async (frame) => {
        // TODO multiple layers
        const cel = frame.chunks.find((c) => c.type === ChunkTypeEnum.CEL);
        if (!cel) throw new Error(`missing cel chunk in ${entrypoint}`);
        if (cel.data.type !== CelTypeEnum.COMPRESSED)
          throw new Error(
            `unsupported cel type in ${entrypoint}: ${cel.data.type}`,
          );

        let buffer: Buffer | Uint8Array = cel.data.pixels;
        if (mode === ColorModeEnum.INDEXED) {
          const originalBuffer = buffer;
          buffer = new Uint8Array(originalBuffer.length * 4);

          const transparentIndex = ase.header.transparentIndex;
          const colors =
            palette.type === ChunkTypeEnum.PALETTE_OLD_1
              ? palette.data.packets[0].colors
              : palette.data.entries;

          for (let i = 0; i < originalBuffer.length; i++) {
            const colorIndex = originalBuffer[i];
            if (colorIndex === transparentIndex) {
              buffer.set([0, 0, 0, 0], i * 4);
            } else {
              const color = colors[colorIndex];
              buffer.set([color.r, color.g, color.b, 255], i * 4);
            }
          }
        }

        const image = await sharp(buffer, {
          raw: {
            width: cel.data.width,
            height: cel.data.height,
            channels: mode === ColorModeEnum.INDEXED ? 4 : mode,
          },
        });
        const { info } = await image.toBuffer({ resolveWithObject: true });
        return image.extend({
          top: cel.data.y,
          left: cel.data.x,
          bottom: ase.header.height - info.height - cel.data.y,
          right: ase.header.width - info.width - cel.data.x,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      }),
    );

    if (frames.length === 1) {
      // output single frame
      frames[0].png().toFile(`${output}/${baseName}.png`);
    } else {
      // create basic side-by-side spritesheet
      const base = await sharp({
        create: {
          width: ase.header.width * ase.header.numFrames,
          height: ase.header.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      });

      const inputs = await Promise.all(
        frames.map(async (frame, i) => ({
          input: await frame.png().toBuffer(),
          top: 0,
          left: i * ase.header.width,
        })),
      );
      base.composite(inputs).png().toFile(`${output}/${baseName}.png`);
    }
  }
}
