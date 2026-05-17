import pluginWebc from "@11ty/eleventy-plugin-webc";
import esbuild from "esbuild";
import * as importMap from "esbuild-plugin-import-map";

importMap.load({
  imports: {
    "d3-random": "https://esm.sh/d3-random",
    "d3-array": "https://esm.sh/d3-array",
    "canvas-dither": "https://esm.sh/canvas-dither",
  },
});

export default function (eleventyConfig) {
  // eleventyConfig.addPlugin(pluginWebc);
  eleventyConfig.on("eleventy.before", () => {
    return esbuild.build({
      entryPoints: ["src/lib/webscape/generate.mts"],
      outfile: "dist/webscape.js",
      bundle: true,
      format: "esm",
      minify: process.env.ELEVENTY_ENV === "production",
      sourcemap: process.env.ELEVENTY_ENV !== "production",
      plugins: [importMap.plugin()],
    });
  });
  eleventyConfig.addWatchTarget("./src/lib/webscape");

  eleventyConfig.addPassthroughCopy("src/styles/*.css");
  // eleventyConfig.addPassthroughCopy("src/lib/webscape/*.mts");

  return {
    dir: {
      input: "src",
      output: "dist",
    },
  };
}
