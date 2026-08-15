import { useEffect, useMemo, useState, Fragment } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { QualityHistoryReportRow } from '../types';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';

const PAGE_ID = 'report_quality_history';

type LotGroup = {
  id: string;
  lotNumber: string;
  events: QualityHistoryReportRow[];
};

type MaterialGroup = {
  id: string;
  name: string;
  type: string;
  unit: string;
  lots: LotGroup[];
};

function formatAt(iso: string) {
  if (!iso) return '—';
  return String(iso).replace('T', ' ').slice(0, 19);
}

function groupRows(rows: QualityHistoryReportRow[]): MaterialGroup[] {
  const materials: MaterialGroup[] = [];
  const matMap = new Map<string, MaterialGroup>();
  for (const row of rows) {
    let mat = matMap.get(row.materialId);
    if (!mat) {
      mat = {
        id: row.materialId,
        name: row.materialName,
        type: row.materialType,
        unit: row.unit,
        lots: [],
      };
      matMap.set(row.materialId, mat);
      materials.push(mat);
    }
    let lot = mat.lots.find((l) => l.id === row.lotId);
    if (!lot) {
      lot = { id: row.lotId, lotNumber: row.lotNumber, events: [] };
      mat.lots.push(lot);
    }
    lot.events.push(row);
  }
  for (const mat of materials) {
    for (const lot of mat.lots) {
      lot.events.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    }
  }
  return materials;
}

export default function QualityHistoryReportPage() {
  const { user } = useAuth();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const [rows, setRows] = useState<QualityHistoryReportRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const listColumns = useMemo((): ListColumn<QualityHistoryReportRow>[] => {
    return [
      { key: 'materialName', label: 'Материал', getValue: (r) => r.materialName },
      { key: 'lotNumber', label: 'Партия', getValue: (r) => r.lotNumber },
      { key: 'actionLabel', label: 'Действие', getValue: (r) => r.actionLabel },
      { key: 'qualityName', label: 'Качество', getValue: (r) => r.qualityName },
      { key: 'permissionLabel', label: 'Разрешение', getValue: (r) => r.permissionLabel },
      { key: 'documentNumber', label: 'Документ', getValue: (r) => r.documentNumber },
      { key: 'userName', label: 'Пользователь', getValue: (r) => r.userName },
      { key: 'at', label: 'Дата', getValue: (r) => formatAt(r.at) },
    ];
  }, []);

  const listTable = useListTable(rows, listColumns, {
    persistKey: PAGE_ID,
    userId: user?.id,
  });

  const tree = useMemo(() => groupRows(listTable.displayRows), [listTable.displayRows]);

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.qualityHistoryReport();
      setRows(data);
      setExpanded(new Set(groupRows(data).map((m) => `mat:${m.id}`)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const next = new Set<string>();
    for (const mat of tree) {
      next.add(`mat:${mat.id}`);
      for (const lot of mat.lots) next.add(`lot:${mat.id}:${lot.id}`);
    }
    setExpanded(next);
  };

  const collapseAll = () => setExpanded(new Set());

  const exportExcel = async () => {
    setBusy(true);
    setError('');
    try {
      await api.exportQualityHistoryReportXlsx(listTable.displayRows.map((r) => r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <AccessDenied title="История качеств" />;
  }

  return (
    <div className="page report-page">
      <div className="page-toolbar report-no-print">
        <PageTitle pageId={PAGE_ID} title="История качеств" />
        <div className="toolbar-actions">
          <ListViewSettingsButton
            open={listSettingsOpen}
            onOpenChange={setListSettingsOpen}
            activeFilterCount={listTable.activeFilterCount}
            sortRulesCount={listTable.sortRules.length}
          />
          <button type="button" className="ghost" onClick={expandAll} disabled={busy}>
            Развернуть всё
          </button>
          <button type="button" className="ghost" onClick={collapseAll} disabled={busy}>
            Свернуть всё
          </button>
          <button type="button" className="ghost" onClick={exportExcel} disabled={busy}>
            Excel
          </button>
          <button type="button" className="ghost" onClick={() => window.print()} disabled={busy}>
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
        Материал → Партия → события журнала (проведение / отмена документов управления качеством).
      </p>

      {error && <p className="error report-no-print">{error}</p>}

      <h2 className="report-print-title">История качеств</h2>

      <div className="table-wrap">
        <table className="data-table report-table report-tree-table">
          <thead>
            <tr>
              <th>Группировка</th>
              <th>Партия</th>
              <th>Дата</th>
              <th>Действие</th>
              <th>Документ</th>
              <th>Качество</th>
              <th>Разрешение</th>
              <th>Пользователь</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((mat) => {
              const matOpen = expanded.has(`mat:${mat.id}`);
              return (
                <Fragment key={`mat:${mat.id}`}>
                  <tr className="report-row report-tree-material" onClick={() => toggle(`mat:${mat.id}`)}>
                    <td>
                      <span className="report-tree-label report-tree-indent-0">
                        <span className="report-expand-chevron">{matOpen ? '▾' : '▸'}</span>
                        {mat.name}
                      </span>
                    </td>
                    <td colSpan={7} className="muted">
                      {mat.type}
                      {mat.unit ? ` · ${mat.unit}` : ''}
                    </td>
                  </tr>
                  {mat.lots.map((lot) => {
                    const lotId = `lot:${mat.id}:${lot.id}`;
                    const lotOpen = expanded.has(lotId);
                    return (
                      <Fragment key={lotId}>
                        <tr
                          className={`report-row report-tree-lot${matOpen ? '' : ' report-tree-hidden'}`}
                          onClick={() => toggle(lotId)}
                        >
                          <td>
                            <span className="report-tree-label report-tree-indent-1">
                              <span className="report-expand-chevron">{lotOpen ? '▾' : '▸'}</span>
                              {lot.lotNumber}
                            </span>
                          </td>
                          <td>{lot.lotNumber}</td>
                          <td colSpan={6} className="muted">
                            событий: {lot.events.length}
                          </td>
                        </tr>
                        {lot.events.map((ev) => (
                          <tr
                            key={ev.id}
                            className={`report-tree-detail${matOpen && lotOpen ? '' : ' report-tree-hidden'}`}
                          >
                            <td>
                              <span className="report-tree-label report-tree-indent-2">{ev.actionLabel}</span>
                            </td>
                            <td>{lot.lotNumber}</td>
                            <td>{formatAt(ev.at)}</td>
                            <td>{ev.actionLabel}</td>
                            <td>{ev.documentNumber}</td>
                            <td>{ev.qualityName}</td>
                            <td>{ev.permissionLabel}</td>
                            <td>{ev.userName}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
            {!tree.length && (
              <tr>
                <td colSpan={8} className="muted">
                  Нет записей истории по выбранным отборам
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
