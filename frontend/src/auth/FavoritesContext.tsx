import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { canAccessPage } from './navAccess';
import { useAuth } from './AuthContext';

export type FavoriteItem = { pageId: string; addedAt: string };

type FavoritesContextValue = {
  items: FavoriteItem[];
  loading: boolean;
  isFavorite: (pageId: string) => boolean;
  toggle: (pageId: string) => Promise<void>;
  reload: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getFavorites();
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);

  const toggle = useCallback(
    async (pageId: string) => {
      if (!user) return;
      if (!canAccessPage(pageId, user.permissions, true)) {
        throw new Error('Нет прав на просмотр этого раздела');
      }
      const res = await api.toggleFavorite(pageId);
      setItems(res.items);
    },
    [user]
  );

  const isFavorite = useCallback(
    (pageId: string) =>
      canAccessPage(pageId, user?.permissions, Boolean(user)) &&
      items.some((i) => i.pageId === pageId),
    [items, user]
  );

  const value = useMemo(
    () => ({ items, loading, isFavorite, toggle, reload }),
    [items, loading, isFavorite, toggle, reload]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites вне FavoritesProvider');
  return ctx;
}
