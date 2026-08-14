import { Router } from 'express';
import ExcelJS from 'exceljs';
import { COLLECTIONS, readAll } from '../store.js';
import { requirePermission } from '../middleware/access.js';

/** Справочники, доступные для экспорта из Администрирования */
export const DICTIONARY_COLLECTIONS = [
  { id: 'materials', label: 'Материалы', sheet: 'Материалы' },
  { id: 'specifications', label: 'Спецификации', sheet: 'Спецификации' },
  { id: 'counterparties', label: 'Контрагенты', sheet: 'Контрагенты' },
  { id: 'lots', label: 'Партии', sheet: 'Партии' },
  { id: 'series', label: 'Серии', sheet: 'Серии' },
  { id: 'work_centers', label: 'Рабочие центры', sheet: 'Рабочие_центры' },
  { id: 'warehouses', label: 'Склады', sheet: 'Склады' },
  { id: 'planned_series_volumes', label: 'Плановые объёмы серий', sheet: 'Плановые_объёмы' },
];

const ALLOWED = new Set(DICTIONARY_COLLECTIONS.map((d) => d.id));

function flatCell(v) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function addCollectionSheet(wb, collectionId, sheetName) {
  if (!COLLECTIONS.includes(collectionId)) {
    throw new Error(`Неизвестная коллекция: ${collectionId}`);
  }
  const rows = readAll(collectionId);
  // Excel sheet name max 31 chars
  const safeName = String(sheetName || collectionId).slice(0, 31);
  const ws = wb.addWorksheet(safeName);
  if (!rows.length) {
    ws.addRow(['(пусто)']);
    return;
  }
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  ws.columns = keys.map((k) => ({ header: k, key: k, width: Math.min(28, Math.max(12, k.length + 2)) }));
  for (const row of rows) {
    const flat = {};
    for (const k of keys) flat[k] = flatCell(row[k]);
    ws.addRow(flat);
  }
  ws.getRow(1).font = { bold: true };
}

const router = Router();

router.get('/dictionaries', requirePermission('admin_export', 'read'), (_req, res) => {
  res.json(DICTIONARY_COLLECTIONS.map(({ id, label }) => ({ id, label })));
});

router.post('/export-dictionaries.xlsx', requirePermission('admin_export', 'modify'), async (req, res) => {
  try {
    const requested = Array.isArray(req.body?.collections) ? req.body.collections.map(String) : [];
    const ids = [...new Set(requested)].filter((id) => ALLOWED.has(id));
    if (!ids.length) {
      return res.status(400).json({ error: 'Выберите хотя бы один справочник' });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Vilar OP';
    wb.created = new Date();

    for (const id of ids) {
      const meta = DICTIONARY_COLLECTIONS.find((d) => d.id === id);
      addCollectionSheet(wb, id, meta?.sheet || id);
    }

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="dictionaries-${stamp}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

export default router;
