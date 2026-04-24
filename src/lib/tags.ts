export function extractTags(raw: string): { title: string; tags: string[] } {
  const found: string[] = [];
  const cleaned = raw
    .replace(/(^|\s)#([A-Za-zА-Яа-яЁё0-9_-]+)(?=\s|$)/g, (_, lead: string, tag: string) => {
      found.push(tag);
      return lead;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .trim();
  return { title: cleaned, tags: found };
}
