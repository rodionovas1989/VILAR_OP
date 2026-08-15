import { useEffect, useMemo, useState, Fragment } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { QualityStockReportRow } from '../types';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';
import RefreshButton from './RefreshButton';
import { ListViewSettingsButton, ListViewSettingsPanel } from './ListViewSettings';

const PAGE_ID = 'report_quality_stock';

type LotGroup = {
  id: string;
  lotNumber: string;
  counterpartyName: string;
  productionDate: string;
  expiryDate: string;
  qualityMissing: boolean;
  qualityName: string | null | undefined;
  permission: string;
  permissionLabel: string;
  documentNumber: string;
  updatedAt: string;
  quantity: number;
  reserved: number;
  free: number;
  warehouses: QualityStockReportRow[];
};

type MaterialGroup = {
  id: string;
  name: string;
  type: string;
  unit: string;
  quantity: number;
  reserved: number;
  free: number;
  lots: LotGroup[];
};

function roundQty(n: number) {
  return Number(Number(n || 0).toFixed(6));
}

function formatQty(n: number) {
  const v = roundQty(n);
  if (Number.isInteger(v)) return String(v);
  return String(v);
}

function qualityDisplay(lot: { qualityMissing: boolean; qualityName?: string | null }) {
  if (lot.qualityMissing) return 'Не задано';
  return lot.qualityName || '—';
}

function lotRowClass(permission: string, missing: boolean) {
  if (missing) return ' report-quality-missing';
  if (permission === 'unfit') return ' report-quality-unfit';
  if (permission === 'conditional') return ' report-quality-conditional';
  return '';
}

function groupRows(rows: QualityStockReportRow[]): MaterialGroup[] {
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
        quantity: 0,
        reserved: 0,
        free: 0,
        lots: [],
      };
      matMap.set(row.materialId, mat);
      materials.push(mat);
    }
    let lot = mat.lots.find((l) => l.id === row.lotId);
    if (!lot) {
      lot = {
        id: row.lotId,
        lotNumber: row.lotNumber,
        counterpartyName: row.counterpartyName,
        productionDate: row.productionDate,
        expiryDate: row.expiryDate,
        qualityMissing: row.qualityMissing,
        qualityName: row.qualityName,
        permission: row.permission,
        permissionLabel: row.permissionLabel,
        documentNumber: row.documentNumber,
        updatedAt: row.updatedAt,
        quantity: 0,
        reserved: 0,
        free: 0,
        warehouses: [],
      };
      mat.lots.push(lot);
    }
    lot.warehouses.push(row);
    lot.quantity = roundQty(lot.quantity + row.quantity);
    lot.reserved = roundQty(lot.reserved + row.reserved);
    lot.free = roundQty(lot.free + row.free);
    mat.quantity = roundQty(mat.quantity + row.quantity);
    mat.reserved = roundQty(mat.reserved + row.reserved);
    mat.free = roundQty(mat.free + row.free);
  }
  return materials;
}

