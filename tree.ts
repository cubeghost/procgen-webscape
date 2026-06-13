import type { EleventyScope } from "11ty.ts";
import { sort } from "d3-array";
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

export function directoryTreeFilter(
  this: EleventyScope,
  collection: EleventyScope[],
) {
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
        emitter.write(`<span class="tree-marker"></span>`);
        const { children, ...rest } = node;

        if (rest.data.data) {
          context.push({ node: { ...rest.data, ...rest.data.data } });
        } else {
          context.push({
            directory: rest.data,
          });
        }
        yield liquid.renderer.renderTemplates(templates, context, emitter);
        context.pop();

        if (children && children.length > 0) {
          yield* renderTree(children);
        }

        emitter.write("</li>\n");
      }

      function* renderTree(
        nodes: HierarchyNode<EleventyScope>[],
      ): Generator<any> {
        emitter.write("<ul>");
        // const sorted = sort(
        //   nodes,
        //   (d) => {
        //     if (d.data) {
        //       return d.data.data.portfolio?.sort ?? Infinity;
        //     } else {
        //       return directories[d.id]?.sort ?? Infinity;
        //     }
        //   },
        //   (d) => d.id,
        // );
        for (const node of nodes) {
          yield* renderNode(node);
        }
        return `<ul>${nodes.map(renderNode)}</ul>`;
      }

      yield renderTree(tree.children!);
    },
  };
}
