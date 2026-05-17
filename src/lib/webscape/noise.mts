const NOISE_RADIUS = 64;
const NOISE_OCTAVES = 12;

export function noiseImageData<
  C extends CanvasRenderingContext2D = CanvasRenderingContext2D,
>(context: C, z: number, dpi = 1) {
  const { width, height } = context.canvas;
  const radius = NOISE_RADIUS * dpi;
  const image = context.createImageData(width, height);
  const noise = octave(perlin3, NOISE_OCTAVES);
  for (let y = 0, i = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x, i += 4) {
      const c = 128 + noise(x / radius, y / radius, z) * 256;
      image.data.fill(255 - c, i, i + 3);
      image.data[i + 3] = 255; // alpha
    }
  }
  return image;
}

// From https://observablehq.com/@mbostock/perlin-noise

const P = Uint8Array.of(151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180); // prettier-ignore
const p = new Uint8Array(512);
for (let i = 0; i < 256; ++i) p[i] = p[i + 256] = P[i];

export function perlin3(x: number, y: number, z: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const X = xi & 255,
    Y = yi & 255,
    Z = zi & 255;
  const u = fade((x -= xi)),
    v = fade((y -= yi)),
    w = fade((z -= zi));
  const A = p[X] + Y,
    AA = p[A] + Z,
    AB = p[A + 1] + Z;
  const B = p[X + 1] + Y,
    BA = p[B] + Z,
    BB = p[B + 1] + Z;
  return lerp(
    w,
    lerp(
      v,
      lerp(u, grad3(p[AA], x, y, z), grad3(p[BA], x - 1, y, z)),
      lerp(u, grad3(p[AB], x, y - 1, z), grad3(p[BB], x - 1, y - 1, z)),
    ),
    lerp(
      v,
      lerp(u, grad3(p[AA + 1], x, y, z - 1), grad3(p[BA + 1], x - 1, y, z - 1)),
      lerp(
        u,
        grad3(p[AB + 1], x, y - 1, z - 1),
        grad3(p[BB + 1], x - 1, y - 1, z - 1),
      ),
    ),
  );
}

export function octave(
  noise: (x: number, y: number, z: number) => number,
  octaves: number,
) {
  return function (x: number, y: number, z: number) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let value = 0;
    for (let i = 0; i < octaves; ++i) {
      value += noise(x * frequency, y * frequency, z * frequency) * amplitude;
      total += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value / total;
  };
}

function grad3(i: number, x: number, y: number, z: number): number {
  const h = i & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}
