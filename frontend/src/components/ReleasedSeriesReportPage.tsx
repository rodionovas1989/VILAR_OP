import { useEffect, useMemo, useState, Fragment } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { ReleasedSeriesProductTotal, ReleasedSeriesRow } from '../types';
import AccessDenied from './AccessDenied';
import ReportChrome from './ReportChrome';
import ReportPeriodFields from './ReportPeriodFields';
import IconButton from './IconButton';
import ListTableHeader from './ListTableHeader';
import { ListViewSettings } from './ListViewSettings';
import { useQtyFormat } from '../qtyFormat/QtyFormatContext';
import {
  componentKey,
  componentsOfSeries,
  ReportLink,
  seriesUsingComponent,
} from '../utils/releasedSeriesLink';

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openProducts, setOpenProducts] = useState<Set<string>>(new Set());
  const [linkByProduct, setLinkByProduct] = useState<Record<string, ReportLink | null>>({});

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
      setLinkByProduct({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the committed period changes
  }, [from, to]);

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

  const toggleLink = (productId: string, next: ReportLink) => {
    setLinkByProduct((prev) => {
      const current = prev[productId];
      const same =
        current?.kind === next.kind &&
        (current.kind === 'series'
          ? next.kind === 'series' && current.orderId === next.orderId
          : next.kind === 'component' && current.key === next.key);
      return { ...prev, [productId]: same ? null : next };
    });
  };

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
          <ReportPeriodFields
            from={from}
            to={to}
            disabled={busy}
            onCommit={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />
        }
        tools={
          <>
            {layout === 'series' && (
              <ListViewSettings
                columns={listColumns}
                filterOptions={listTable.filterOptions}
                filters={listTable.filters}
                sortRules={listTable.sortRules}
                onApply={listTable.applySettings}
                activeFilterCount={listTable.activeFilterCount}
              />
            )}
            <IconButton className="toolbar-icon" icon="refresh" label="Обновить" onClick={() => load()} disabled={busy} />
            <IconButton
              className="toolbar-icon"
              icon="expandAll"
              label="Развернуть всё"
              disabled={busy}
              onClick={() => {
                if (layout === 'product') setOpenProducts(new Set(byProduct.map(productKey)));
                else setExpanded(new Set(listTable.displayRows.map((r) => r.id)));
              }}
            />
            <IconButton
              className="toolbar-icon"
              icon="collapseAll"
              label="Свернуть всё"
              disabled={busy}
              onClick={() => {
                if (layout === 'product') setOpenProducts(new Set());
                else setExpanded(new Set());
              }}
            />
          </>
        }
      />

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
              {(() => {
                const link = linkByProduct[id] || null;
                const seriesRows =
                  link?.kind === 'component'
                    ? seriesUsingComponent(rows, product.productId, product.productName, link.key)
                    : product.series.map((series) => ({ ...series, componentQty: null as number | null }));
                const componentRows =
                  link?.kind === 'series'
                    ? componentsOfSeries(rows, link.orderId)
                    : product.components;
                const seriesLabel =
                  link?.kind === 'series'
                    ? product.series.find((series) => series.orderId === link.orderId)?.seriesNumber
                    : '';
                const componentLabel =
                  link?.kind === 'component'
                    ? product.components.find((c) => componentKey(c) === link.key)
                    : null;
                return (
              <>
              {link && (
                <p className="report-link-caption">
                  {link.kind === 'series'
                    ? `Сырьё серии ${seriesLabel || '—'}`
                    : `Серии с ${componentLabel?.materialName || 'компонентом'}${
                        componentLabel?.lotNumber ? `, партия ${componentLabel.lotNumber}` : ''
                      }`}
                  <button type="button" className="ghost" onClick={() => toggleLink(id, link)}>
                    Снять
                  </button>
                </p>
              )}
              <div className="table-wrap">
                <table className="data-table report-table">
                  <thead>
                    <tr>
                      <th>Серия</th>
                      <th>Партия ГП</th>
                      <th>Дата производства</th>
                      <th>Выпуск</th>
                      {link?.kind === 'component' && <th>Компонент</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {seriesRows.map((series) => {
                      const active = link?.kind === 'series' && link.orderId === series.orderId;
                      return (
                      <tr
                        key={series.orderId || series.seriesId}
                        className={active ? 'report-row is-selected' : 'report-row'}
                        onClick={() => toggleLink(id, { kind: 'series', orderId: series.orderId })}
                      >
                        <td>{series.seriesNumber}</td>
                        <td>{series.lotNumber}</td>
                        <td>{series.productionDate}</td>
                        <td>{formatMaterialQty(series.quantity, product.productId)}</td>
                        {link?.kind === 'component' && (
                          <td>
                            {series.componentQty != null
                              ? formatMaterialQty(series.componentQty, componentLabel?.materialId)
                              : '—'}
                          </td>
                        )}
                      </tr>
                      );
                    })}
                    {!seriesRows.length && (
                      <tr>
                        <td colSpan={link?.kind === 'component' ? 5 : 4} className="muted">
                          Нет серий
                        </td>
                      </tr>
                    )}
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
                    {componentRows.length ? (
                      componentRows.map((c) => {
                        const key = componentKey(c);
                        const active = link?.kind === 'component' && link.key === key;
                        return (
                        <tr
                          key={key}
                          className={active ? 'report-row is-selected' : 'report-row'}
                          onClick={() => toggleLink(id, { kind: 'component', key })}
                        >
                          <td>{c.materialName}</td>
                          <td>{c.lotNumber}</td>
                          <td>{c.counterpartyName || '—'}</td>
                          <td>{c.manufacturerName || '—'}</td>
                          <td>{formatMaterialQty(c.quantity, c.materialId)}</td>
                          <td>{c.unit || '—'}</td>
                        </tr>
                        );
                      })
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
              </>
                );
              })()}
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
