import type { EleventySuppliedData } from "11ty.ts";
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

interface LinkTag extends Tag {
  templates: Template[];
  variable: string;
  value: Value;
}

/**
 * custom liquid tag
 * wraps contents in internal or external link
 */
export function pageLinkTag(liquidEngine: Liquid) {
  return {
    parse(this: LinkTag, tagToken: TagToken, remainTokens: TopLevelToken[]) {
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
      const page: EleventySuppliedData & { data: any } =
        yield this.value.value(context);
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
}
