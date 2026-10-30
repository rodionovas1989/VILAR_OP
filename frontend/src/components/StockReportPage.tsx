import { useEffect, useMemo, useState, Fragment } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { useListTable, ListColumn } from '../hooks/useListTable';
import { StockReportRow } from '../types';
import AccessDenied from './AccessDenied';
import ReportChrome from './ReportChrome';
import IconButton from './IconButton';
import { ListViewSettings } from './ListViewSettings';
import { useQtyFormat } from '../qtyFormat/QtyFormatContext';
import { roundQty } from '../utils/qty';

const PAGE_ID = 'report_stock';

type MaterialGroup = {
  id: string;
  name: string;
  type: string;
  unit: string;
  quantity: number;
  reserved: number;
  free: number;
  lots: StockReportRow[];
};

type WarehouseGroup = {
  id: string;
  name: string;
  type: string;
  quantity: number;
  reserved: number;
  free: number;
  materials: MaterialGroup[];
};

function groupStockRows(rows: StockReportRow[]): WarehouseGroup[] {
  const warehouses: WarehouseGroup[] = [];
  const whMap = new Map<string, WarehouseGroup>();
  for (const row of rows) {
    let wh = whMap.get(row.warehouseId);
    if (!wh) {
      wh = {
        id: row.warehouseId,
        name: row.warehouseName,
        type: row.warehouseType,
        quantity: 0,
        reserved: 0,
        free: 0,
        materials: [],
      };
      whMap.set(row.warehouseId, wh);
      warehouses.push(wh);
    }
    let mat = wh.materials.find((m) => m.id === row.materialId);
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
      wh.materials.push(mat);
    }
    mat.lots.push(row);
    mat.quantity = roundQty(mat.quantity + row.quantity);
    mat.reserved = roundQty(mat.reserved + row.reserved);
    mat.free = roundQty(mat.free + row.free);
    wh.quantity = roundQty(wh.quantity + row.quantity);
    wh.reserved = roundQty(wh.reserved + row.reserved);
    wh.free = roundQty(wh.free + row.free);
  }
  return warehouses;
}

