import { Router } from 'express';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { COLLECTIONS, readAll } from '../store.js';
import { requirePermission } from '../middleware/access.js';
import * as dataMaintenance from '../services/dataMaintenance.js';
import * as loginAudit from '../services/loginAudit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Справочники, доступные для экспорта из Администрирования */
export const DICTIONARY_COLLECTIONS = [
  { id: 'materials', label: 'Материалы', sheet: 'Материалы' },
  { id: 'specifications', label: 'Спецификации', sheet: 'Спецификации' },
  { id: 'counterparties', label: 'Контрагенты', sheet: 'Контрагенты' },
  { id: 'lots', label: 'Партии', sheet: 'Партии' },
  { id: 'series', label: 'Серии', sheet: 'Серии' },
  { id: 'work_centers', label: 'Рабочие центры', sheet: 'Рабочие_центры' },
  { id: 'tech_maps', label: 'Технологические карты', sheet: 'Техкарты' },
  { id: 'warehouses', label: 'Склады', sheet: 'Склады' },
  { id: 'planned_series_volumes', label: 'Плановые объёмы серий', sheet: 'Плановые_объёмы' },
  { id: 'substitutions', label: 'Аналоги', sheet: 'Аналоги' },
  { id: 'lot_characteristics', label: 'Характеристики партий', sheet: 'Характеристики_партий' },
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

function assertConfirm(body, expected) {
  const got = String(body?.confirm || '').trim();
  if (got !== expected) {
    throw new Error(`Для подтверждения введите ${expected}`);
  }
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

router.get('/backups', requirePermission('admin_data_maintenance', 'read'), (_req, res) => {
  try {
    res.json(dataMaintenance.listBackups());
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/backups', requirePermission('admin_data_maintenance', 'create'), (req, res) => {
  try {
    res.status(201).json(
      dataMaintenance.createBackup({
        label: req.body?.label,
        reason: 'manual',
      })
    );
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/backups/:id/restore', requirePermission('admin_data_maintenance', 'modify'), (req, res) => {
  try {
    assertConfirm(req.body, 'RESTORE');
    res.json(dataMaintenance.restoreBackup(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.delete('/backups/:id', requirePermission('admin_data_maintenance', 'modify'), (req, res) => {
  try {
    res.json(dataMaintenance.deleteBackup(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/data/clear', requirePermission('admin_data_maintenance', 'modify'), (req, res) => {
  try {
    assertConfirm(req.body, 'CLEAR');
    res.json(dataMaintenance.clearAllData());
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/data/demo', requirePermission('admin_data_maintenance', 'modify'), (req, res) => {
  try {
    assertConfirm(req.body, 'DEMO');
    res.json(dataMaintenance.loadDemoData());
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.post('/data/customer-recipes', requirePermission('admin_data_maintenance', 'modify'), (req, res) => {
  try {
    assertConfirm(req.body, 'RECIPES');
    res.json(dataMaintenance.loadCustomerRecipes());
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.get('/backups/:id/download', requirePermission('admin_data_maintenance', 'read'), (req, res) => {
  try {
    const filePath = dataMaintenance.getBackupSqlitePath(req.params.id);
    const name = `vilar-backup-${req.params.id}.sqlite`;
    res.download(filePath, name);
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.get('/login-audit', requirePermission('admin_login_audit', 'read'), (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    res.json({ items: loginAudit.listLoginAttempts({ limit }) });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

router.get('/changelog', requirePermission('admin_changelog', 'read'), (_req, res) => {
  try {
    const changelogPath = path.join(__dirname, '..', '..', '..', 'docs', 'CHANGELOG.md');
    if (!fs.existsSync(changelogPath)) {
      return res.json({ markdown: '# Changelog\n\nФайл docs/CHANGELOG.md пока отсутствует.\n' });
    }
    res.json({ markdown: fs.readFileSync(changelogPath, 'utf8') });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

export default router;
