import type { EleventyConfig } from "11ty.ts";
import { hierarchy } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
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

import type { CustomEleventySuppliedData } from "./types";

type PortfolioNode = {
  name: string;
  children?: PortfolioNode[];
  [key: string]: any;
};

type TreeNode = {
  name: string;
  url?: string;
  tag?: string;
  children?: TreeNode[];
  data?: CustomEleventySuppliedData;
};

/**
 * create tree from portfolio data
 */
export const treeCollection = function treeCollection(collectionsApi) {
  const all = collectionsApi.getAll() as CustomEleventySuppliedData[];
  const postsByUrl = new Map(
    all.map((p) => [p.url || p.filePathStem + "/", p]),
  );
  const portfolio = all[0].data.portfolio as PortfolioNode;

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
} satisfies Parameters<EleventyConfig["addCollection"]>[1];

/**
 * filter: flatten tree
 */
export function flattenTree(tree: HierarchyNode<TreeNode>) {
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
}

interface TreeTag extends Tag {
  templates: Template[];
  variable: string;
  value: Value;
}

/**
 * custom liquid tag
 * renders a tree
 */
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
      const tree: HierarchyNode<CustomEleventySuppliedData> =
        yield this.value.value(context);
      const liquid = this.liquid;
      const templates = this.templates;

      function* renderNode(
        node: HierarchyNode<CustomEleventySuppliedData>,
      ): Generator<any> {
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
        nodes: HierarchyNode<CustomEleventySuppliedData>[],
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
