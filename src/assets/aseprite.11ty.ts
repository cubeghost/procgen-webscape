import { readdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import Aseprite from "aseprite";
import type {
  Aseprite as AsepriteDoc,
  CelChunk,
  PaletteChunk,
  PaletteOld1Chunk,
} from "aseprite";
import sharp from "sharp";

const dir = "./src/assets";
const output = "./dist/assets";
const entryPoints = readdirSync(dir, { withFileTypes: true })
  .filter((file) => file.isFile() && path.extname(file.name) === ".aseprite")
  .map((file) => path.basename(file.name, path.extname(file.name)));

const ChunkTypeEnum = Aseprite.Frame.Chunk.ChunkTypeEnum;
const CelTypeEnum = Aseprite.Frame.Chunk.CelChunk.CelTypeEnum;
const LayerTypeEnum = Aseprite.Frame.Chunk.LayerChunk.TypeEnum;
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
    try {
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

      const oldPalette = ase.frames[0].chunks.find(
        (c) => c.type === ChunkTypeEnum.PALETTE_OLD_1,
      );
      const palette =
        ase.frames[0].chunks.find((c) => c.type === ChunkTypeEnum.PALETTE) ??
        oldPalette;
      if (!palette) {
        throw new Error(
          `missing palette chunk in first frame of ${entrypoint}`,
        );
      }

      const frames = await Promise.all(
        ase.frames.map(async (frame, i) => {
          // TODO multiple layers
          const cel = frame.chunks.find((c) => c.type === ChunkTypeEnum.CEL);
          if (!cel) throw new Error(`missing cel chunk in ${entrypoint}`);

          if (
            cel.data.type !== CelTypeEnum.COMPRESSED &&
            cel.data.type !== CelTypeEnum.COMPRESSED_TILEMAP
          ) {
            throw new Error(
              `unsupported cel type in ${entrypoint}: ${cel.data.type}`,
            );
          }

          const image =
            cel.data.type === CelTypeEnum.COMPRESSED
              ? await readCompressedPixels(cel, ase, palette, mode)
              : cel.data.type === CelTypeEnum.COMPRESSED_TILEMAP
                ? await readCompressedTilemapPixels(cel, ase, palette, mode)
                : null;

          if (!image) throw new Error("impossible");

          const { info } = await image.toBuffer({ resolveWithObject: true });
          return image.extend({
            top: cel.data.y,
            left: cel.data.x,
            bottom: ase.header.height - info.height + cel.data.y,
            right: ase.header.width - info.width + cel.data.x,
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
    } catch (err) {
      console.log(`Error converting ${baseName}.aseprite`);
      throw err;
    }
  }
}

async function readCompressedPixels<C, I>(
  cel: CelChunk<C, I>,
  ase: AsepriteDoc<C, I>,
  palette: PaletteChunk<C, I> | PaletteOld1Chunk<C, I>,
  mode: (typeof ColorModeEnum)[keyof typeof ColorModeEnum],
) {
  if (cel.data.type !== CelTypeEnum.COMPRESSED) {
    throw new Error("wrong cel format");
  }

  let buffer: Buffer | Uint8Array = cel.data.pixels!;
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
}

async function readCompressedTilemapPixels<C, I>(
  cel: CelChunk<C, I>,
  ase: AsepriteDoc<C, I>,
  palette: PaletteChunk<C, I> | PaletteOld1Chunk<C, I>,
  mode: (typeof ColorModeEnum)[keyof typeof ColorModeEnum],
) {
  if (cel.data.type !== CelTypeEnum.COMPRESSED_TILEMAP) {
    throw new Error("wrong cel format");
  }

  const layers = ase.frames[0].chunks.filter(
    (chunk) => chunk.type === ChunkTypeEnum.LAYER,
  );
  const layer = layers[cel.data.layerIndex];
  if (layer.data.type !== LayerTypeEnum.TILEMAP) {
    throw new Error("wrong layer type");
  }
  const tilesets = ase.frames[0].chunks.filter(
    (chunk) => chunk.type === ChunkTypeEnum.TILESET,
  );

  const tileset = tilesets[layer.data.tilesetIndex];

  if (!tileset) {
    throw new Error("aghhhg");
  }
  let tilesetBuffer: Buffer | Uint8Array = tileset.data.pixels!;

  if (mode === ColorModeEnum.INDEXED) {
    const originalBuffer = tilesetBuffer;
    tilesetBuffer = new Uint8Array(originalBuffer.length * 4);

    const transparentIndex = ase.header.transparentIndex;
    const colors =
      palette.type === ChunkTypeEnum.PALETTE_OLD_1
        ? palette.data.packets[0].colors
        : palette.data.entries;

    for (let i = 0; i < originalBuffer.length; i++) {
      const colorIndex = originalBuffer[i];
      if (colorIndex === transparentIndex) {
        tilesetBuffer.set([0, 0, 0, 0], i * 4);
      } else {
        const color = colors[colorIndex];
        tilesetBuffer.set([color.r, color.g, color.b, 255], i * 4);
      }
    }
  }
  const tilesetImage = await sharp(tilesetBuffer, {
    raw: {
      width: tileset.data.tileWidth,
      height: tileset.data.tileHeight * tileset.data.numTiles,
      channels: mode === ColorModeEnum.INDEXED ? 4 : mode,
    },
  });

  const tilesBuffer = cel.data.tiles!;
  const width = cel.data.tilesWidth * tileset.data.tileWidth;
  const height = cel.data.tilesHeight * tileset.data.tileHeight;

  const tiles = [];
  let i = 0;
  for (let y = 0; y < cel.data.tilesHeight; y++) {
    for (let x = 0; x < cel.data.tilesWidth; x++, i++) {
      const tileIndex = tilesBuffer[i * 4];
      if (tileIndex > 0) {
        const tileImage = await tilesetImage.clone().extract({
          left: 0,
          top: tileIndex * tileset.data.tileHeight,
          width: tileset.data.tileWidth,
          height: tileset.data.tileHeight,
        });
        tiles.push({
          image: tileImage,
          x,
          y,
        });
      }
    }
  }

  const base = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const inputs = await Promise.all(
    tiles.map(async ({ image, x, y }) => ({
      input: await image.png().toBuffer(),
      top: y * tileset.data.tileHeight,
      left: x * tileset.data.tileWidth,
    })),
  );
  base.composite(inputs);

  return base;
}
