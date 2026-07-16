import path from "path";
import { escapeAttribute } from "entities";
import Image from "@11ty/eleventy-img";
import type { EleventyConfig } from "11ty.ts";

import { shortcodeHash } from "./liquid.mts";
import type {
  ImgAttributes,
  SourceAttributes,
} from "@11ty/eleventy-img/generate-html";

const CHILDREN_OBJECT_KEY = "@children";

const playGifButton = (id: string) =>
  `<button class="play-gif requires-js" data-target-id="${id}" aria-pressed="false" onclick="playGifToggle(event)">
      <span class="visually-hidden">play gif</span>
    </button>`;

interface RetinaImageProps {
  src: string;
  alt: string;
  width?: number;
  style?: string;
  play_gif?: boolean;
}

/**
 * retina image tag
 */
export const imageTag = (
  eleventyConfig: EleventyConfig,
  imageOptions: Image.PluginOptions,
) =>
  shortcodeHash(async function ({
    src,
    alt,
    width,
    style,
    play_gif = true,
    ...props
  }: RetinaImageProps) {
    const source = path.join(eleventyConfig.dir.input, src);
    const sourceName = path.basename(source, path.extname(source));
    const isGif = path.extname(source) === ".gif";
    const widths = width ? [width, width * 2] : ["auto" as const];
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
      sizes: width
        ? `(min-resolution: 2x) ${width * 2}px, ${width}px`
        : undefined,
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
      ) as unknown as PictureAttributes;
      if ("picture" in markup) {
        markup.picture[CHILDREN_OBJECT_KEY].forEach((child) => {
          if ("source" in child && child.source.type === "image/gif") {
            // @ts-expect-error
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
  });

/**
 * standalone play gif button
 */
export async function playGif(src: string, id?: string) {
  const isGif = path.extname(src) === ".gif";
  if (id) {
    return playGifButton(id);
  } else if (isGif) {
    const sourceName = path.basename(src, path.extname(src));
    return playGifButton(`gif-${sourceName}`);
  } else {
    return "";
  }
}

/**
 * image src only (no retina)
 */
export const imageSrcShortcode = (
  eleventyConfig: EleventyConfig,
  imageOptions: Image.PluginOptions,
) =>
  async function (src: string) {
    const source = path.join(eleventyConfig.dir.input, src);
    const metadata = await Image(source, imageOptions);

    const formats = Object.keys(metadata) as Image.ImageFormat[]; // TODO
    if (formats.length > 1) {
      console.warn("found multiple formats", metadata);
    }

    const files = metadata[formats[0]];
    if (!files) throw new Error("no output");
    return files[0].url;
  };

// html generation helpers from https://github.com/11ty/image/blob/main/src/generate-html.js

interface AddedAttributes {
  alt: string;
  style: string;
  sizes?: string;
  "eleventy:ignore": string;
}

interface PictureAttributes {
  picture: {
    [CHILDREN_OBJECT_KEY]: (
      | SourceAttributes
      | ImgAttributes<AddedAttributes>
    )[];
  };
}

function mapObjectToHTML(
  tagName: string,
  attrs:
    | PictureAttributes["picture"]
    | SourceAttributes
    | ImgAttributes<AddedAttributes>,
) {
  let attrHtml = Object.entries(attrs)
    .map((entry) => {
      let [key, value] = entry;
      if (key === CHILDREN_OBJECT_KEY) {
        return false;
      }

      if (key === "alt") {
        return `${key}="${value ? escapeAttribute(value) : ""}"`;
      }

      return `${key}="${value}"`;
    })
    .filter((keyPair) => Boolean(keyPair))
    .join(" ");

  return `<${tagName}${attrHtml ? ` ${attrHtml}` : ""}>`;
}

function pictureObjectToHTML(obj: PictureAttributes) {
  let markup: string[] = [];

  for (let tag of typedObjectKeys(obj)) {
    markup.push(mapObjectToHTML(tag, obj[tag]));

    // <picture>
    if (Array.isArray(obj[tag]?.[CHILDREN_OBJECT_KEY])) {
      for (let child of obj[tag][CHILDREN_OBJECT_KEY]) {
        let childTagName = typedObjectKeys(child)[0];
        markup.push(
          "  " +
            mapObjectToHTML(
              childTagName,
              child[childTagName as keyof typeof child],
            ),
        );
      }

      markup.push(`</${tag}>`);
    }
  }

  return markup.join("\n");
}

type KeysOf<T> = T extends T ? keyof T : never;

function typedObjectKeys<T extends object>(obj: T): Array<KeysOf<T>> {
  return Object.keys(obj) as Array<KeysOf<T>>;
}
