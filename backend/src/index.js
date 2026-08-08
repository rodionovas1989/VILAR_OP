import express from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs';
import { ensureCollections, COLLECTIONS, readAll } from './store.js';
import { crudRouter } from './routes/crud.js';
import planningRouter from './routes/planning.js';

ensureCollections();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

for (const name of COLLECTIONS) {
  app.use(`/api/${name}`, crudRouter(name));
}

app.use('/api/planning', planningRouter);

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
