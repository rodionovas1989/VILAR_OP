import { useEffect, useMemo, useState, Fragment } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { ReleasedSeriesProductTotal, ReleasedSeriesRow } from '../types';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import ListTableHeader from './ListTableHeader';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';
import { useQtyFormat } from '../qtyFormat/QtyFormatContext';

const PAGE_ID = 'report_released_series';

type Layout = 'series' | 'product';

function yearBounds(year = new Date().getFullYear()) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export default function ReleasedSeriesReportPage() {
  const { user } = useAuth();
  const { formatMaterialQty } = useQtyFormat();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const initial = yearBounds();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [layout, setLayout] = useState<Layout>('series');
  const [rows, setRows] = useState<ReleasedSeriesRow[]>([]);
  const [byProduct, setByProduct] = useState<ReleasedSeriesProductTotal[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const listColumns = useMemo((): ListColumn<ReleasedSeriesRow>[] => {
    return [
      { key: 'productName', label: 'Название', getValue: (r) => r.productName },
      { key: 'seriesNumber', label: 'Серия', getValue: (r) => r.seriesNumber },
      { key: 'lotNumber', label: 'Партия', getValue: (r) => r.lotNumber },
      { key: 'productionDate', label: 'Дата производства', getValue: (r) => r.productionDate },
      {
        key: 'quantity',
        label: 'Количество',
        getValue: (r) => formatMaterialQty(r.quantity, r.productId),
      },
    ];
  }, [formatMaterialQty]);

  const listTable = useListTable(rows, listColumns, {
    persistKey: PAGE_ID,
    userId: user?.id,
  });

  const load = async (range = { from, to }) => {
    setBusy(true);
    setError('');
    try {
      if (!range.from || !range.to) throw new Error('Укажите даты начала и окончания периода');
      if (range.from > range.to) throw new Error('Дата окончания раньше даты начала');
      const data = await api.releasedSeriesReport(range);
      setRows(data.rows);
      setByProduct(data.byProduct);
      setExpanded(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportExcel = async () => {
    setBusy(true);
    setError('');
    try {
      const source = layout === 'series' ? listTable.displayRows : rows;
      await api.exportReleasedSeriesXlsx({
        ids: source.map((r) => r.id),
        from,
        to,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const printReport = () => {
    if (layout === 'product') {
      window.print();
      return;
    }
    setExpanded(new Set(listTable.displayRows.map((r) => r.id)));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  };

  if (!canView) {
    return <AccessDenied title="Выпущенные серии продукции" />;
  }

  const periodLabel = `${from || '…'} — ${to || '…'}`;

  return (
    <div className="page report-page">
      <div className="page-toolbar report-no-print">
        <PageTitle pageId={PAGE_ID} title="Выпущенные серии продукции" />
        <div className="toolbar-actions report-filter-bar">
          <label className="report-filter-inline">
            <span>с</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={busy} />
          </label>
          <label className="report-filter-inline">
            <span>по</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy} />
          </label>
          <button type="button" onClick={() => void load()} disabled={busy}>
            Применить
          </button>
          <button
            type="button"
            className={layout === 'series' ? undefined : 'ghost'}
            onClick={() => setLayout('series')}
            disabled={busy}
          >
            По сериям
          </button>
          <button
            type="button"
            className={layout === 'product' ? undefined : 'ghost'}
            onClick={() => setLayout('product')}
            disabled={busy}
          >
            Итого по продукту
          </button>
          {layout === 'series' && (
            <ListViewSettingsButton
              open={listSettingsOpen}
              onOpenChange={setListSettingsOpen}
              activeFilterCount={listTable.activeFilterCount}
              sortRulesCount={listTable.sortRules.length}
            />
          )}
          <button type="button" className="ghost" onClick={exportExcel} disabled={busy}>
            Excel
          </button>
          <button type="button" className="ghost" onClick={printReport} disabled={busy}>
            Печать
          </button>
          <RefreshButton onClick={() => load()} disabled={busy} />
        </div>
      </div>
      {layout === 'series' && listSettingsOpen && (
        <div className="report-no-print">
          <ListViewSettingsPanel
            open={listSettingsOpen}
            onClose={() => setListSettingsOpen(false)}
            columns={listColumns}
            filterOptions={listTable.filterOptions}
            filters={listTable.filters}
            sortRules={listTable.sortRules}
            onApply={listTable.applySettings}
            onReset={listTable.resetSettings}
            activeFilterCount={listTable.activeFilterCount}
          />
        </div>
      )}

      <p className="hint report-no-print">
        Завершённые заказы за период. «По сериям» — выпуск и состав каждой серии. «Итого по продукту» —
        какие серии вышли и сколько сырья по каждой партии ушло на все эти серии вместе. Excel — листы
        «Серии», «Компоненты», «Поставщики сырья» и «Итого по продукту».
      </p>

      {error && <p className="error report-no-print">{error}</p>}

      <h2 className="report-print-title">
        Выпущенные серии продукции — {periodLabel}
        {layout === 'product' ? ' — итог по продукту' : ''}
      </h2>

      {layout === 'product' ? (
        <div>
          {byProduct.map((product) => (
            <section key={product.productId || product.productName} className="report-product-block">
              <h3>{product.productName}</h3>
              <div className="table-wrap">
                <table className="data-table report-table">
                  <thead>
                    <tr>
                      <th>Серия</th>
                      <th>Партия ГП</th>
                      <th>Дата производства</th>
                      <th>Количество</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.series.map((series) => (
                      <tr key={series.orderId || series.seriesId}>
                        <td>{series.seriesNumber}</td>
                        <td>{series.lotNumber}</td>
                        <td>{series.productionDate}</td>
                        <td>{formatMaterialQty(series.quantity, product.productId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-wrap">
                <table className="data-table report-nested-table">
                  <thead>
                    <tr>
                      <th>Компонент</th>
                      <th>Партия</th>
                      <th>Контрагент</th>
                      <th>Производитель</th>
                      <th>Количество</th>
                      <th>Ед.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.components.length ? (
                      product.components.map((c) => (
                        <tr key={`${c.materialId}-${c.lotId || c.lotNumber}`}>
                          <td>{c.materialName}</td>
                          <td>{c.lotNumber}</td>
                          <td>{c.counterpartyName || '—'}</td>
                          <td>{c.manufacturerName || '—'}</td>
                          <td>{formatMaterialQty(c.quantity, c.materialId)}</td>
                          <td>{c.unit || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="muted">
                          Нет фактических строк состава
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          {!byProduct.length && <p className="muted">Нет выпущенных серий за выбранный период</p>}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table report-table">
            <ListTableHeader columns={listColumns} extraHead={<th className="report-no-print" />} />
            <tbody>
              {listTable.displayRows.map((row) => {
                const open = expanded.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={open ? 'report-row is-open' : 'report-row'}
                      onClick={() => toggleRow(row.id)}
                    >
                      {listColumns.map((col) => (
                        <td key={col.key}>{col.getValue(row)}</td>
                      ))}
                      <td className="report-no-print">
                        <span className="report-expand-chevron" aria-hidden>
                          {open ? '▾' : '▸'}
                        </span>
                      </td>
                    </tr>
                    {open && (
                      <tr className="report-detail-row">
                        <td colSpan={listColumns.length + 1}>
                          {row.components?.length ? (
                            <table className="report-nested-table">
                              <thead>
                                <tr>
                                  <th>Компонент</th>
                                  <th>Партия</th>
                                  <th>Контрагент</th>
                                  <th>Производитель</th>
                                  <th>Количество</th>
                                  <th>Ед.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.components.map((c, i) => (
                                  <tr key={`${row.id}-c-${i}`}>
                                    <td>{c.materialName}</td>
                                    <td>{c.lotNumber}</td>
                                    <td>{c.counterpartyName || '—'}</td>
                                    <td>{c.manufacturerName || '—'}</td>
                                    <td>{formatMaterialQty(c.quantity, c.materialId)}</td>
                                    <td>{c.unit || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="hint" style={{ margin: 0 }}>
                              Нет фактических строк состава
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!listTable.displayRows.length && (
                <tr>
                  <td colSpan={listColumns.length + 1} className="muted">
                    Нет выпущенных серий за выбранный период
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
