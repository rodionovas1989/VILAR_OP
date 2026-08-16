import { Router } from 'express';
import ExcelJS from 'exceljs';
import { requirePermission } from '../middleware/access.js';
import {
  releasedSeriesReport,
  filterReleasedSeries,
  planFactReport,
  filterPlanFactReport,
  stockReport,
  filterStockReport,
  groupStockRows,
  qualityStockReport,
  filterQualityStockReport,
  groupQualityStockRows,
  qualityHistoryReport,
  filterQualityHistoryReport,
  groupQualityHistoryRows,
} from '../services/reports.js';

const router = Router();

router.get('/released-series', requirePermission('report_released_series', 'read'), (_req, res) => {
  res.json(releasedSeriesReport());
});

router.post('/released-series.xlsx', requirePermission('report_released_series', 'read'), async (req, res) => {
  const all = releasedSeriesReport();
  const rows = filterReleasedSeries(all, req.body?.ids);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vilar OP';

  const seriesSheet = wb.addWorksheet('Серии');
  seriesSheet.columns = [
    { header: 'Название', key: 'productName', width: 36 },
    { header: 'Серия', key: 'seriesNumber', width: 16 },
    { header: 'Партия', key: 'lotNumber', width: 18 },
    { header: 'Дата производства', key: 'productionDate', width: 18 },
    { header: 'Количество', key: 'quantity', width: 14 },
  ];
  for (const row of rows) {
    seriesSheet.addRow({
      productName: row.productName,
      seriesNumber: row.seriesNumber,
      lotNumber: row.lotNumber,
      productionDate: row.productionDate,
      quantity: row.quantity,
    });
  }

  const compSheet = wb.addWorksheet('Компоненты');
  compSheet.columns = [
    { header: 'Название продукции', key: 'productName', width: 36 },
    { header: 'Серия', key: 'seriesNumber', width: 16 },
    { header: 'Партия ГП', key: 'lotNumber', width: 18 },
    { header: 'Компонент', key: 'materialName', width: 36 },
    { header: 'Партия компонента', key: 'componentLot', width: 18 },
    { header: 'Количество', key: 'quantity', width: 14 },
    { header: 'Ед.', key: 'unit', width: 8 },
  ];
  for (const row of rows) {
    for (const c of row.components || []) {
      compSheet.addRow({
        productName: row.productName,
        seriesNumber: row.seriesNumber,
        lotNumber: row.lotNumber,
        materialName: c.materialName,
        componentLot: c.lotNumber,
        quantity: c.quantity,
        unit: c.unit,
      });
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="released-series-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.get('/plan-fact', requirePermission('report_plan_fact', 'read'), (req, res) => {
  res.json(
    planFactReport({
      from: req.query.from || undefined,
      to: req.query.to || undefined,
      includeCancelled: req.query.includeCancelled === '1' || req.query.includeCancelled === 'true',
    })
  );
});

router.post('/plan-fact.xlsx', requirePermission('report_plan_fact', 'read'), async (req, res) => {
  const all = planFactReport({
    from: req.body?.from || undefined,
    to: req.body?.to || undefined,
    includeCancelled: Boolean(req.body?.includeCancelled),
  });
  const rows = filterPlanFactReport(all, req.body?.ids);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vilar OP';
  const sheet = wb.addWorksheet('План-Факт');
  sheet.columns = [
    { header: 'Продукт', key: 'productName', width: 36 },
    { header: 'Серия', key: 'seriesNumber', width: 16 },
    { header: 'РЦ', key: 'workCenterName', width: 16 },
    { header: 'Статус', key: 'statusLabel', width: 14 },
    { header: 'План начало', key: 'planStart', width: 14 },
    { header: 'План окончание', key: 'planEnd', width: 14 },
    { header: 'План кол-во', key: 'planQuantity', width: 12 },
    { header: 'Факт дата', key: 'factDate', width: 14 },
    { header: 'Факт кол-во', key: 'factQuantity', width: 12 },
    { header: 'Отклонение', key: 'quantityVariance', width: 12 },
  ];
  for (const row of rows) {
    sheet.addRow({
      productName: row.productName,
      seriesNumber: row.seriesNumber,
      workCenterName: row.workCenterName,
      statusLabel: row.statusLabel,
      planStart: row.planStart,
      planEnd: row.planEnd,
      planQuantity: row.planQuantity,
      factDate: row.factDate,
      factQuantity: row.factQuantity ?? '',
      quantityVariance: row.quantityVariance ?? '',
    });
  }
  sheet.getRow(1).font = { bold: true };
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="plan-fact-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.get('/stock', requirePermission('report_stock', 'read'), (_req, res) => {
  res.json(stockReport());
});

router.post('/stock.xlsx', requirePermission('report_stock', 'read'), async (req, res) => {
  const rows = filterStockReport(stockReport(), req.body?.ids);
  const groups = groupStockRows(rows);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vilar OP';

  const tree = wb.addWorksheet('Иерархия');
  tree.columns = [
    { header: 'Группировка', key: 'label', width: 40 },
    { header: 'Тип', key: 'type', width: 22 },
    { header: 'Ед.', key: 'unit', width: 8 },
    { header: 'Партия', key: 'lotNumber', width: 16 },
    { header: 'Контрагент', key: 'counterpartyName', width: 24 },
    { header: 'Дата производства', key: 'productionDate', width: 18 },
    { header: 'Срок годности', key: 'expiryDate', width: 16 },
    { header: 'Остаток', key: 'quantity', width: 12 },
    { header: 'Резерв', key: 'reserved', width: 12 },
    { header: 'Свободно', key: 'free', width: 12 },
  ];
  tree.properties.outlineLevelRow = 2;

  const addTreeRow = (values, level, bold) => {
    const row = tree.addRow(values);
    row.outlineLevel = level;
    if (bold) row.font = { bold: true };
  };

  for (const wh of groups) {
    addTreeRow(
      {
        label: wh.name,
        type: wh.type,
        quantity: wh.quantity,
        reserved: wh.reserved,
        free: wh.free,
      },
      0,
      true
    );
    for (const mat of wh.materials) {
      addTreeRow(
        {
          label: `  ${mat.name}`,
          type: mat.type,
          unit: mat.unit,
          quantity: mat.quantity,
          reserved: mat.reserved,
          free: mat.free,
        },
        1,
        true
      );
      for (const lot of mat.lots) {
        addTreeRow(
          {
            label: `    ${lot.lotNumber}`,
            type: lot.materialType,
            unit: lot.unit,
            lotNumber: lot.lotNumber,
            counterpartyName: lot.counterpartyName,
            productionDate: lot.productionDate,
            expiryDate: lot.expiryDate,
            quantity: lot.quantity,
            reserved: lot.reserved,
            free: lot.free,
          },
          2,
          false
        );
      }
    }
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.quantity += r.quantity;
      acc.reserved += r.reserved;
      acc.free += r.free;
      return acc;
    },
    { quantity: 0, reserved: 0, free: 0 }
  );
  addTreeRow(
    {
      label: 'Итого',
      quantity: Number(totals.quantity.toFixed(6)),
      reserved: Number(totals.reserved.toFixed(6)),
      free: Number(totals.free.toFixed(6)),
    },
    0,
    true
  );

  const detail = wb.addWorksheet('Детализация');
  detail.columns = [
    { header: 'Склад', key: 'warehouseName', width: 24 },
    { header: 'Тип склада', key: 'warehouseType', width: 16 },
    { header: 'Материал', key: 'materialName', width: 36 },
    { header: 'Тип материала', key: 'materialType', width: 24 },
    { header: 'Ед.', key: 'unit', width: 8 },
    { header: 'Партия', key: 'lotNumber', width: 16 },
    { header: 'Контрагент', key: 'counterpartyName', width: 24 },
    { header: 'Дата производства', key: 'productionDate', width: 18 },
    { header: 'Срок годности', key: 'expiryDate', width: 16 },
    { header: 'Остаток', key: 'quantity', width: 12 },
    { header: 'Резерв', key: 'reserved', width: 12 },
    { header: 'Свободно', key: 'free', width: 12 },
  ];
  for (const row of rows) detail.addRow(row);

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="stock-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.get('/quality-stock', requirePermission('report_quality_stock', 'read'), (_req, res) => {
  res.json(qualityStockReport());
});

router.post('/quality-stock.xlsx', requirePermission('report_quality_stock', 'read'), async (req, res) => {
  const rows = filterQualityStockReport(qualityStockReport(), req.body?.ids);
  const groups = groupQualityStockRows(rows);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vilar OP';

  const tree = wb.addWorksheet('Иерархия');
  tree.columns = [
    { header: 'Группировка', key: 'label', width: 40 },
    { header: 'Тип', key: 'type', width: 22 },
    { header: 'Ед.', key: 'unit', width: 8 },
    { header: 'Партия', key: 'lotNumber', width: 16 },
    { header: 'Качество', key: 'qualityName', width: 22 },
    { header: 'Разрешение', key: 'permissionLabel', width: 16 },
    { header: 'Признак', key: 'qualityFlag', width: 28 },
    { header: 'Документ', key: 'documentNumber', width: 18 },
    { header: 'Обновлено', key: 'updatedAt', width: 20 },
    { header: 'Склад', key: 'warehouseName', width: 22 },
    { header: 'Остаток', key: 'quantity', width: 12 },
    { header: 'Резерв', key: 'reserved', width: 12 },
    { header: 'Свободно', key: 'free', width: 12 },
  ];
  tree.properties.outlineLevelRow = 2;

  const addTreeRow = (values, level, bold) => {
    const row = tree.addRow(values);
    row.outlineLevel = level;
    if (bold) row.font = { bold: true };
  };

  for (const mat of groups) {
    addTreeRow(
      {
        label: mat.name,
        type: mat.type,
        unit: mat.unit,
        quantity: mat.quantity,
        reserved: mat.reserved,
        free: mat.free,
      },
      0,
      true
    );
    for (const lot of mat.lots) {
      addTreeRow(
        {
          label: `  ${lot.lotNumber}`,
          type: mat.type,
          unit: mat.unit,
          lotNumber: lot.lotNumber,
          qualityName: lot.qualityMissing ? 'Не задано' : lot.qualityName || '—',
          permissionLabel: lot.permissionLabel,
          qualityFlag: lot.qualityMissing ? 'Нет в регистре (по умолчанию: Годен)' : '',
          documentNumber: lot.documentNumber || '',
          updatedAt: lot.updatedAt ? String(lot.updatedAt).replace('T', ' ').slice(0, 19) : '',
          quantity: lot.quantity,
          reserved: lot.reserved,
          free: lot.free,
        },
        1,
        true
      );
      for (const wh of lot.warehouses) {
        addTreeRow(
          {
            label: `    ${wh.warehouseName}`,
            warehouseName: wh.warehouseName,
            quantity: wh.quantity,
            reserved: wh.reserved,
            free: wh.free,
          },
          2,
          false
        );
      }
    }
  }

  const detail = wb.addWorksheet('Детализация');
  detail.columns = [
    { header: 'Материал', key: 'materialName', width: 36 },
    { header: 'Тип', key: 'materialType', width: 20 },
    { header: 'Ед.', key: 'unit', width: 8 },
    { header: 'Партия', key: 'lotNumber', width: 16 },
    { header: 'Контрагент', key: 'counterpartyName', width: 24 },
    { header: 'Срок годности', key: 'expiryDate', width: 14 },
    { header: 'Качество', key: 'qualityDisplay', width: 22 },
    { header: 'Разрешение', key: 'permissionLabel', width: 16 },
    { header: 'Нет в регистре', key: 'qualityMissing', width: 14 },
    { header: 'Документ', key: 'documentNumber', width: 18 },
    { header: 'Склад', key: 'warehouseName', width: 22 },
    { header: 'Остаток', key: 'quantity', width: 12 },
    { header: 'Резерв', key: 'reserved', width: 12 },
    { header: 'Свободно', key: 'free', width: 12 },
  ];
  for (const row of rows) {
    detail.addRow({
      ...row,
      qualityDisplay: row.qualityMissing ? 'Не задано' : row.qualityName || '—',
      qualityMissing: row.qualityMissing ? 'да' : 'нет',
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="quality-stock-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.get('/quality-history', requirePermission('report_quality_history', 'read'), (_req, res) => {
  res.json(qualityHistoryReport());
});

router.post('/quality-history.xlsx', requirePermission('report_quality_history', 'read'), async (req, res) => {
  const rows = filterQualityHistoryReport(qualityHistoryReport(), req.body?.ids);
  const groups = groupQualityHistoryRows(rows);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vilar OP';

  const tree = wb.addWorksheet('Иерархия');
  tree.columns = [
    { header: 'Группировка', key: 'label', width: 40 },
    { header: 'Партия', key: 'lotNumber', width: 16 },
    { header: 'Дата', key: 'at', width: 20 },
    { header: 'Действие', key: 'actionLabel', width: 14 },
    { header: 'Документ', key: 'documentNumber', width: 18 },
    { header: 'Качество', key: 'qualityName', width: 22 },
    { header: 'Разрешение', key: 'permissionLabel', width: 16 },
    { header: 'Пользователь', key: 'userName', width: 20 },
  ];
  tree.properties.outlineLevelRow = 2;

  const addTreeRow = (values, level, bold) => {
    const row = tree.addRow(values);
    row.outlineLevel = level;
    if (bold) row.font = { bold: true };
  };

  for (const mat of groups) {
    addTreeRow({ label: mat.name, type: mat.type }, 0, true);
    for (const lot of mat.lots) {
      addTreeRow({ label: `  ${lot.lotNumber}`, lotNumber: lot.lotNumber }, 1, true);
      for (const ev of lot.events) {
        addTreeRow(
          {
            label: `    ${ev.actionLabel}`,
            lotNumber: lot.lotNumber,
            at: String(ev.at || '').replace('T', ' ').slice(0, 19),
            actionLabel: ev.actionLabel,
            documentNumber: ev.documentNumber,
            qualityName: ev.qualityName,
            permissionLabel: ev.permissionLabel,
            userName: ev.userName,
          },
          2,
          false
        );
      }
    }
  }

  const detail = wb.addWorksheet('Детализация');
  detail.columns = [
    { header: 'Дата', key: 'at', width: 20 },
    { header: 'Действие', key: 'actionLabel', width: 14 },
    { header: 'Документ', key: 'documentNumber', width: 18 },
    { header: 'Материал', key: 'materialName', width: 36 },
    { header: 'Партия', key: 'lotNumber', width: 16 },
    { header: 'Качество', key: 'qualityName', width: 22 },
    { header: 'Разрешение', key: 'permissionLabel', width: 16 },
    { header: 'Пользователь', key: 'userName', width: 20 },
  ];
  for (const row of rows) {
    detail.addRow({
      ...row,
      at: String(row.at || '').replace('T', ' ').slice(0, 19),
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="quality-history-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

export default router;
