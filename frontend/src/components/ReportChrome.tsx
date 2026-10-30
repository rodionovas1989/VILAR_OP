import { ReactNode } from 'react';
import IconButton from './IconButton';
import PageTitle from './PageTitle';

export type ReportVariant = {
  id: string;
  label: string;
};

type Props = {
  pageId: string;
  title: string;
  variants: ReportVariant[];
  variant: string;
  onVariantChange: (id: string) => void;
  /** Быстрые отборы второй строки (даты и прочие поля периода). */
  filters?: ReactNode;
  /** Детальные отборы, разворот дерева, обновление. */
  tools?: ReactNode;
  onExcel?: () => void;
  onPrint?: () => void;
  busy?: boolean;
};

/** Общая шапка отчёта: вариант, быстрые отборы, пиктограммы печати и Excel. */
export default function ReportChrome({
  pageId,
  title,
  variants,
  variant,
  onVariantChange,
  filters,
  tools,
  onExcel,
  onPrint,
  busy = false,
}: Props) {
  return (
    <header className="report-chrome report-no-print">
      <div className="report-chrome-top">
        <div className="report-chrome-title">
          <PageTitle pageId={pageId} title={title} />
          <label className="report-variant">
            <span>Вариант отчета:</span>
            <select
              className="ctrl report-variant-select"
              value={variant}
              disabled={busy}
              onChange={(e) => onVariantChange(e.target.value)}
            >
              {variants.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="report-chrome-export">
          {onExcel && (
            <IconButton icon="excel" label="Выгрузить в Excel" disabled={busy} onClick={onExcel} />
          )}
          {onPrint && <IconButton icon="print" label="Печать" disabled={busy} onClick={onPrint} />}
        </div>
      </div>
      <div className="report-chrome-filters">
        {filters}
        {tools}
      </div>
    </header>
  );
}
