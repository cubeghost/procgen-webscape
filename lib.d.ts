declare module "canvas-dither" {
  class CanvasDither {
    grayscale(image: ImageData): ImageData;
    threshold(image: ImageData, threshold: number): ImageData;
    bayer(image: ImageData, threshold: number): ImageData;
    floydsteinberg(image: ImageData): ImageData;
    atkinson(image: ImageData): ImageData;
  }

  export = new CanvasDither();
}

declare module "@cornerstonejs/codec-libjpeg-turbo-8bit" {
  // From https://github.com/dcm-web/dicom-parser/blob/46b9f05d257930955b6ac839eab88b191961db8d/types/libjpeg-turbo/index.d.ts

  export type FrameInfo = {
    width: number;
    height: number;
    bitsPerSample: number;
    componentCount: number;
    isSigned: boolean;
  };

  export class JPEGDecoder {
    constructor();
    getEncodedBuffer(encodedSize: number): Uint8Array;
    getDecodedBuffer(): Uint8Array;
    readHeader(): void;
    decode(): void;
    decodeRaw(): void;
    getFrameInfo(): FrameInfo;
    delete(): void;
  }

  export class JPEGEncoder {
    constructor();
    getDecodedBuffer(frameInfo: FrameInfo): Uint8Array;
    getEncodedBuffer(): Uint8Array;
    encode(): void;
    setProgressive(progressive: number): void;
    setQuality(quality: number): void;
    setSubSampling(subSampling: number): void;
    delete(): void;
  }

  export type LibJpegTurbo = {
    JPEGDecoder: typeof JPEGDecoder;
    JPEGEncoder: typeof JPEGEncoder;
  };

  function factory(): Promise<LibJpegTurbo>;
  export default factory;
}

// https://github.com/kaitai-io/kaitai_struct/issues/542
declare module "aseprite" {
  type KaitaiProperties<Clean, Parent, Root> = Clean extends false
    ? {
        _io: {
          _byteOffset: number;
          _buffer: ArrayBuffer;
          _dataView: DataView;
          _byteLength: number;
          pos: number;
          bits: number;
          bitsLeft: number;
        };
        _parent: Parent;
        _root: Root;
      }
    : {};

  enum PixelFormat {
    INDEXED = 8,
    GRAYSCALE = 16,
    RGBA = 32,
  }

  enum ChunkType {
    PALETTE_OLD_1 = 4,
    PALETTE_OLD_2 = 17,
    LAYER = 8196,
    CEL = 8197,
    CEL_EXTRA = 8198,
    COLOR_PROFILE = 8199,
    MASK = 8214,
    PATH = 8215,
    TAGS = 8216,
    PALETTE = 8217,
    USERDATA = 8224,
    SLICE = 8226,
  }

  interface FlagsBitset {
    validOpacity: boolean;
  }

  interface Header<Clean> {
    fileSize: number;
    magic: Uint8Array;
    numFrames: number;
    width: number;
    height: number;
    pixelFormat: PixelFormat;
    flags: FlagsBitset;
    speed: number;
    transparentIndex: number;
    numColors: number;
    pixelWidth: number;
    pixelHeight: number;
    gridX: number;
    gridY: number;
    gridWidth: number;
    gridHeight: number;
  }

  type FrameHeader<C, I> = {
    frameBytes: number;
    magic: Uint8Array;
    numChunksOld: number;
    duration: number;
    numChunks: number;
  } & KaitaiProperties<C, Frame<C, I>, Aseprite<C, I>>;

  enum CelType {
    RAW = 0,
    LINKED = 1,
    COMPRESSED = 2,
  }
  type CelChunkData<C, I> = {
    layerIndex: number;
    x: number;
    y: number;
    opacity: number;
  } & (
    | {
        type: CelType.RAW;
        rawWidth: number;
        rawHeight: number;
        pixels: Buffer;
      }
    | {
        type: CelType.LINKED;
        frameLink: number;
      }
    | {
        type: CelType.COMPRESSED;
        width: number;
        height: number;
        pixelsCompressed: Uint8Array;
        pixels: I extends true ? Buffer : undefined;
      }
  ) &
    KaitaiProperties<C, Frame<C, I>, Aseprite<C, I>>;
  type Color = { r: number; g: number; b: number };
  type Packet = { skip: number; numColors: number; colors: Color[] };
  type PaletteOldChunkData<C, I> = {
    numPackets: number;
    packets: Packet[];
  } & KaitaiProperties<C, PaletteOld1Chunk<C, I>, Aseprite<C, I>>;
  type PaletteChunkData<C, I> = {
    numEntries: number;
    entries: (Color & { a: number })[];
  } & KaitaiProperties<C, PaletteOld1Chunk<C, I>, Aseprite<C, I>>;

  type ColorProfileChunk = { type: ChunkType.COLOR_PROFILE; size: number };
  type PaletteOld1Chunk<C, I> = {
    type: ChunkType.PALETTE_OLD_1;
    data: PaletteOldChunkData<C, I>;
  };
  type PaletteOld2Chunk = { type: ChunkType.PALETTE_OLD_2 };
  type CelChunk<C, I> = {
    type: ChunkType.CEL;
    data: CelChunkData<C, I>;
  };
  type CelExtraChunk = { type: ChunkType.CEL_EXTRA };
  type UserdataChunk = { type: ChunkType.USERDATA };
  type LayerChunk = { type: ChunkType.LAYER };
  type TagsChunk = { type: ChunkType.TAGS };
  type PaletteChunk<C, I> = {
    type: ChunkType.PALETTE;
    data: PaletteChunkData<C, I>;
  };
  type MaskChunk = { type: ChunkType.MASK };
  type Chunk<C, I> = { size: number } & (
    | ColorProfileChunk
    | PaletteOld1Chunk<C, I>
    | PaletteOld2Chunk
    | CelChunk<C, I>
    | CelExtraChunk
    | UserdataChunk
    | LayerChunk
    | TagsChunk
    | PaletteChunk<C, I>
    | MaskChunk
  ) &
    KaitaiProperties<C, Frame<C, I>, Aseprite<C, I>>;

  type Frame<C, I> = {
    header: FrameHeader<C, I>;
    chunks: Chunk<C, I>[];
  } & KaitaiProperties<C, Aseprite<C, I>, Aseprite<C, I>>;

  type Aseprite<C, I> = {
    header: Header<C>;
    frames: Frame<C, I>[];
  } & KaitaiProperties<C, null, null>;

  export default class {
    static parse<Clean extends boolean, Inflate extends boolean>(
      buffer: Buffer,
      options?: { clean: Clean; inflate: Inflate },
    ): Aseprite<Clean, Inflate>;

    static Frame: {
      Chunk: {
        ChunkTypeEnum: typeof ChunkType;
        CelChunk: {
          CelTypeEnum: typeof CelType;
        };
      };
    };
  }
}
