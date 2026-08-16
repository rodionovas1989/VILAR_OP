import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { PlanFactReportRow } from '../types';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import ListTableHeader from './ListTableHeader';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';

const PAGE_ID = 'report_plan_fact';

function monthBounds(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

export default function PlanFactReportPage() {
  const { user } = useAuth();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const initial = monthBounds();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<PlanFactReportRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);

  const listColumns = useMemo((): ListColumn<PlanFactReportRow>[] => {
    return [
      { key: 'productName', label: 'Продукт', getValue: (r) => r.productName },
      { key: 'seriesNumber', label: 'Серия', getValue: (r) => r.seriesNumber },
      { key: 'workCenterName', label: 'РЦ', getValue: (r) => r.workCenterName },
      { key: 'statusLabel', label: 'Статус', getValue: (r) => r.statusLabel },
      { key: 'planStart', label: 'План с', getValue: (r) => r.planStart, getSortValue: (r) => r.planStart || '' },
      { key: 'planEnd', label: 'План по', getValue: (r) => r.planEnd, getSortValue: (r) => r.planEnd || '' },
      {
        key: 'planQuantity',
        label: 'План',
        getValue: (r) => String(r.planQuantity),
        getSortValue: (r) => Number(r.planQuantity) || 0,
      },
      {
        key: 'factDate',
        label: 'Факт дата',
        getValue: (r) => r.factDate,
        getSortValue: (r) => (r.factDate && r.factDate !== '—' ? r.factDate : ''),
      },
      {
        key: 'factQuantity',
        label: 'Факт',
        getValue: (r) => (r.factQuantity != null ? String(r.factQuantity) : '—'),
        getSortValue: (r) => (r.factQuantity != null ? Number(r.factQuantity) : -1),
      },
      {
        key: 'quantityVariance',
        label: 'Откл.',
        getValue: (r) => (r.quantityVariance != null ? String(r.quantityVariance) : '—'),
        getSortValue: (r) => (r.quantityVariance != null ? Number(r.quantityVariance) : 0),
      },
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
      setRows(await api.planFactReport({ from, to, includeCancelled: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportExcel = async () => {
    setBusy(true);
    setError('');
    try {
      await api.exportPlanFactReportXlsx({
        ids: listTable.displayRows.map((r) => r.id),
        from,
        to,
        includeCancelled: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <AccessDenied title="План/Факт производства" />;
  }

  return (
    <div className="page report-page">
      <div className="page-toolbar report-no-print">
        <PageTitle pageId={PAGE_ID} title="План/Факт производства" />
        <div className="toolbar-actions report-filter-bar">
          <label className="report-filter-inline">
            <span>с</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="report-filter-inline">
            <span>по</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" onClick={() => void load()} disabled={busy}>
            Применить
          </button>
          <ListViewSettingsButton
            open={listSettingsOpen}
            onOpenChange={setListSettingsOpen}
            activeFilterCount={listTable.activeFilterCount}
            sortRulesCount={listTable.sortRules.length}
          />
          <button type="button" className="ghost" onClick={exportExcel} disabled={busy}>
            Excel
          </button>
          <RefreshButton onClick={() => void load()} disabled={busy} />
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
        План по горизонту заказа; факт — дата и объём выпуска. Отменённые скрывайте отбором по колонке «Статус».
      </p>

      {error && <p className="error report-no-print">{error}</p>}

      <h2 className="report-print-title">План/Факт производства</h2>

      <div className="table-wrap">
        <table className="data-table report-table">
          <ListTableHeader columns={listColumns} />
          <tbody>
            {listTable.displayRows.map((r) => (
              <tr key={r.id}>
                {listColumns.map((col) => (
                  <td key={col.key}>{col.getValue(r)}</td>
                ))}
              </tr>
            ))}
            {!listTable.displayRows.length && (
              <tr>
                <td colSpan={listColumns.length} className="muted">
                  Нет данных за выбранный период
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
