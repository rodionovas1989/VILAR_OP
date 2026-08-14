export type GuideCalloutTone = 'info' | 'warn';

export type GuideBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; tone: GuideCalloutTone; text: string }
  | { type: 'flow'; items: string[] };

export type GuideSection = {
  id: string;
  title: string;
  blocks: GuideBlock[];
};

export type GuideFaq = {
  id: string;
  q: string;
  blocks: GuideBlock[];
};

export function blocksToSearchText(blocks: GuideBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'p' || b.type === 'callout') return b.text;
      if (b.type === 'ul' || b.type === 'ol' || b.type === 'flow') return b.items.join(' ');
      if (b.type === 'table') return [...b.headers, ...b.rows.flat()].join(' ');
      return '';
    })
    .join(' ');
}
