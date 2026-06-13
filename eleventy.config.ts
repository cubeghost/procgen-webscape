import path from "path";
import { defineConfig } from "11ty.ts";
import type { EleventyScope, EleventySuppliedData } from "11ty.ts";
import { hierarchy, type HierarchyNode } from "d3-hierarchy";
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
  eleventyConfig.addPassthroughCopy("src/assets/icons.png");
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
  type TreeNode = {
    name: string;
    url?: string;
    tag?: string;
    children?: TreeNode[];
    data?: EleventySuppliedData;
  };
  eleventyConfig.addCollection("portfolio", function (collectionsApi) {
    const all = collectionsApi.getAll();
    const postsByUrl = new Map(all.map((p) => [p.url, p]));
    const portfolio = all[0].data.portfolio;
    function addNodeContent(node: TreeNode): TreeNode {
      const children = node.children?.map(addNodeContent);
      if (node.url && postsByUrl.has(node.url)) {
        return { ...node, children, data: postsByUrl.get(node.url)! };
      } else if (node.tag) {
        const url = `/tags/${node.tag}/`;
        return { ...node, children, url };
      } else {
        return { ...node, children };
      }
    }
    return hierarchy(addNodeContent(portfolio));
  });
  eleventyConfig.addFilter(
    "flatten_tree",
    function (tree: HierarchyNode<TreeNode>) {
      return tree.descendants().map((node) => node.data.data);
    },
  );
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

  // https://keepinguptodate.com/pages/2019/06/creating-blog-with-eleventy/
  eleventyConfig.addShortcode("excerpt", function (article) {
    if (!article.hasOwnProperty("templateContent")) {
      console.warn(
        'Failed to extract excerpt: Document has no property "templateContent".',
      );
      return null;
    }

    let excerpt = null;
    const content = article.templateContent;

    const separatorsList = [
      { start: "<!-- excerpt -->", end: "<!-- endexcerpt -->" },
      { start: "<p>", end: "</p>" },
    ];

    separatorsList.some((separators) => {
      const startPosition = content.indexOf(separators.start);
      const endPosition = content.indexOf(separators.end);

      if (startPosition !== -1 && endPosition !== -1) {
        excerpt = content
          .substring(startPosition + separators.start.length, endPosition)
          .trim();
        return true;
      }
    });

    return excerpt;
  });

  return {
    dir: {
      input: "./src",
      output: "./dist",
    },
  };
});
