import express from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs';
import { ensureCollections, COLLECTIONS, readAll, getById } from './store.js';
import { crudRouter } from './routes/crud.js';
import planningRouter from './routes/planning.js';
import adminRouter from './routes/admin.js';
import documentsRouter from './routes/documents.js';
import qualityRouter from './routes/quality.js';
import authRouter from './routes/auth.js';
import * as planning from './services/planning.js';
import {
  prepareUserCreate,
  prepareUserUpdate,
  sanitizeUser,
} from './services/users.js';

ensureCollections();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);

function assertPlannedVolumeUnique(item, excludeId) {
  const materialId = item.materialId;
  const workCenterId = item.workCenterId;
  if (!materialId || !workCenterId) throw new Error('Укажите материал и рабочий центр');
  if (!(Number(item.quantity) > 0)) throw new Error('Количество должно быть больше 0');
  const dup = readAll('planned_series_volumes').find(
    (r) => r.materialId === materialId && r.workCenterId === workCenterId && r.id !== excludeId
  );
  if (dup) throw new Error('Для этой пары материал + РЦ запись уже есть');
  return item;
}

function assertProductionOrderLinks(item) {
  const materialId = item.materialId;
  if (!materialId) throw new Error('Укажите продукт заказа');

  if (item.seriesId) {
    const ser = getById('series', item.seriesId);
    if (!ser || ser.materialId !== materialId) {
      throw new Error('Серия должна относиться к выбранному продукту');
    }
  }

  if (item.specificationId) {
    const spec = getById('specifications', item.specificationId);
    if (!spec || spec.productMaterialId !== materialId) {
      throw new Error('Спецификация должна относиться к выбранному продукту');
    }
  }

  if (!item.status) item.status = 'новый';
  if (!Array.isArray(item.lines)) item.lines = [];

  return item;
}

/** Переход в «завершен»/«отменен» — через складскую логику, а не голый статус */
function applyProductionOrderUpdate(merged, current) {
  assertProductionOrderLinks(merged);

  if (merged.status === 'завершен') {
    const hasOpenReservations = readAll('reservations').some((r) => r.productionOrderId === current.id);
    const hasIssue = readAll('material_movements').some(
      (m) => m.productionOrderId === current.id && m.type === 'issue'
    );
    const needsComplete = current.status !== 'завершен' || hasOpenReservations || !hasIssue;
    if (needsComplete) {
      const { order } = planning.completeOrder(current.id);
      return { ...merged, status: order.status, lines: order.lines };
    }
  }

  if (merged.status === 'отменен' && current.status !== 'отменен') {
    const order = planning.cancelOrder(current.id);
    return { ...merged, status: order.status, lines: order.lines };
  }

  return merged;
}

for (const name of COLLECTIONS) {
  if (name === 'production_orders') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: assertProductionOrderLinks,
        beforeUpdate: applyProductionOrderUpdate,
      })
    );
  } else if (name === 'planned_series_volumes') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: (item) => assertPlannedVolumeUnique(item, item.id),
        beforeUpdate: (merged, current) => assertPlannedVolumeUnique(merged, current.id),
      })
    );
  } else if (name === 'users') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: (item) => {
          item._allUsers = readAll('users');
          return prepareUserCreate(item);
        },
        beforeUpdate: (merged, current) => {
          const login = merged.login ?? current.login;
          const dup = readAll('users').find((u) => u.login === login && u.id !== current.id);
          if (dup) throw new Error('Пользователь с таким логином уже есть');
          return prepareUserUpdate(merged, current);
        },
        sanitize: sanitizeUser,
      })
    );
  } else {
    app.use(`/api/${name}`, crudRouter(name));
  }
}

app.use('/api/planning', planningRouter);
app.use('/api/admin', adminRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/quality', qualityRouter);

app.get('/api/export/:collection.xlsx', async (req, res) => {
  const name = req.params.collection;
  if (!COLLECTIONS.includes(name)) return res.status(404).json({ error: 'Unknown collection' });
  const rows = readAll(name);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name);
  if (rows.length) {
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    ws.columns = keys.map((k) => ({ header: k, key: k, width: 20 }));
    for (const row of rows) {
      const flat = {};
      for (const k of keys) {
        const v = row[k];
        flat[k] = typeof v === 'object' ? JSON.stringify(v) : v;
      }
      ws.addRow(flat);
    }
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Vilar OP API http://localhost:${PORT}`);
});
