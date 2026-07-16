import path from "path";
import { defineConfig } from "11ty.ts";

import Image, { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import pluginRss, {
  dateToRfc3339,
  getNewestCollectionItemDate,
} from "@11ty/eleventy-plugin-rss";
import { consolePlus } from "eleventy-plugin-console-plus";
import esbuild from "esbuild";
import * as importMap from "esbuild-plugin-import-map";

import webscapeDimensions from "./src/lib/webscape/dimensions.mts";
import {
  flattenTree,
  treeCollection,
  treeTag,
} from "./src/lib/eleventy/tree.mts";
import { pageLinkTag } from "./src/lib/eleventy/page-link.mts";
import { breadcrumbs } from "./src/lib/eleventy/breadcrumbs.mts";
import { excerpt } from "./src/lib/eleventy/excerpt.mts";
import {
  imageSrcShortcode,
  imageTag,
  playGif,
} from "./src/lib/eleventy/images.mts";

importMap.load({
  imports: {
    "d3-random": "https://esm.sh/d3-random",
    "d3-array": "https://esm.sh/d3-array",
    "canvas-dither": "https://esm.sh/canvas-dither",
    "gifuct-js": "https://esm.sh/gifuct-js",
  },
});

export default defineConfig((eleventyConfig) => {
  const outputDir = "dist";
  eleventyConfig.setOutputDirectory(outputDir);
  eleventyConfig.addExtension("11ty.ts", {
    key: "11ty.js",
  });
  eleventyConfig.addWatchTarget("./src/assets/*.aseprite");

  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addLiquidFilter(
    "getNewestCollectionItemDate",
    getNewestCollectionItemDate,
  );
  eleventyConfig.addLiquidFilter("dateToRfc3339", dateToRfc3339);

  eleventyConfig.addTemplateFormats("11ty.ts");
  eleventyConfig.addPassthroughCopy("src/assets/**/*.(ttf|woff2)");
  eleventyConfig.addPassthroughCopy("src/assets/**/*.(png|jpg|gif)");
  eleventyConfig.addPassthroughCopy("src/**/*.css");
  eleventyConfig.setServerPassthroughCopyBehavior("passthrough");

  eleventyConfig.setLiquidOptions({
    strictVariables: true,
    lenientIf: true,
    dynamicPartials: false,
  });
  eleventyConfig.setLiquidParameterParsing("builtin");

  const imageOptions: Image.PluginOptions = {
    outputDir: `${outputDir}/assets`,
    urlPath: "/assets/",
    formats: ["auto"],
    sharpOptions: {
      animated: true,
      limitInputPixels: false,
    },
    filenameFormat: function (id, src, width, format, options) {
      const extension = path.extname(src);
      const name = path.basename(src, extension);
      return `${name}-${width}.${format}`;
    },
  };
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    ...imageOptions,
    // @ts-expect-error
    transformOnRequest: process.env.NODE_ENV !== "production",
  });
  eleventyConfig.addLiquidTag("image", imageTag(eleventyConfig, imageOptions));
  eleventyConfig.addShortcode("play_gif", playGif);
  eleventyConfig.addShortcode(
    "image_src",
    imageSrcShortcode(eleventyConfig, imageOptions),
  );

  eleventyConfig.addFilter("json_parse", function (string) {
    try {
      return JSON.parse(string);
    } catch (error) {
      console.warn("json_parse error", string);
      return null;
    }
  });
  eleventyConfig.addFilter("find_index_value", function (array, value) {
    return array.indexOf(value);
  });
  eleventyConfig.addFilter("reject_value", function (array, value) {
    return array.filter((v: any) => v !== value);
  });
  eleventyConfig.addFilter(
    "pluralize",
    function (num, singular, plural = null) {
      if (parseInt(num) === 1) {
        return singular;
      } else if (plural === null) {
        return `${singular}s`;
      } else {
        return plural;
      }
    },
  );

  // eleventyConfig.addPlugin(consolePlus);

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
      entryPoints: ["src/lib/webscape/replay.worker.mts"],
      outfile: "dist/replay.worker.js",
      bundle: true,
      format: "esm",
      minify: process.env.ELEVENTY_ENV === "production",
      sourcemap: process.env.ELEVENTY_ENV !== "production",
      plugins: [importMap.plugin()],
    });
  });
  eleventyConfig.addWatchTarget("./src/lib/webscape");

  // tree tag and filter
  eleventyConfig.addCollection("portfolio", treeCollection);
  // @ts-expect-error non-string return value
  eleventyConfig.addFilter("flatten_tree", flattenTree);
  eleventyConfig.addLiquidTag("tree", treeTag);

  // @ts-expect-error non-string return value
  eleventyConfig.addFilter("breadcrumbs", breadcrumbs);

  // @ts-expect-error non-string return value
  eleventyConfig.addShortcode("excerpt", excerpt);

  eleventyConfig.addLiquidTag("pagelink", pageLinkTag);

  return {
    dir: {
      input: "./src",
      output: "./dist",
    },
  };
});
