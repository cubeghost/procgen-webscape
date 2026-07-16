import type { EleventyScope } from "11ty.ts";
import type { Context, Scope } from "liquidjs";

type EleventyLiquidScope = EleventyScope & {
  context: Context & {
    environments: Scope & {
      collections: Record<string, EleventyScope[]>;
      breadcrumbs: Record<string, string>;
    };
  };
};

export function breadcrumbs(this: EleventyLiquidScope, permalink: string) {
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
}
