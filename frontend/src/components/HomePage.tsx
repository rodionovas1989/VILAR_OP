import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useFavorites } from '../auth/FavoritesContext';
import { canAccessPage } from '../auth/navAccess';
import { catalogItem, KIND_SECTION_LABELS, NavKind } from '../constants/navConfig';

type Props = {
  onNavigate: (pageId: string) => void;
};

type CardItem = {
  pageId: string;
  label: string;
  kind: NavKind;
};

export default function HomePage({ onNavigate }: Props) {
  const { user, openLogin } = useAuth();
  const { items, loading } = useFavorites();

  const cards = useMemo(() => {
    if (!user) return [];
    const out: CardItem[] = [];
    for (const fav of items) {
      const meta = catalogItem(fav.pageId);
      if (!meta) continue;
      if (!canAccessPage(fav.pageId, user.permissions, true)) continue;
      out.push({
        pageId: fav.pageId,
        label: meta.label,
        kind: meta.kind,
      });
    }
    return out;
  }, [items, user]);

  const grouped = useMemo(() => {
    const map = new Map<NavKind, CardItem[]>();
    for (const card of cards) {
      const list = map.get(card.kind) || [];
      list.push(card);
      map.set(card.kind, list);
    }
    const order: NavKind[] = ['desktop', 'planning', 'document', 'dictionary', 'register', 'quality', 'admin'];
    return order.filter((k) => map.has(k)).map((k) => [k, map.get(k)!] as const);
  }, [cards]);

  const hiddenCount = items.length - cards.length;

  if (!user) {
    return (
      <div className="page home-page">
        <h1>Главная</h1>
        <p className="hint">
          Персональные избранные разделы.{' '}
          <button type="button" className="link-btn" onClick={openLogin}>
            Войдите
          </button>
          , чтобы настроить главную страницу.
        </p>
      </div>
    );
  }

  return (
    <div className="page home-page">
      <h1>Главная</h1>
      <p className="hint">
        Избранные разделы по типам объектов. Нажмите ☆ рядом с заголовком любой страницы, чтобы добавить
        плашку сюда.
      </p>

      {loading && <p className="hint">Загрузка…</p>}

      {!loading && hiddenCount > 0 && (
        <p className="hint">
          {hiddenCount} {hiddenCount === 1 ? 'раздел скрыт' : 'разделов скрыто'} — нет прав доступа по вашей
          роли.
        </p>
      )}

      {!loading && items.length === 0 && (
        <div className="home-empty">
          <p>Пока нет избранного.</p>
          <p className="hint">Откройте раздел в меню слева и нажмите ☆ в заголовке страницы.</p>
        </div>
      )}

      {!loading && grouped.length > 0 && (
        <div className="home-board">
          {grouped.map(([kind, list]) => (
            <div key={kind} className="home-board-col">
              <div className="home-board-col-title">{KIND_SECTION_LABELS[kind]}</div>
              <div className="home-board-col-cards">
                {list.map((card) => (
                  <button
                    key={card.pageId}
                    type="button"
                    className="home-card"
                    onClick={() => onNavigate(card.pageId)}
                  >
                    <span className="home-card-label">{card.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
