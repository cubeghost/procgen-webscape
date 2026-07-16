import { Hash } from "liquidjs";
import type { Liquid, Context, Emitter, Tag, TagToken } from "liquidjs";

interface ShortcodeHashTag extends Tag {
  args: Hash;
}

/**
 * allows us to define a shortcode using named parameters
 * @example
 * // {% shortcode id: myvar, src: "foo.html" %}
 * eleventyConfig.addLiquidTag("shortcode", shortcodeHash(function({ id, src }) {
 *   return '<img id="${id}" src="${src}" />'
 * }))
 */
export function shortcodeHash<Args extends any>(
  shortcode: (args: Args) => string | Promise<string>,
) {
  return function (liquidEngine: Liquid) {
    return {
      parse(this: ShortcodeHashTag, tagToken: TagToken) {
        this.args = new Hash(tagToken.args);
      },
      *render(this: ShortcodeHashTag, context: Context, emitter: Emitter) {
        const args: Args = yield this.args.render(context);
        // @ts-expect-error
        const result = yield Promise.resolve(shortcode(args));
        emitter.write(result);
      },
    };
  };
}
