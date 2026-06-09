import type { EleventyScope } from "11ty.ts";
import { stratify, type HierarchyNode } from "d3-hierarchy";
import { Value } from "liquidjs";
import type {
  Liquid,
  Context,
  TagToken,
  TopLevelToken,
  Template,
  Emitter,
  Tag,
} from "liquidjs";

export function directoryTreeFilter(collection: EleventyScope[]) {
  return stratify<EleventyScope>().path((d) => d.page.url || "")(collection);
}

interface TreeTag extends Tag {
  templates: Template[];
  variable: string;
  value: Value;
}

export function treeTag(liquidEngine: Liquid) {
  return {
    parse(this: TreeTag, tagToken: TagToken, remainTokens: TopLevelToken[]) {
      this.templates = [];
      this.variable = tagToken.tokenizer.readIdentifier().content;
      this.value = new Value(tagToken.args, liquidEngine);

      this.liquid.parser
        .parseStream(remainTokens)
        // @ts-expect-error
        .on("template", (template) => this.templates.push(template))
        .on("tag:endtree", function () {
          this.stop();
        })
        .on("end", () => {
          throw new Error(`tag ${tagToken.getText()} not closed`);
        })
        .start();
    },
    *render(this: TreeTag, context: Context, emitter: Emitter) {
      const tree: HierarchyNode<EleventyScope> =
        yield this.value.value(context);
      const liquid = this.liquid;
      const templates = this.templates;

      function* renderNode(node: HierarchyNode<EleventyScope>): Generator<any> {
        emitter.write(`<li>`);

        if (node.data) {
          context.push({ node: node.data });
        } else {
          context.push({
            directory: {
              name: node.id!.split("/").at(-1),
              id: node.id,
            },
          });
        }
        yield liquid.renderer.renderTemplates(templates, context, emitter);
        context.pop();

        if (node.children && node.children.length > 0) {
          yield* renderTree(node.children);
        }

        emitter.write("</li>");
      }

      function* renderTree(
        nodes: HierarchyNode<EleventyScope>[],
      ): Generator<any> {
        emitter.write("<ul>");
        for (const node of nodes) {
          yield* renderNode(node);
        }
        return `<ul>${nodes.map(renderNode)}</ul>`;
      }

      yield renderTree(tree.children!);
    },
  };
}
