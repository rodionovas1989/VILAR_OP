import { useEffect, useRef } from 'react';
import { RecentMode, useRecentObjects } from '../auth/RecentObjectsContext';

type Options = {
  pageId: string;
  /** Current open entity id (saved records only). */
  entityId: string | null;
  formMode: 'create' | 'edit' | 'view';
  /** Open entity from strip / dismiss neighbor. */
  openEntity: (entityId: string, mode: RecentMode) => void | Promise<void>;
  closeModal: () => void;
};

/**
 * Bridges list/modal pages with the recent-objects strip:
 * pending open, close-from-strip, and mode sync while a card is open.
 */
export function useRecentEntityBridge({
  pageId,
  entityId,
  formMode,
  openEntity,
  closeModal,
}: Options) {
  const {
    pendingOpen,
    closeRequest,
    consumePending,
    consumeCloseRequest,
    setMode,
    clearActive,
  } = useRecentObjects();

  const openEntityRef = useRef(openEntity);
  const closeModalRef = useRef(closeModal);
  openEntityRef.current = openEntity;
  closeModalRef.current = closeModal;

  const prevEntityRef = useRef<string | null>(null);

  useEffect(() => {
    if (formMode === 'create' || !entityId) {
      if (prevEntityRef.current) {
        clearActive(pageId, prevEntityRef.current);
        prevEntityRef.current = null;
      }
      return;
    }
    prevEntityRef.current = entityId;
    if (formMode === 'view' || formMode === 'edit') {
      setMode(pageId, entityId, formMode);
    }
  }, [pageId, entityId, formMode, setMode, clearActive]);

  useEffect(() => {
    if (!pendingOpen || pendingOpen.pageId !== pageId) return;
    const pending = consumePending(pageId);
    if (!pending) return;
    void openEntityRef.current(pending.entityId, pending.mode);
  }, [pendingOpen, pageId, consumePending]);

  useEffect(() => {
    if (!closeRequest || closeRequest.pageId !== pageId) return;
    const req = consumeCloseRequest(pageId);
    if (!req) return;
    if (entityId && entityId === req.entityId) {
      closeModalRef.current();
    }
  }, [closeRequest, pageId, entityId, consumeCloseRequest]);
}
