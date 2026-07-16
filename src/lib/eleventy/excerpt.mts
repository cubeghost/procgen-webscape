import type { EleventySuppliedData } from "11ty.ts";

// https://keepinguptodate.com/pages/2019/06/creating-blog-with-eleventy/
export function excerpt(
  page: EleventySuppliedData & { templateContent: string },
) {
  if (!page.hasOwnProperty("templateContent")) {
    console.warn(
      'Failed to extract excerpt: Document has no property "templateContent".',
    );
    return null;
  }

  let excerpt = null;
  const content = page.templateContent;

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
}
