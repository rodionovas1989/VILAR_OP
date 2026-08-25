import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { ensureCollections, COLLECTIONS, readAll, getById } from './store.js';
import { crudRouter } from './routes/crud.js';
import planningRouter from './routes/planning.js';
import adminRouter from './routes/admin.js';
import documentsRouter from './routes/documents.js';
import qualityRouter from './routes/quality.js';
import reportsRouter from './routes/reports.js';
import feedbackRouter from './routes/feedback.js';
import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import { requireAuthUnlessPublic, actorId, requireCollectionAccess } from './middleware/access.js';
import { isGenericWriteClosed } from './constants/collectionAccess.js';
import * as planning from './services/planning.js';
import { warnIfDefaultAdminPassword } from './services/auth.js';
import * as loginAudit from './services/loginAudit.js';
import * as opsDebugLog from './services/opsDebugLog.js';
import { opsDebugMiddleware, opsDebugErrorHandler } from './middleware/opsDebug.js';
import {
  prepareUserCreate,
  prepareUserUpdate,
  sanitizeUser,
} from './services/users.js';
import { assertLotQualityPermission } from './constants/lotQuality.js';
import { materialHasAssayDryApplication, RECALC_METHOD_LABEL } from './constants/lotCharacteristics.js';
import { normalizeScenario, onLotCreated } from './services/scenarios.js';
import { normalizeSubstitution } from './services/substitutions.js';
import {
  assertCharacteristicCreate,
  assertCharacteristicUpdate,
  migrateParamValuesToDocuments,
} from './services/characteristics.js';
import characteristicsRouter from './routes/characteristics.js';

ensureCollections();
migrateParamValuesToDocuments();
warnIfDefaultAdminPassword();
loginAudit.compactLoginAudit();
opsDebugLog.compactOpsDebugLog();

const app = express();
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(opsDebugMiddleware);

