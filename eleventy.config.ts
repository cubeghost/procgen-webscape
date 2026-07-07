import path from "path";
import { defineConfig } from "11ty.ts";
import type { EleventyScope, EleventySuppliedData } from "11ty.ts";
import { hierarchy, type HierarchyNode } from "d3-hierarchy";
// import { InputPathToUrlTransformPlugin } from "@11ty/eleventy";
import type {
  Context,
  Emitter,
  Liquid,
  Tag,
  TagToken,
  Template,
  TopLevelToken,
} from "liquidjs";
import { Value } from "liquidjs";

import Image, { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import pluginRss, {
  dateToRfc3339,
  getNewestCollectionItemDate,
} from "@11ty/eleventy-plugin-rss";
import { consolePlus } from "eleventy-plugin-console-plus";
import esbuild from "esbuild";
import * as importMap from "esbuild-plugin-import-map";

import webscapeDimensions from "./src/lib/webscape/dimensions.mts";
import { treeTag } from "./tree.ts";

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
  eleventyConfig.addPassthroughCopy("src/assets/*.(ttf|woff2)");
  eleventyConfig.addPassthroughCopy("src/assets/*.(png|jpg|gif)");
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
  const playGifButton = (id: string) =>
    `<button class="play-gif requires-js" data-target-id="${id}" aria-pressed="false" onclick="playGifToggle(event)">
      <span class="visually-hidden">play gif</span>
    </button>`;
  eleventyConfig.addShortcode(
    "retina_image",
    async function ({ src, alt, width, style, play_gif = true, ...props }) {
      const source = path.join(eleventyConfig.dir.input, src);
      const sourceName = path.basename(source, path.extname(source));
      const isGif = path.extname(source) === ".gif";
      const widths = width ? [width, width * 2] : ["auto"];
      const metadata = await Image(source, {
        widths,
        ...imageOptions,
      });

      const htmlStyle = [
        width ? `width: ${width}px; height: auto;` : "",
        style ?? "",
      ]
        .join(" ")
        .trim();
      const htmlProps = {
        alt,
        style: htmlStyle,
        sizes: `(min-resolution: 2x) ${width * 2}px, ${width}px`,
        "eleventy:ignore": "",
        ...props,
      };

      if (isGif) {
        const stillMetadata = await Image(source, {
          widths,
          ...imageOptions,
          formats: ["png"],
          sharpOptions: { animated: false },
        });

        const gifId = `gif-${sourceName}`;
        const markup = Image.generateObject(
          { ...metadata, ...stillMetadata },
          { id: gifId, ...htmlProps },
        );
        if ("picture" in markup) {
          markup.picture[CHILDREN_OBJECT_KEY].forEach((child) => {
            if ("source" in child && child.source.type === "image/gif") {
              child.source.media = "(prefers-reduced-motion: no-preference)";
            }
          });
          return (
            pictureObjectToHTML(markup) + (play_gif ? playGifButton(gifId) : "")
          );
        } else {
          throw new Error("no <picture> found in generated object");
        }
      } else {
        return Image.generateHTML(metadata, htmlProps);
      }
    },
  );
  eleventyConfig.addShortcode(
    "play_gif",
    async function (src: string, id?: string) {
      const isGif = path.extname(src) === ".gif";
      if (id) {
        return playGifButton(id);
      } else if (isGif) {
        const sourceName = path.basename(src, path.extname(src));
        return playGifButton(`gif-${sourceName}`);
      } else {
        return "";
      }
    },
  );
  eleventyConfig.addShortcode("image_src", async function (src) {
    const source = path.join(eleventyConfig.dir.input, src);
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
    const postsByUrl = new Map(
      all.map((p) => [p.url || p.filePathStem + "/", p]),
    );
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
    // @ts-expect-error
    function (tree: HierarchyNode<TreeNode>) {
      return tree.descendants().map((node) => {
        const {
          data: { data, ...rest },
        } = node;
        // merge so we can access properties from the tree like use_preview
        return {
          ...rest,
          ...data,
        };
      });
    },
  );
  eleventyConfig.addLiquidTag("tree", treeTag);

  eleventyConfig.addFilter("breadcrumbs", function (permalink: string) {
    const all: EleventyScope[] = this.context.environments.collections.all;
    const breadcrumbUrls = new Map(
      Object.entries(this.context.environments.breadcrumbs),
    );
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
      } else if (breadcrumbUrls.has(path)) {
        return {
          label,
          url: breadcrumbUrls.get(path),
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

  interface LinkTag extends Tag {
    templates: Template[];
    variable: string;
    value: Value;
  }
  eleventyConfig.addLiquidTag(
    "pagelink",
    function pagelinkTag(liquidEngine: Liquid) {
      return {
        parse(
          this: LinkTag,
          tagToken: TagToken,
          remainTokens: TopLevelToken[],
        ) {
          this.templates = [];
          this.variable = tagToken.tokenizer.readIdentifier().content;
          this.value = new Value(tagToken.args, liquidEngine);

          this.liquid.parser
            .parseStream(remainTokens)
            // @ts-expect-error
            .on("template", (template) => this.templates.push(template))
            .on("tag:endpagelink", function () {
              this.stop();
            })
            .on("end", () => {
              throw new Error(`tag ${tagToken.getText()} not closed`);
            })
            .start();
        },
        *render(this: LinkTag, context: Context, emitter: Emitter) {
          const page: EleventySuppliedData = yield this.value.value(context);
          const liquid = this.liquid;
          const templates = this.templates;

          if (page.data.url && page.url === false) {
            emitter.write(
              `<a href="${page.data.url}" target="_blank" class="page-link">`,
            );
          } else {
            emitter.write(`<a href="${page.url}" class="page-link">`);
          }

          yield liquid.renderer.renderTemplates(templates, context, emitter);

          emitter.write("</a>");
        },
      };
    },
  );

  return {
    dir: {
      input: "./src",
      output: "./dist",
    },
  };
});

import { escapeAttribute } from "entities";

const CHILDREN_OBJECT_KEY = "@children";

function mapObjectToHTML(tagName, attrs = {}) {
  let attrHtml = Object.entries(attrs)
    .map((entry) => {
      let [key, value] = entry;
      if (key === CHILDREN_OBJECT_KEY) {
        return false;
      }

      // Issue #82
      if (key === "alt") {
        return `${key}="${value ? escapeAttribute(value) : ""}"`;
      }

      return `${key}="${value}"`;
    })
    .filter((keyPair) => Boolean(keyPair))
    .join(" ");

  return `<${tagName}${attrHtml ? ` ${attrHtml}` : ""}>`;
}

function pictureObjectToHTML(obj) {
  let markup = [];

  for (let tag in obj) {
    markup.push(mapObjectToHTML(tag, obj[tag]));

    // <picture>
    if (Array.isArray(obj[tag]?.[CHILDREN_OBJECT_KEY])) {
      for (let child of obj[tag][CHILDREN_OBJECT_KEY]) {
        let childTagName = Object.keys(child)[0];
        markup.push("  " + mapObjectToHTML(childTagName, child[childTagName]));
      }

      markup.push(`</${tag}>`);
    }
  }
  return markup.join("\n");
}
