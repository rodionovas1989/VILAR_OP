import { useAuth } from '../auth/AuthContext';
import { useFavorites } from '../auth/FavoritesContext';
import { canAccessPage } from '../auth/navAccess';

type Props = {
  pageId: string;
};

export default function FavoriteToggle({ pageId }: Props) {
  const { user } = useAuth();
  const { isFavorite, toggle, loading } = useFavorites();

  if (!user || !canAccessPage(pageId, user.permissions, true)) return null;

  const active = isFavorite(pageId);

  return (
    <button
      type="button"
      className={`icon-square-btn favorite-toggle${active ? ' active' : ''}`}
      title={active ? 'Убрать из избранного' : 'Добавить в избранное на главную'}
      aria-label={active ? 'Убрать из избранного' : 'Добавить в избранное'}
      disabled={loading}
      onClick={() => {
        toggle(pageId).catch(console.error);
      }}
    >
      <span className="icon-square-btn-glyph" aria-hidden>
        {active ? '★' : '☆'}
      </span>
    </button>
  );
}
