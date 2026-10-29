import { useEffect, useMemo, useState, Fragment } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { ReleasedSeriesProductTotal, ReleasedSeriesRow } from '../types';
import AccessDenied from './AccessDenied';
import ReportChrome from './ReportChrome';
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
  const [openProducts, setOpenProducts] = useState<Set<string>>(new Set());

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
      setOpenProducts(new Set(data.byProduct.map((product) => product.productId || product.productName)));
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

  const productKey = (product: ReleasedSeriesProductTotal) => product.productId || product.productName;

  const toggleProduct = (id: string) => {
    setOpenProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const printReport = () => {
    if (layout === 'product') {
      setOpenProducts(new Set(byProduct.map(productKey)));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.print());
      });
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
      <ReportChrome
        pageId={PAGE_ID}
        title="Выпущенные серии продукции"
        variants={[
          { id: 'series', label: 'По сериям' },
          { id: 'product', label: 'Итого по продукту' },
        ]}
        variant={layout}
        onVariantChange={(id) => setLayout(id as Layout)}
        busy={busy}
        onExcel={() => void exportExcel()}
        onPrint={printReport}
        filters={
          <>
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
          </>
        }
        tools={
          <>
            {layout === 'series' && (
              <ListViewSettingsButton
                open={listSettingsOpen}
                onOpenChange={setListSettingsOpen}
                activeFilterCount={listTable.activeFilterCount}
                sortRulesCount={listTable.sortRules.length}
              />
            )}
            {layout === 'product' && (
              <>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => setOpenProducts(new Set(byProduct.map(productKey)))}
                >
                  Развернуть всё
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => setOpenProducts(new Set())}
                >
                  Свернуть всё
                </button>
              </>
            )}
            <RefreshButton onClick={() => load()} disabled={busy} />
          </>
        }
      />
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

      {error && <p className="error report-no-print">{error}</p>}

      <h2 className="report-print-title">
        Выпущенные серии продукции — {periodLabel}
        {layout === 'product' ? ' — итог по продукту' : ''}
      </h2>

      {layout === 'product' ? (
        <div className="report-scroll">
          {byProduct.map((product) => {
            const id = productKey(product);
            const open = openProducts.has(id);
            return (
            <section key={id} className="report-product-block">
              <button
                type="button"
                className="report-product-head"
                aria-expanded={open}
                onClick={() => toggleProduct(id)}
              >
                <span className="report-expand-chevron" aria-hidden>
                  {open ? '▾' : '▸'}
                </span>
                <span className="report-product-name">{product.productName}</span>
                <span className="report-product-meta">
                  серий: {product.series.length}
                  {product.components.length ? ` · партий сырья: ${product.components.length}` : ''}
                </span>
              </button>
              {open && (
              <div className="report-product-body">
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
              </div>
              )}
            </section>
            );
          })}
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
