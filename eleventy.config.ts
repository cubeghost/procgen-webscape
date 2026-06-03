import { defineConfig } from "11ty.ts";
// import { InputPathToUrlTransformPlugin } from "@11ty/eleventy";

import { stratify } from "d3-hierarchy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { consolePlus } from "eleventy-plugin-console-plus";
import esbuild from "esbuild";
import * as importMap from "esbuild-plugin-import-map";

import webscapeDimensions from "./src/lib/webscape/dimensions.mts";
import { directoryTreeFilter, treeTag } from "./tree.ts";

importMap.load({
  imports: {
    "d3-random": "https://esm.sh/d3-random",
    "d3-array": "https://esm.sh/d3-array",
    "canvas-dither": "https://esm.sh/canvas-dither",
    "gifuct-js": "https://esm.sh/gifuct-js",
  },
});

export default defineConfig((eleventyConfig) => {
  eleventyConfig.addPassthroughCopy("src/styles/*.css");

  // eleventyConfig.addPlugin(InputPathToUrlTransformPlugin);
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    transformOnRequest: process.env.NODE_ENV !== "production",
    sharpOptions: {
      animated: true,
    },
  });

  // eleventyConfig.setFrontMatterParsingOptions({
  //   excerpt: true,
  //   excerpt_separator: "<!-- excerpt -->",
  // });
  eleventyConfig.addPlugin(consolePlus);
  eleventyConfig.setLiquidOptions({
    dynamicPartials: false,
  });

  eleventyConfig.addGlobalData("webscapeDimensions", webscapeDimensions);

  // bundle webscape modules
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
  eleventyConfig.on("eleventy.before", () => {
    return esbuild.build({
      entryPoints: ["src/lib/webscape/replay.mts"],
      outfile: "dist/replay.js",
      bundle: true,
      format: "esm",
      minify: process.env.ELEVENTY_ENV === "production",
      sourcemap: process.env.ELEVENTY_ENV !== "production",
      plugins: [importMap.plugin()],
    });
  });
  eleventyConfig.addWatchTarget("./src/lib/webscape");

  // tree tag and filter
  // @ts-expect-error
  eleventyConfig.addFilter("directoryTree", directoryTreeFilter);
  eleventyConfig.addLiquidTag("tree", treeTag);

  return {
    dir: {
      input: "./src",
      output: "./dist",
    },
  };
});
