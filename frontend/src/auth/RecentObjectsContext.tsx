import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { canAccessPage } from './navAccess';
import { useAuth } from './AuthContext';
import { NAV } from '../constants/navConfig';

export type RecentMode = 'view' | 'edit';

export type RecentItem = {
  key: string;
  pageId: string;
  entityId: string;
  label: string;
  subtitle: string;
  mode: RecentMode;
  openedAt: string;
};

export type RecentPendingOpen = {
  requestId: number;
  pageId: string;
  entityId: string;
  mode: RecentMode;
};

export type RecentCloseRequest = {
  requestId: number;
  pageId: string;
  entityId: string;
};

const MAX_ITEMS = 8;
const STORAGE_PREFIX = 'vilar.recent.';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function recentItemKey(pageId: string, entityId: string) {
  return `${pageId}:${entityId}`;
}

export function navSubtitleForPage(pageId: string): string {
  for (const group of NAV) {
    const item = group.items.find((i) => i.id === pageId);
    if (item) return item.label;
  }
  return pageId;
}

function loadItems(userId: string): RecentItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RecentItem =>
          Boolean(x) &&
          typeof x === 'object' &&
          typeof (x as RecentItem).pageId === 'string' &&
          typeof (x as RecentItem).entityId === 'string' &&
          typeof (x as RecentItem).label === 'string'
      )
      .map((x) => ({
        key: x.key || recentItemKey(x.pageId, x.entityId),
        pageId: x.pageId,
        entityId: x.entityId,
        label: x.label,
        subtitle: x.subtitle || navSubtitleForPage(x.pageId),
        mode: (x.mode === 'view' ? 'view' : 'edit') as RecentMode,
        openedAt: x.openedAt || new Date().toISOString(),
      }))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function saveItems(userId: string, items: RecentItem[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

type RememberInput = {
  pageId: string;
  entityId: string;
  label: string;
  mode: RecentMode;
  subtitle?: string;
};

type RecentObjectsContextValue = {
  items: RecentItem[];
  activeKey: string | null;
  pendingOpen: RecentPendingOpen | null;
  closeRequest: RecentCloseRequest | null;
  remember: (input: RememberInput) => void;
  setMode: (pageId: string, entityId: string, mode: RecentMode) => void;
  clearActive: (pageId: string, entityId: string) => void;
  activate: (item: RecentItem) => void;
  /** Remove from strip; if it was active, returns neighbor to open (or null). */
  dismiss: (key: string) => RecentItem | null;
  drop: (pageId: string, entityId: string) => void;
  consumePending: (pageId: string) => RecentPendingOpen | null;
  consumeCloseRequest: (pageId: string) => RecentCloseRequest | null;
};

const RecentObjectsContext = createContext<RecentObjectsContextValue | null>(null);

export function RecentObjectsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<RecentItem[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState<RecentPendingOpen | null>(null);
  const [closeRequest, setCloseRequest] = useState<RecentCloseRequest | null>(null);
  const reqSeq = useRef(0);
  const itemsRef = useRef(items);
  const activeKeyRef = useRef(activeKey);
  const pendingRef = useRef<RecentPendingOpen | null>(null);
  const closeRef = useRef<RecentCloseRequest | null>(null);
  itemsRef.current = items;
  activeKeyRef.current = activeKey;

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      setActiveKey(null);
      setPendingOpen(null);
      setCloseRequest(null);
      pendingRef.current = null;
      closeRef.current = null;
      return;
    }
    setItems(loadItems(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const filtered = items.filter((i) => canAccessPage(i.pageId, user.permissions, true));
    if (filtered.length !== items.length) {
      setItems(filtered);
      return;
    }
    saveItems(user.id, items);
  }, [items, user]);

  const remember = useCallback(
    (input: RememberInput) => {
      if (!user?.id || !input.entityId) return;
      if (!canAccessPage(input.pageId, user.permissions, true)) return;
      const key = recentItemKey(input.pageId, input.entityId);
      const nextItem: RecentItem = {
        key,
        pageId: input.pageId,
        entityId: input.entityId,
        label: input.label || input.entityId,
        subtitle: input.subtitle || navSubtitleForPage(input.pageId),
        mode: input.mode,
        openedAt: new Date().toISOString(),
      };
      setItems((prev) => {
        const rest = prev.filter((i) => i.key !== key);
        return [nextItem, ...rest].slice(0, MAX_ITEMS);
      });
      setActiveKey(key);
    },
    [user]
  );

  const setMode = useCallback((pageId: string, entityId: string, mode: RecentMode) => {
    const key = recentItemKey(pageId, entityId);
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, mode } : i)));
  }, []);

  const clearActive = useCallback((pageId: string, entityId: string) => {
    const key = recentItemKey(pageId, entityId);
    setActiveKey((cur) => (cur === key ? null : cur));
  }, []);

  const drop = useCallback((pageId: string, entityId: string) => {
    const key = recentItemKey(pageId, entityId);
    setItems((prev) => prev.filter((i) => i.key !== key));
    setActiveKey((cur) => (cur === key ? null : cur));
  }, []);

  const queuePending = useCallback((item: RecentItem) => {
    const requestId = ++reqSeq.current;
    const pending: RecentPendingOpen = {
      requestId,
      pageId: item.pageId,
      entityId: item.entityId,
      mode: item.mode,
    };
    pendingRef.current = pending;
    setPendingOpen(pending);
    setActiveKey(item.key);
  }, []);

  const activate = useCallback(
    (item: RecentItem) => {
      queuePending(item);
      setItems((prev) => {
        const rest = prev.filter((i) => i.key !== item.key);
        return [{ ...item, openedAt: new Date().toISOString() }, ...rest];
      });
    },
    [queuePending]
  );

  const dismiss = useCallback(
    (key: string): RecentItem | null => {
      const prev = itemsRef.current;
      const idx = prev.findIndex((i) => i.key === key);
      if (idx < 0) return null;
      const closed = prev[idx];
      const wasActive = activeKeyRef.current === key;
      const neighbor = wasActive ? prev[idx + 1] || prev[idx - 1] || null : null;
      const without = prev.filter((i) => i.key !== key);

      if (wasActive && neighbor) {
        const rest = without.filter((i) => i.key !== neighbor.key);
        const promoted = { ...neighbor, openedAt: new Date().toISOString() };
        setItems([promoted, ...rest]);
        queuePending(promoted);
        return promoted;
      }

      setItems(without);
      if (wasActive) {
        setActiveKey(null);
        const requestId = ++reqSeq.current;
        const close: RecentCloseRequest = {
          requestId,
          pageId: closed.pageId,
          entityId: closed.entityId,
        };
        closeRef.current = close;
        setCloseRequest(close);
      }
      return null;
    },
    [queuePending]
  );

  const consumePending = useCallback((pageId: string) => {
    const cur = pendingRef.current;
    if (!cur || cur.pageId !== pageId) return null;
    pendingRef.current = null;
    setPendingOpen(null);
    return cur;
  }, []);

  const consumeCloseRequest = useCallback((pageId: string) => {
    const cur = closeRef.current;
    if (!cur || cur.pageId !== pageId) return null;
    closeRef.current = null;
    setCloseRequest(null);
    return cur;
  }, []);

  const visibleItems = useMemo(
    () => items.filter((i) => canAccessPage(i.pageId, user?.permissions, Boolean(user))),
    [items, user]
  );

  const value = useMemo(
    () => ({
      items: visibleItems,
      activeKey,
      pendingOpen,
      closeRequest,
      remember,
      setMode,
      clearActive,
      activate,
      dismiss,
      drop,
      consumePending,
      consumeCloseRequest,
    }),
    [
      visibleItems,
      activeKey,
      pendingOpen,
      closeRequest,
      remember,
      setMode,
      clearActive,
      activate,
      dismiss,
      drop,
      consumePending,
      consumeCloseRequest,
    ]
  );

  return <RecentObjectsContext.Provider value={value}>{children}</RecentObjectsContext.Provider>;
}

export function useRecentObjects() {
  const ctx = useContext(RecentObjectsContext);
  if (!ctx) throw new Error('useRecentObjects вне RecentObjectsProvider');
  return ctx;
}