if (
  process.env.TRUST_PROXY === '1' ||
  process.env.TRUST_PROXY === 'true' ||
  process.env.TRUST_PROXY === 'yes'
) {
  app.set('trust proxy', 1);
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', requireAuthUnlessPublic);
app.use('/api/auth', authRouter);

function assertSeriesNumberUnique(item, excludeId) {
  const number = String(item.number || '').trim();
  if (!number) throw new Error('Укажите номер серии');
  item.number = number;
  const dup = readAll('series').find((r) => r.number === number && r.id !== excludeId);
  if (dup) throw new Error('Серия с таким номером уже есть');
  return item;
}

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

function assertTechMap(item) {
  item.name = String(item.name || '').trim();
  if (!item.name) throw new Error('Укажите название техкарты');
  if (!item.workCenterId) throw new Error('Укажите рабочий центр');
  if (!getById('work_centers', item.workCenterId)) throw new Error('Рабочий центр не найден');
  return item;
}

function normalizeLot(item, excludeId) {
  if (item && 'paramValues' in item) delete item.paramValues;
  const number = String(item?.number || '').trim();
  if (!number) throw new Error('Укажите номер партии');
  item.number = number;

  const identificationNumber = String(item?.identificationNumber || '').trim();
  item.identificationNumber = identificationNumber;

  const others = readAll('lots').filter((r) => r.id !== excludeId);
  const dupNumber = others.find((r) => String(r.number || '').trim() === number);
  if (dupNumber) {
    throw new Error(`Партия с номером «${number}» уже есть`);
  }
  if (identificationNumber) {
    const dupIdn = others.find(
      (r) => String(r.identificationNumber || '').trim() === identificationNumber
    );
    if (dupIdn) {
      throw new Error(
        `Партия с идентификационным номером «${identificationNumber}» уже есть (номер ${dupIdn.number || dupIdn.id})`
      );
    }
  }
  return item;
}

function normalizeSpecLine(line) {
  const recalcMethod = line.recalcMethod === 'assay_and_dry' ? 'assay_and_dry' : 'none';
  const qtyMg = line.qtyMgPerTablet;
  return {
    id: line.id || randomUUID(),
    materialId: line.materialId,
    qtyPerUnit: Number(line.qtyPerUnit) || 0,
    qtyMgPerTablet:
      qtyMg === undefined || qtyMg === null || qtyMg === '' ? undefined : Number(qtyMg),
    componentType: line.componentType || '',
    recalcMethod,
    recalcXLabel: recalcMethod === 'assay_and_dry' ? Number(line.recalcXLabel) || 100 : null,
    recalcComment: line.recalcComment ? String(line.recalcComment) : '',
    recalcFormula: line.recalcFormula ? String(line.recalcFormula) : '',
  };
}

function assertSpecification(item) {
  item.name = String(item.name || '').trim();
  if (!item.name) throw new Error('Укажите название спецификации');
  if (!item.productMaterialId) throw new Error('Укажите продукт');
  if (!getById('materials', item.productMaterialId)) throw new Error('Продукт не найден');
  if (!item.techMapId) throw new Error('Укажите технологическую карту');
  if (!getById('tech_maps', item.techMapId)) throw new Error('Технологическая карта не найдена');
  if (!item.type) item.type = 'Основная';
  if (!item.qtyBasis) item.qtyBasis = 'per1000';
  item.lines = (Array.isArray(item.lines) ? item.lines : [])
    .filter((l) => l.materialId)
    .map(normalizeSpecLine);
  const charDefs = readAll('lot_characteristics');
  for (const line of item.lines) {
    if (line.recalcMethod !== 'assay_and_dry') continue;
    const mat = getById('materials', line.materialId);
    if (!materialHasAssayDryApplication(mat, charDefs)) {
      throw new Error(
        `Пересчёт «${RECALC_METHOD_LABEL}» для «${mat?.name || line.materialId}»: сначала назначьте применение количественного содержания и/или потери массы при высушивании в справочнике характеристик.`
      );
    }
  }
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
function applyProductionOrderUpdate(merged, current, req) {
  assertProductionOrderLinks(merged);
  const userId = actorId(req);

  if (merged.status === 'завершен') {
    const hasOpenReservations = readAll('active_reservations').some((r) => r.productionOrderId === current.id);
    const hasIssue = readAll('production_issue_documents').some(
      (d) => d.productionOrderId === current.id && d.status === 'posted'
    );
    const needsComplete = current.status !== 'завершен' || hasOpenReservations || !hasIssue;
    if (needsComplete) {
      const { order } = planning.completeOrder(current.id, userId);
      return { ...merged, status: order.status, lines: order.lines };
    }
  }

  if (merged.status === 'отменен' && current.status !== 'отменен') {
    const order = planning.cancelOrder(current.id, userId);
    return { ...merged, status: order.status, lines: order.lines };
  }

  return merged;
}

for (const name of COLLECTIONS) {
  if (name === 'feedback') continue;
  const readOnly = isGenericWriteClosed(name);
  if (name === 'production_orders') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: assertProductionOrderLinks,
        beforeUpdate: applyProductionOrderUpdate,
      })
    );
  } else if (name === 'tech_maps') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: assertTechMap,
        beforeUpdate: (merged) => assertTechMap(merged),
      })
    );
  } else if (name === 'specifications') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: assertSpecification,
        beforeUpdate: (merged) => assertSpecification(merged),
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
  } else if (name === 'substitutions') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: (item) => normalizeSubstitution(item),
        beforeUpdate: (merged) => normalizeSubstitution(merged),
      })
    );
  } else if (name === 'series') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: (item) => assertSeriesNumberUnique(item, item.id),
        beforeUpdate: (merged, current) => assertSeriesNumberUnique(merged, current.id),
      })
    );
  } else if (name === 'lot_qualities') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: (item) => {
          item.name = String(item.name || '').trim();
          if (!item.name) throw new Error('Укажите название качества');
          item.permission = assertLotQualityPermission(item.permission);
          if (item.active === undefined) item.active = true;
          return item;
        },
        beforeUpdate: (merged) => {
          merged.name = String(merged.name || '').trim();
          if (!merged.name) throw new Error('Укажите название качества');
          merged.permission = assertLotQualityPermission(merged.permission);
          return merged;
        },
      })
    );
  } else if (name === 'quality_scenarios') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: (item) => {
          const n = normalizeScenario(item);
          n.createdAt = new Date().toISOString();
          n.updatedAt = n.createdAt;
          return n;
        },
        beforeUpdate: (merged) => {
          const n = normalizeScenario(merged);
          n.updatedAt = new Date().toISOString();
          return n;
        },
      })
    );
  } else if (name === 'lot_characteristics') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: (item) => assertCharacteristicCreate(item),
        beforeUpdate: (merged, current) => assertCharacteristicUpdate(merged, current),
      })
    );
  } else if (name === 'lots') {
    app.use(
      `/api/${name}`,
      crudRouter(name, {
        beforeCreate: (item) => normalizeLot(item, item.id),
        beforeUpdate: (merged, current) => normalizeLot(merged, current.id),
        afterCreate: (lot, req) => {
          const uid = actorId(req);
          if (!uid) throw new Error('Не авторизован: нет пользователя для сценария качества');
          onLotCreated(lot, uid);
        },
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
    app.use(`/api/${name}`, crudRouter(name, { readOnly }));
  }
}

app.use('/api/planning', planningRouter);
app.use('/api/admin', adminRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/quality', qualityRouter);
app.use('/api/characteristics', characteristicsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/chat', chatRouter);

app.get('/api/export/:collection.xlsx', (req, res, next) => {
  const name = req.params.collection;
  if (!COLLECTIONS.includes(name) || name === 'feedback') {
    return res.status(404).json({ error: 'Unknown collection' });
  }
  req.exportCollection = name;
  return requireCollectionAccess(name, 'read')(req, res, next);
}, async (req, res) => {
  const name = req.exportCollection;
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (process.env.SERVE_FRONTEND === '1' && fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log(`UI from ${frontendDist}`);
}

app.use(opsDebugErrorHandler);

app.listen(PORT, () => {
  console.log(`Vilar OP API http://localhost:${PORT}`);
});
