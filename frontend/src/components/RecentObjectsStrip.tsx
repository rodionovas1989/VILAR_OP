import type { MouseEvent } from 'react';
import { useRecentObjects, RecentItem } from '../auth/RecentObjectsContext';

type Props = {
  currentPage: string;
  onNavigate: (pageId: string) => void;
};

export default function RecentObjectsStrip({ currentPage, onNavigate }: Props) {
  const { items, activeKey, activate, dismiss } = useRecentObjects();

  if (currentPage === 'home' || items.length === 0) return null;

  const onSelect = (item: RecentItem) => {
    if (item.pageId !== currentPage) onNavigate(item.pageId);
    activate(item);
  };

  const onClose = (e: MouseEvent, item: RecentItem) => {
    e.stopPropagation();
    e.preventDefault();
    const neighbor = dismiss(item.key);
    if (neighbor) {
      if (neighbor.pageId !== currentPage) onNavigate(neighbor.pageId);
      return;
    }
    // active closed with no neighbor: closeRequest handled by page
  };

  return (
    <div className="recent-strip" role="navigation" aria-label="Последние открытые">
      <div className="recent-strip-inner">
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              className={active ? 'recent-chip active' : 'recent-chip'}
              title={`${item.subtitle}: ${item.label}`}
              onClick={() => onSelect(item)}
            >
              <span className="recent-chip-sub">{item.subtitle}</span>
              <span className="recent-chip-label">{item.label}</span>
              <span
                className="recent-chip-close"
                role="button"
                tabIndex={-1}
                aria-label={`Закрыть ${item.label}`}
                onClick={(e) => onClose(e, item)}
              >
                ×
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