export default function StockReportPage() {
  const { user } = useAuth();
  const { formatMaterialQty, formatQtyDefault } = useQtyFormat();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const [rows, setRows] = useState<StockReportRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const listColumns = useMemo((): ListColumn<StockReportRow>[] => {
    return [
      { key: 'warehouseName', label: 'Склад', getValue: (r) => r.warehouseName },
      { key: 'warehouseType', label: 'Тип склада', getValue: (r) => r.warehouseType },
      { key: 'materialName', label: 'Материал', getValue: (r) => r.materialName },
      { key: 'materialType', label: 'Тип материала', getValue: (r) => r.materialType },
      {
        key: 'identificationNumber',
        label: 'Идентификатор партии',
        getValue: (r) => r.identificationNumber || '—',
      },
      { key: 'lotNumber', label: 'Партия производителя', getValue: (r) => r.lotNumber },
      { key: 'counterpartyName', label: 'Контрагент', getValue: (r) => r.counterpartyName },
      { key: 'manufacturerName', label: 'Производитель', getValue: (r) => r.manufacturerName },
      { key: 'productionDate', label: 'Дата производства', getValue: (r) => r.productionDate },
      { key: 'expiryDate', label: 'Срок годности', getValue: (r) => r.expiryDate },
    ];
  }, []);

  const listTable = useListTable(rows, listColumns, {
    persistKey: PAGE_ID,
    userId: user?.id,
  });

  const tree = useMemo(() => groupStockRows(listTable.displayRows), [listTable.displayRows]);

  const totals = useMemo(
    () =>
      tree.reduce(
        (acc, wh) => ({
          quantity: roundQty(acc.quantity + wh.quantity),
          reserved: roundQty(acc.reserved + wh.reserved),
          free: roundQty(acc.free + wh.free),
        }),
        { quantity: 0, reserved: 0, free: 0 }
      ),
    [tree]
  );

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.stockReport();
      setRows(data);
      setExpanded(new Set(groupStockRows(data).map((wh) => `wh:${wh.id}`)));
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
    for (const wh of tree) {
      next.add(`wh:${wh.id}`);
      for (const mat of wh.materials) next.add(`mat:${wh.id}:${mat.id}`);
    }
    setExpanded(next);
  };

  const collapseAll = () => setExpanded(new Set());

  const exportExcel = async () => {
    setBusy(true);
    setError('');
    try {
      await api.exportStockReportXlsx(listTable.displayRows.map((r) => r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  if (!canView) {
    return <AccessDenied title="Отчет по запасам" />;
  }

  return (
    <div className="page report-page">
      <ReportChrome
        pageId={PAGE_ID}
        title="Отчет по запасам"
        variants={[{ id: 'tree', label: 'Дерево складов' }]}
        variant="tree"
        onVariantChange={() => {}}
        busy={busy}
        onExcel={() => void exportExcel()}
        onPrint={printReport}
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
            <IconButton className="toolbar-icon" icon="refresh" label="Обновить" onClick={() => load()} disabled={busy} />
            <IconButton className="toolbar-icon" icon="expandAll" label="Развернуть всё" onClick={expandAll} disabled={busy} />
            <IconButton className="toolbar-icon" icon="collapseAll" label="Свернуть всё" onClick={collapseAll} disabled={busy} />
          </>
        }
      />

      {error && <p className="error report-no-print">{error}</p>}

      <h2 className="report-print-title">Отчет по запасам</h2>

      <div className="table-wrap">
        <table className="data-table report-table report-tree-table">
          <thead>
            <tr>
              <th>Группировка</th>
              <th>Тип</th>
              <th>Ед.</th>
              <th>Партия производителя</th>
              <th>Контрагент</th>
              <th>Производитель</th>
              <th>Дата производства</th>
              <th>Срок годности</th>
              <th className="report-num">Остаток</th>
              <th className="report-num">Резерв</th>
              <th className="report-num">Свободно</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((wh) => {
              const whOpen = expanded.has(`wh:${wh.id}`);
              return (
                <Fragment key={`wh:${wh.id}`}>
                  <tr className="report-row report-tree-warehouse" onClick={() => toggle(`wh:${wh.id}`)}>
                    <td>
                      <span className="report-tree-label report-tree-indent-0">
                        <span className="report-expand-chevron">{whOpen ? '▾' : '▸'}</span>
                        {wh.name}
                      </span>
                    </td>
                    <td>{wh.type}</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td className="report-num">{formatQtyDefault(wh.quantity)}</td>
                    <td className="report-num">{formatQtyDefault(wh.reserved)}</td>
                    <td className="report-num">{formatQtyDefault(wh.free)}</td>
                  </tr>
                  {wh.materials.map((mat) => {
                      const matId = `mat:${wh.id}:${mat.id}`;
                      const matOpen = expanded.has(matId);
                      return (
                        <Fragment key={matId}>
                          <tr
                            className={`report-row report-tree-material${whOpen ? '' : ' report-tree-hidden'}`}
                            onClick={() => toggle(matId)}
                          >
                            <td>
                              <span className="report-tree-label report-tree-indent-1">
                                <span className="report-expand-chevron">{matOpen ? '▾' : '▸'}</span>
                                {mat.name}
                              </span>
                            </td>
                            <td>{mat.type}</td>
                            <td>{mat.unit}</td>
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td className="report-num">{formatMaterialQty(mat.quantity, mat.id)}</td>
                            <td className="report-num">{formatMaterialQty(mat.reserved, mat.id)}</td>
                            <td className="report-num">{formatMaterialQty(mat.free, mat.id)}</td>
                          </tr>
                          {mat.lots.map((lot) => (
                              <tr
                                key={lot.id}
                                className={`report-tree-lot${whOpen && matOpen ? '' : ' report-tree-hidden'}`}
                              >
                                <td>
                                  <span className="report-tree-label report-tree-indent-2">
                                    {lot.identificationNumber || '—'}
                                  </span>
                                </td>
                                <td>{lot.materialType}</td>
                                <td>{lot.unit}</td>
                                <td>{lot.lotNumber}</td>
                                <td>{lot.counterpartyName}</td>
                                <td>{lot.manufacturerName}</td>
                                <td>{lot.productionDate}</td>
                                <td>{lot.expiryDate}</td>
                                <td className="report-num">{formatMaterialQty(lot.quantity, mat.id)}</td>
                                <td className="report-num">{formatMaterialQty(lot.reserved, mat.id)}</td>
                                <td className="report-num">{formatMaterialQty(lot.free, mat.id)}</td>
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
                <td colSpan={11} className="muted">
                  Нет остатков по выбранным отборам
                </td>
              </tr>
            )}
          </tbody>
          {tree.length > 0 && (
            <tfoot>
              <tr className="report-tree-total">
                <td colSpan={8}>Итого</td>
                <td className="report-num">{formatQtyDefault(totals.quantity)}</td>
                <td className="report-num">{formatQtyDefault(totals.reserved)}</td>
                <td className="report-num">{formatQtyDefault(totals.free)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
