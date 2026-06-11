import path from "path";
import { defineConfig } from "11ty.ts";
import type { EleventyScope } from "11ty.ts";
// import { InputPathToUrlTransformPlugin } from "@11ty/eleventy";
import type { Tag } from "liquidjs";

import Image, { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
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
  const outputDir = "dist";
  eleventyConfig.setOutputDirectory(outputDir);
  eleventyConfig.addPassthroughCopy("src/assets/*.(ttf|woff2)");
  eleventyConfig.addPassthroughCopy("src/**/*.css");
  eleventyConfig.setServerPassthroughCopyBehavior("passthrough");

  const imageOptions: Image.PluginOptions = {
    outputDir: `${outputDir}/assets`,
    urlPath: "/assets/",
    formats: ["auto"],
    sharpOptions: {
      animated: true,
    },
    filenameFormat: function (id, src, width, format, options) {
      const extension = path.extname(src);
      const name = path.basename(src, extension);

      return `${name}-${width}.${format}`;
    },
  };
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    ...imageOptions,
    transformOnRequest: process.env.NODE_ENV !== "production",
  });
  eleventyConfig.setLiquidParameterParsing("builtin");
  eleventyConfig.addShortcode(
    "retina_image",
    async function ({ src, alt, width, style, ...props }) {
      const source = path.join(this.eleventy.directories.input, src);
      const metadata = await Image(source, {
        widths: [width, width * 2],
        ...imageOptions,
      });

      return Image.generateHTML(metadata, {
        alt,
        style: `width: ${width}px; height: auto; ${style ?? ""}`,
        sizes: `(min-resolution: 2x) ${width * 2}px, ${width}px`,
        "eleventy:ignore": "",
        ...props,
      });
    },
  );
  eleventyConfig.addShortcode("image_src", async function (src) {
    const source = path.join(this.eleventy.directories.input, src);
    const metadata = await Image(source, imageOptions);

    const formats = Object.keys(metadata) as Image.ImageFormat[]; // TODO
    if (formats.length > 1) {
      console.warn("found multiple formats", metadata);
    }

    const files = metadata[formats[0]];
    if (!files) throw new Error("no output");
    return files[0].url;
  });
  eleventyConfig.addFilter("json_parse", function (string) {
    try {
      return JSON.parse(string);
    } catch (error) {
      return null;
    }
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
  eleventyConfig.addFilter("directory_tree", directoryTreeFilter);
  eleventyConfig.addLiquidTag("tree", treeTag);

  eleventyConfig.addFilter("breadcrumbs", function (permalink: string) {
    const all: EleventyScope[] = this.context.environments.collections.all;
    const parts: string[] = permalink.split("/").filter(Boolean);
    const paths = parts.reduce((acc, value) => {
      const prev = acc[acc.length - 1] ?? "/";
      acc.push(`${prev}${value}/`);
      return acc;
    }, [] as string[]);
    const urls = new Set(all.map((v) => v.page.url));
    return paths.map((path) => {
      const label = path.split("/").filter(Boolean).at(-1);
      if (urls.has(path)) {
        return {
          label,
          url: path,
        };
      } else {
        return {
          label,
        };
      }
    });
  });

  return {
    dir: {
      input: "./src",
      output: "./dist",
    },
  };
});
