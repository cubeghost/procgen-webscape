import { build } from "esbuild";

await build({
  plugins: [
    wasmLoader({
      // (Default) Deferred mode copies the WASM binary to the output directory,
      // and then `fetch()`s it at runtime. This is the default mode.
      mode: "deferred",
    }),
  ],
}).catch(() => process.exit(1));
