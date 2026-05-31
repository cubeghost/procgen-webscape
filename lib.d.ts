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
