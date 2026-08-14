import { ReactNode, useState } from 'react';

type Props = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export default function CollapsibleSection({ title, defaultOpen = true, children, className = '' }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`collapsible-section ${open ? 'is-open' : 'is-collapsed'} ${className}`.trim()}>
      <button type="button" className="collapsible-section-head" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className="collapsible-section-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <div className="collapsible-section-body">{children}</div>}
    </section>
  );
}
