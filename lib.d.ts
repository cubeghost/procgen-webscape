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
