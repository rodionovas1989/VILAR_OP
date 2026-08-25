export type ChangelogKind = 'new' | 'change' | 'fix' | 'security';

export type ChangelogItem = {
  kind: ChangelogKind;
  title: string;
  body: string;
};

export type ChangelogSection = {
  dateLabel: string;
  items: ChangelogItem[];
};

const KIND_ALIASES: Record<string, ChangelogKind> = {
  new: 'new',
  added: 'new',
  add: 'new',
  новое: 'new',
  change: 'change',
  changed: 'change',
  изменение: 'change',
  fix: 'fix',
  fixed: 'fix',
  bug: 'fix',
  исправление: 'fix',
  security: 'security',
  безопасность: 'security',
};

const ITEM_RE = /^-\s*\[([^\]]+)\]\s*(?:\*\*(.+?)\*\*\.?\s*)?(.*)$/;

function normalizeKind(raw: string): ChangelogKind {
  const key = raw.trim().toLowerCase();
  return KIND_ALIASES[key] || 'change';
}

/** Разбор docs/CHANGELOG.md: ## дата → список `- [kind] **Заголовок.** Описание`. */
export function parseChangelog(markdown: string): ChangelogSection[] {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const dateLabel = heading[1].trim();
      if (/^changelog$/i.test(dateLabel) || /^что нового$/i.test(dateLabel)) continue;
      current = { dateLabel, items: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const item = ITEM_RE.exec(line.trim());
    if (!item) continue;
    const kind = normalizeKind(item[1]);
    const title = (item[2] || '').trim();
    const body = (item[3] || '').trim();
    if (!title && !body) continue;
    current.items.push({ kind, title, body });
  }

  return sections.filter((s) => s.items.length > 0);
}

export const CHANGELOG_KIND_META: Record<
  ChangelogKind,
  { label: string; className: string }
> = {
  new: { label: 'Новое', className: 'kind-new' },
  change: { label: 'Изменение', className: 'kind-change' },
  fix: { label: 'Исправление', className: 'kind-fix' },
  security: { label: 'Безопасность', className: 'kind-security' },
};
