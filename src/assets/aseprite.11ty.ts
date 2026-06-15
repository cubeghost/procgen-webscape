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
    };
  }

  async render({ baseName }: EntrypointData) {
    const entrypoint = path.join(dir, `${baseName}.aseprite`);
    const file = await fs.readFile(entrypoint);
    const ase = Aseprite.parse(file, { clean: true, inflate: true });
    if (!ase.header) throw new Error(`missing header in ${entrypoint}`);
    if (!ase.frames || ase.frames.length > 1) {
      throw new Error(`wrong number of frames in ${entrypoint}`);
    }
    const frame = ase.frames[0];

    const cel = frame.chunks.find((chunk) => chunk.type === ChunkTypeEnum.CEL);
    const palette = frame.chunks.find(
      (chunk) => chunk.type === ChunkTypeEnum.PALETTE_OLD_1,
    );

    const depth = ase.header?.pixelFormat;
    // https://github.com/aseprite/aseprite/blob/main/src/dio/aseprite_decoder.cpp#L60
    const mode =
      depth == 32
        ? ColorModeEnum.RGB
        : depth == 16
          ? ColorModeEnum.GRAYSCALE
          : ColorModeEnum.INDEXED;

    let buffer = cel.data.pixels;
    if (mode === ColorModeEnum.INDEXED) {
      const originalBuffer = buffer;
      buffer = new Uint8Array(originalBuffer.length * 4);

      const transparentIndex = ase.header.transparentIndex;
      const colors = palette.data.packets[0].colors;

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
    image
      .extend({
        top: cel.data.y,
        left: cel.data.x,
        bottom: ase.header.height - info.height - cel.data.y,
        right: ase.header.width - info.width - cel.data.x,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(`${output}/${baseName}.png`);
  }
}
