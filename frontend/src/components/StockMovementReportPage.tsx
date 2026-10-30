import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { Lot, Material, Series, StockMovementReport, StockMovementRow, Warehouse } from '../types';
import { TraceDocumentRef } from '../types.documents';
import { useQtyFormat } from '../qtyFormat/QtyFormatContext';
import AccessDenied from './AccessDenied';
import DocumentPeekModal from './DocumentPeekModal';
import IconButton from './IconButton';
import ListTableHeader from './ListTableHeader';
import ReportChrome from './ReportChrome';
import ReportPeriodFields from './ReportPeriodFields';
import SearchableSelect from './SearchableSelect';

const PAGE_ID = 'report_stock_movements';

type Layout = 'journal' | 'lot';

type Query = {
  from: string;
  to: string;
  materialId: string;
  warehouseId: string;
  seriesId: string;
  lotId: string;
  lotQuery: string;
  documentNumber: string;
};

function yearBounds(d = new Date()) {
  const y = d.getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

function CommitText({
  label,
  value,
  placeholder,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="report-filter-inline">
      <span>{label}</span>
      <input
        className="ctrl report-filter-text"
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          if (e.currentTarget.value !== value) onCommit(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

type Props = {
  materials: Material[];
  lots: Lot[];
  warehouses: Warehouse[];
  series: Series[];
};

export default function StockMovementReportPage({ materials, lots, warehouses, series }: Props) {
  const { user } = useAuth();
  const { formatMaterialQty, formatMaterialQtyDelta } = useQtyFormat();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const initial = yearBounds();
  const [layout, setLayout] = useState<Layout>('journal');
  const [query, setQuery] = useState<Query>({
    from: initial.from,
    to: initial.to,
    materialId: '',
    warehouseId: '',
    seriesId: '',
    lotId: '',
    lotQuery: '',
    documentNumber: '',
  });
  const [report, setReport] = useState<StockMovementReport>({
    needsFilter: false,
    rows: [],
    lot: null,
    lotMatches: [],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [peek, setPeek] = useState<TraceDocumentRef | null>(null);

  const listColumns = useMemo((): ListColumn<StockMovementRow>[] => {
    return [
      { key: 'day', label: 'Дата', getValue: (r) => r.day },
      { key: 'time', label: 'Время', getValue: (r) => r.time },
      { key: 'documentNumber', label: 'Документ', getValue: (r) => r.documentNumber },
      { key: 'documentTypeLabel', label: 'Тип', getValue: (r) => r.documentTypeLabel },
      { key: 'documentStatusLabel', label: 'Статус', getValue: (r) => r.documentStatusLabel },
      { key: 'warehouseName', label: 'Склад', getValue: (r) => r.warehouseName },
      { key: 'materialName', label: 'Материал', getValue: (r) => r.materialName },
      { key: 'lotNumber', label: 'Партия', getValue: (r) => r.lotNumber },
      { key: 'identificationNumber', label: 'Идентификатор', getValue: (r) => r.identificationNumber },
      { key: 'seriesNumber', label: 'Серия', getValue: (r) => r.seriesNumber },
      { key: 'orderLabel', label: 'Заказ', getValue: (r) => r.orderLabel },
      { key: 'kindLabel', label: 'Вид', getValue: (r) => r.kindLabel },
      {
        key: 'quantity',
        label: 'Количество',
        getValue: (r) => formatMaterialQtyDelta(r.quantity, r.materialId),
        getSortValue: (r) => r.quantity,
      },
      {
        key: 'balanceAfter',
        label: 'Остаток после',
        getValue: (r) => formatMaterialQty(r.balanceAfter, r.materialId),
        getSortValue: (r) => r.balanceAfter,
      },
    ];
  }, [formatMaterialQty, formatMaterialQtyDelta]);

  const sourceRows = useMemo(() => {
    if (layout !== 'lot' || !report.lot) return report.rows;
    return report.rows.filter((r) => r.lotId === report.lot?.id);
  }, [layout, report.lot, report.rows]);

  const listTable = useListTable(sourceRows, listColumns, { persistKey: PAGE_ID, userId: user?.id });

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      setReport(await api.stockMovementReport(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when committed query changes
  }, [query]);

  const openDoc = (row: StockMovementRow) => {
    if (!row.documentId || !row.documentType) return;
    setPeek({
      id: row.documentId,
      type: row.documentType,
      number: row.documentNumber,
      status: row.documentStatus,
      date: row.day,
    });
  };

  const exportExcel = async () => {
    setBusy(true);
    setError('');
    try {
      await api.exportStockMovementXlsx({
        ...query,
        ids: listTable.displayRows.map((r) => r.id),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <AccessDenied title="Движения запасов" />;
  }

  const lot = report.lot;

  return (
    <div className="page report-page">
      <ReportChrome
        pageId={PAGE_ID}
        title="Движения запасов"
        variants={[
          { id: 'journal', label: 'Журнал' },
          { id: 'lot', label: 'Партия' },
        ]}
        variant={layout}
        onVariantChange={(id) => setLayout(id as Layout)}
        busy={busy}
        onExcel={() => void exportExcel()}
        onPrint={() => window.print()}
        filters={
          <>
            <ReportPeriodFields
              from={query.from}
              to={query.to}
              disabled={busy}
              onCommit={(from, to) => setQuery((q) => ({ ...q, from, to }))}
            />
            <label className="report-filter-inline">
              <span>Материал</span>
              <SearchableSelect
                className="ctrl-like report-filter-select"
                value={query.materialId}
                emptyLabel="Все"
                options={materials.map((m) => ({ value: m.id, label: m.name }))}
                onChange={(materialId) => setQuery((q) => ({ ...q, materialId }))}
              />
            </label>
            <label className="report-filter-inline">
              <span>Склад</span>
              <SearchableSelect
                className="ctrl-like report-filter-select"
                value={query.warehouseId}
                emptyLabel="Все"
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                onChange={(warehouseId) => setQuery((q) => ({ ...q, warehouseId }))}
              />
            </label>
            <label className="report-filter-inline">
              <span>Серия</span>
              <SearchableSelect
                className="ctrl-like report-filter-select"
                value={query.seriesId}
                emptyLabel="Все"
                options={series.map((s) => ({ value: s.id, label: s.number }))}
                onChange={(seriesId) => setQuery((q) => ({ ...q, seriesId }))}
              />
            </label>
            <CommitText
              label="Партия"
              value={query.lotQuery}
              placeholder="номер или идентификатор"
              disabled={busy}
              onCommit={(lotQuery) => setQuery((q) => ({ ...q, lotQuery, lotId: '' }))}
            />
            <CommitText
              label="Документ"
              value={query.documentNumber}
              placeholder="номер"
              disabled={busy}
              onCommit={(documentNumber) => setQuery((q) => ({ ...q, documentNumber }))}
            />
          </>
        }
        tools={
          <IconButton className="toolbar-icon" icon="refresh" label="Обновить" onClick={() => load()} disabled={busy} />
        }
      />

      {error && <p className="error report-no-print">{error}</p>}
      {report.needsFilter && <p className="hint">Укажите период или хотя бы один отбор — весь журнал сразу не загружается.</p>}

      <h2 className="report-print-title">Движения запасов</h2>

      {layout === 'lot' && !lot && report.lotMatches.length > 0 && (
        <div className="report-lot-matches report-no-print">
          <p className="hint">Найдено несколько партий. Выберите одну.</p>
          <ul>
            {report.lotMatches.map((match) => (
              <li key={match.id}>
                <button type="button" className="link" onClick={() => setQuery((q) => ({ ...q, lotId: match.id }))}>
                  {match.number} · {match.identificationNumber} · {match.materialName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {layout === 'lot' && !lot && !report.lotMatches.length && !report.needsFilter && (
        <p className="hint">Укажите партию (номер или идентификатор) и выйдите из поля или нажмите Enter.</p>
      )}

      {layout === 'lot' && lot && (
        <section className="report-lot-card">
          <h3>
            {lot.materialName} · {lot.number}
          </h3>
          <p className="hint">
            Идентификатор {lot.identificationNumber}. Контрагент {lot.counterpartyName}. Производитель{' '}
            {lot.manufacturerName}. Качество {lot.qualityName}
            {lot.qualityDefaulted ? ' (по умолчанию)' : ''}.
          </p>
          <div className="report-lot-split">
            <div>
              <h4>Остатки по складам</h4>
              {lot.stock.length ? (
                <ul>
                  {lot.stock.map((s) => (
                    <li key={s.warehouseId || s.warehouseName}>
                      {s.warehouseName}: {formatMaterialQty(s.quantity, lot.materialId)} {lot.unit}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Нет строк остатка</p>
              )}
            </div>
            <div>
              <h4>Активный резерв</h4>
              {lot.reservations.length ? (
                <ul>
                  {lot.reservations.map((r) => (
                    <li key={r.id}>
                      {r.warehouseName}: {formatMaterialQty(r.quantity, lot.materialId)} {lot.unit} · {r.documentNumber}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Нет активного резерва</p>
              )}
            </div>
          </div>
          {lot.reservationHistory.length > 0 && (
            <div className="report-reserve-history">
              <h4>История резерва</h4>
              <ul>
                {lot.reservationHistory.map((h) => (
                  <li key={h.id}>
                    {h.day} {h.time} · {h.actionLabel} · {formatMaterialQty(h.quantity, lot.materialId)} · {h.documentNumber}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {(layout === 'journal' || lot) && (
        <div className="table-wrap">
          <table className="data-table report-table">
            <ListTableHeader columns={listColumns} />
            <tbody>
              {listTable.displayRows.map((row) => (
                <tr key={row.id} className={row.documentStatus === 'cancelled' ? 'report-row-cancelled' : undefined}>
                  {listColumns.map((col) => (
                    <td key={col.key}>
                      {col.key === 'documentNumber' && row.documentId ? (
                        <button type="button" className="link" onClick={() => openDoc(row)}>
                          {row.documentNumber}
                        </button>
                      ) : (
                        col.getValue(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {!listTable.displayRows.length && !report.needsFilter && (
                <tr>
                  <td colSpan={listColumns.length} className="muted">
                    Нет движений по выбранным отборам
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DocumentPeekModal
        open={Boolean(peek)}
        mode="view"
        docRef={peek}
        onClose={() => setPeek(null)}
        materials={materials}
        lots={lots}
        warehouses={warehouses}
      />
    </div>
  );
}
