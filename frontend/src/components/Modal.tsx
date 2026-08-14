import { ReactNode, useState } from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
  headerExtra?: ReactNode;
  nested?: boolean;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
  className = '',
  headerExtra,
  nested,
}: Props) {
  if (!open) return null;
  return (
    <div className={`modal-backdrop${nested ? ' modal-backdrop-nested' : ''}`}>
      <div
        className={`modal ${wide ? 'modal-wide' : ''} ${className}`.trim()}
        role="dialog"
        aria-modal
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <div className="modal-header-actions">
            {headerExtra}
            <button type="button" className="icon-square-btn modal-close-btn" onClick={onClose} aria-label="Закрыть">
              <span className="icon-square-btn-glyph" aria-hidden>
                ×
              </span>
            </button>
          </div>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

export function useModal() {
  const [open, setOpen] = useState(false);
  return { open, openModal: () => setOpen(true), closeModal: () => setOpen(false), setOpen };
}