export default function QualityStockReportPage() {
  const { user } = useAuth();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const [rows, setRows] = useState<QualityStockReportRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const listColumns = useMemo((): ListColumn<QualityStockReportRow>[] => {
    return [
      { key: 'materialName', label: 'Материал', getValue: (r) => r.materialName },
      { key: 'materialType', label: 'Тип материала', getValue: (r) => r.materialType },
      { key: 'lotNumber', label: 'Партия', getValue: (r) => r.lotNumber },
      { key: 'warehouseName', label: 'Склад', getValue: (r) => r.warehouseName },
      {
        key: 'qualityName',
        label: 'Качество',
        getValue: (r) => (r.qualityMissing ? 'Не задано' : r.qualityName || '—'),
      },
      { key: 'permissionLabel', label: 'Разрешение', getValue: (r) => r.permissionLabel },
      {
        key: 'qualityMissing',
        label: 'В регистре',
        getValue: (r) => (r.qualityMissing ? 'нет' : 'да'),
      },
    ];
  }, []);

  const listTable = useListTable(rows, listColumns, {
    persistKey: PAGE_ID,
    userId: user?.id,
  });

  const tree = useMemo(() => groupRows(listTable.displayRows), [listTable.displayRows]);

  const totals = useMemo(
    () =>
      tree.reduce(
        (acc, mat) => ({
          quantity: roundQty(acc.quantity + mat.quantity),
          reserved: roundQty(acc.reserved + mat.reserved),
          free: roundQty(acc.free + mat.free),
        }),
        { quantity: 0, reserved: 0, free: 0 }
      ),
    [tree]
  );

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.qualityStockReport();
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
      await api.exportQualityStockReportXlsx(listTable.displayRows.map((r) => r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <AccessDenied title="Качество запасов" />;
  }

  return (
    <div className="page report-page">
      <div className="page-toolbar report-no-print">
        <PageTitle pageId={PAGE_ID} title="Качество запасов" />
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
        Материал → Партия → Склад. Партии без записи в регистре качеств показываются как «Не задано»
        (в системе по умолчанию действует Годен).
      </p>

      {error && <p className="error report-no-print">{error}</p>}

      <h2 className="report-print-title">Качество запасов</h2>

      <div className="table-wrap">
        <table className="data-table report-table report-tree-table">
          <thead>
            <tr>
              <th>Группировка</th>
              <th>Тип / ед.</th>
              <th>Партия</th>
              <th>Качество</th>
              <th>Разрешение</th>
              <th>Документ</th>
              <th className="report-num">Остаток</th>
              <th className="report-num">Резерв</th>
              <th className="report-num">Свободно</th>
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
                    <td>
                      {mat.type}
                      {mat.unit ? ` / ${mat.unit}` : ''}
                    </td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td className="report-num">{formatQty(mat.quantity)}</td>
                    <td className="report-num">{formatQty(mat.reserved)}</td>
                    <td className="report-num">{formatQty(mat.free)}</td>
                  </tr>
                  {mat.lots.map((lot) => {
                    const lotId = `lot:${mat.id}:${lot.id}`;
                    const lotOpen = expanded.has(lotId);
                    return (
                      <Fragment key={lotId}>
                        <tr
                          className={`report-row report-tree-lot${lotRowClass(lot.permission, lot.qualityMissing)}${
                            matOpen ? '' : ' report-tree-hidden'
                          }`}
                          onClick={() => toggle(lotId)}
                        >
                          <td>
                            <span className="report-tree-label report-tree-indent-1">
                              <span className="report-expand-chevron">{lotOpen ? '▾' : '▸'}</span>
                              {lot.lotNumber}
                            </span>
                          </td>
                          <td>{lot.counterpartyName}</td>
                          <td>{lot.lotNumber}</td>
                          <td>
                            {qualityDisplay(lot)}
                            {lot.qualityMissing ? (
                              <span className="report-quality-badge" title="Нет записи в регистре качеств">
                                {' '}
                                по умолчанию: Годен
                              </span>
                            ) : null}
                          </td>
                          <td>{lot.permissionLabel}</td>
                          <td>{lot.documentNumber || '—'}</td>
                          <td className="report-num">{formatQty(lot.quantity)}</td>
                          <td className="report-num">{formatQty(lot.reserved)}</td>
                          <td className="report-num">{formatQty(lot.free)}</td>
                        </tr>
                        {lot.warehouses.map((wh) => (
                          <tr
                            key={wh.id}
                            className={`report-tree-detail${matOpen && lotOpen ? '' : ' report-tree-hidden'}`}
                          >
                            <td>
                              <span className="report-tree-label report-tree-indent-2">{wh.warehouseName}</span>
                            </td>
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td className="report-num">{formatQty(wh.quantity)}</td>
                            <td className="report-num">{formatQty(wh.reserved)}</td>
                            <td className="report-num">{formatQty(wh.free)}</td>
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
                <td colSpan={9} className="muted">
                  Нет остатков по выбранным отборам
                </td>
              </tr>
            )}
          </tbody>
          {tree.length > 0 && (
            <tfoot>
              <tr className="report-tree-total">
                <td colSpan={6}>Итого</td>
                <td className="report-num">{formatQty(totals.quantity)}</td>
                <td className="report-num">{formatQty(totals.reserved)}</td>
                <td className="report-num">{formatQty(totals.free)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
