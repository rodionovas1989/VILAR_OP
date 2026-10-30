import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { PlanFactReportRow } from '../types';
import AccessDenied from './AccessDenied';
import ReportChrome from './ReportChrome';
import ReportPeriodFields from './ReportPeriodFields';
import IconButton from './IconButton';
import ListTableHeader from './ListTableHeader';
import { ListViewSettings } from './ListViewSettings';
import { useQtyFormat } from '../qtyFormat/QtyFormatContext';

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
  const { formatMaterialQty, formatMaterialQtyDelta } = useQtyFormat();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const initial = monthBounds();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<PlanFactReportRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
        getValue: (r) => formatMaterialQty(r.planQuantity, r.productId),
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
        getValue: (r) =>
          r.factQuantity != null ? formatMaterialQty(r.factQuantity, r.productId) : '—',
        getSortValue: (r) => (r.factQuantity != null ? Number(r.factQuantity) : -1),
      },
      {
        key: 'quantityVariance',
        label: 'Откл.',
        getValue: (r) =>
          r.quantityVariance != null ? formatMaterialQtyDelta(r.quantityVariance, r.productId) : '—',
        getSortValue: (r) => (r.quantityVariance != null ? Number(r.quantityVariance) : 0),
      },
    ];
  }, [formatMaterialQty, formatMaterialQtyDelta]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the committed period changes
  }, [from, to]);

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
      <ReportChrome
        pageId={PAGE_ID}
        title="План/Факт производства"
        variants={[{ id: 'plan-fact', label: 'План и факт' }]}
        variant="plan-fact"
        onVariantChange={() => {}}
        busy={busy}
        onExcel={() => void exportExcel()}
        onPrint={() => window.print()}
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
            <ListViewSettings
              columns={listColumns}
              filterOptions={listTable.filterOptions}
              filters={listTable.filters}
              sortRules={listTable.sortRules}
              onApply={listTable.applySettings}
              activeFilterCount={listTable.activeFilterCount}
            />
            <IconButton
              className="toolbar-icon"
              icon="refresh"
              label="Обновить"
              onClick={() => void load()}
              disabled={busy}
            />
          </>
        }
      />

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
