import { useEffect, useMemo, useState, Fragment } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { ReleasedSeriesRow } from '../types';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import ListTableHeader from './ListTableHeader';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';

const PAGE_ID = 'report_released_series';

export default function ReleasedSeriesReportPage() {
  const { user } = useAuth();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const [rows, setRows] = useState<ReleasedSeriesRow[]>([]);
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
      { key: 'quantity', label: 'Количество', getValue: (r) => String(r.quantity) },
    ];
  }, []);

  const listTable = useListTable(rows, listColumns, {
    persistKey: PAGE_ID,
    userId: user?.id,
  });

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      setRows(await api.releasedSeriesReport());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
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
      await api.exportReleasedSeriesXlsx(listTable.displayRows.map((r) => r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const printReport = () => {
    setExpanded(new Set(listTable.displayRows.map((r) => r.id)));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  };

  if (!canView) {
    return <AccessDenied title="Выпущенные серии продукции" />;
  }

  return (
    <div className="page report-page">
      <div className="page-toolbar report-no-print">
        <PageTitle pageId={PAGE_ID} title="Выпущенные серии продукции" />
        <div className="toolbar-actions">
          <ListViewSettingsButton
            open={listSettingsOpen}
            onOpenChange={setListSettingsOpen}
            activeFilterCount={listTable.activeFilterCount}
            sortRulesCount={listTable.sortRules.length}
          />
          <button type="button" className="ghost" onClick={exportExcel} disabled={busy}>
            Excel
          </button>
          <button type="button" className="ghost" onClick={printReport} disabled={busy}>
            Печать
          </button>
          <RefreshButton onClick={() => load()} disabled={busy} />
        </div>
      </div>
      {listSettingsOpen && (
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
        Завершённые заказы: выпуск ГП и фактически потраченные компоненты. Раскройте строку, чтобы увидеть состав.
      </p>

      {error && <p className="error report-no-print">{error}</p>}

      <h2 className="report-print-title">Выпущенные серии продукции</h2>

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
                                <th>Количество</th>
                                <th>Ед.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.components.map((c, i) => (
                                <tr key={`${row.id}-c-${i}`}>
                                  <td>{c.materialName}</td>
                                  <td>{c.lotNumber}</td>
                                  <td>{c.quantity}</td>
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
                  Нет выпущенных серий по выбранным отборам
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
