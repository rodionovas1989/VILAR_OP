import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { CrudPage, FieldDef } from './components/CrudPage';
import PlanningDesktop from './components/PlanningDesktop';
import { Counterparty, Lot, Material, Series, Specification, WorkCenter } from './types';
import './App.css';

type NavItem = { id: string; label: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    id: 'refs',
    label: 'Справочники',
    items: [
      { id: 'materials', label: 'Материалы' },
      { id: 'specifications', label: 'Спецификации' },
      { id: 'counterparties', label: 'Контрагенты' },
      { id: 'lots', label: 'Партии' },
      { id: 'series', label: 'Серии' },
      { id: 'work_centers', label: 'Рабочие центры' },
    ],
  },
  {
    id: 'stock',
    label: 'Запасы',
    items: [
      { id: 'stock', label: 'Запасы' },
      { id: 'reservations', label: 'Резервирование' },
      { id: 'material_movements', label: 'Движение материалов' },
    ],
  },
  {
    id: 'plan',
    label: 'Планирование',
    items: [
      { id: 'production_orders', label: 'Заказы на производство' },
      { id: 'production_plans', label: 'Планы производства' },
      { id: 'planning_desktop', label: 'Рабочий стол планирования' },
    ],
  },
];

function opt(list: { id: string; name?: string; number?: string }[]) {
  return list.map((x) => ({ value: x.id, label: x.name || x.number || x.id }));
}

export default function App() {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    refs: true,
    stock: false,
    plan: true,
  });
  const [page, setPage] = useState('planning_desktop');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [specs, setSpecs] = useState<Specification[]>([]);

  const reloadDicts = async () => {
    const [m, c, l, s, w, sp] = await Promise.all([
      api.list<Material>('materials'),
      api.list<Counterparty>('counterparties'),
      api.list<Lot>('lots'),
      api.list<Series>('series'),
      api.list<WorkCenter>('work_centers'),
      api.list<Specification>('specifications'),
    ]);
    setMaterials(m);
    setCounterparties(c);
    setLots(l);
    setSeries(s);
    setWorkCenters(w);
    setSpecs(sp);
  };

  useEffect(() => {
    reloadDicts().catch(console.error);
  }, [page]);

  const matName = (id: string) => materials.find((m) => m.id === id)?.name || id;
  const lotNum = (id: string) => lots.find((l) => l.id === id)?.number || id;
  const serNum = (id: string) => series.find((s) => s.id === id)?.number || id;
  const wcName = (id: string) => workCenters.find((w) => w.id === id)?.name || id;
  const cpName = (id: string) => counterparties.find((c) => c.id === id)?.name || '—';

  const materialFields: FieldDef[] = useMemo(
    () => [
      { key: 'name', label: 'Название', required: true },
      {
        key: 'type',
        label: 'Тип',
        type: 'select',
        required: true,
        options: [
          { value: 'продукт', label: 'продукт' },
          { value: 'полуфабрикат', label: 'полуфабрикат' },
          { value: 'основной компонент', label: 'основной компонент' },
          { value: 'вспомогательный компонент', label: 'вспомогательный компонент' },
        ],
      },
      { key: 'unit', label: 'Ед. изм.', required: true },
    ],
    []
  );

  const content = (() => {
    switch (page) {
      case 'materials':
        return (
          <CrudPage
            title="Материалы"
            collection="materials"
            fields={materialFields}
            columns={[
              { key: 'name', label: 'Название' },
              { key: 'type', label: 'Тип' },
              { key: 'unit', label: 'Ед.' },
            ]}
          />
        );
      case 'specifications':
        return (
          <CrudPage
            title="Спецификации"
            collection="specifications"
            fields={[
              { key: 'name', label: 'Название', required: true },
              {
                key: 'productMaterialId',
                label: 'Продукт',
                type: 'select',
                required: true,
                options: opt(materials.filter((m) => m.type === 'продукт')),
              },
              { key: 'batchSizeUnits', label: 'Размер серии (уп)', type: 'number' },
            ]}
            columns={[
              { key: 'name', label: 'Название' },
              { key: 'productMaterialId', label: 'Продукт', render: (r) => matName(String(r.productMaterialId)) },
              {
                key: 'lines',
                label: 'Компонентов',
                render: (r) => String((r.lines as unknown[])?.length ?? 0),
              },
            ]}
          />
        );
      case 'counterparties':
        return (
          <CrudPage
            title="Контрагенты"
            collection="counterparties"
            fields={[{ key: 'name', label: 'Название', required: true }]}
            columns={[{ key: 'name', label: 'Название' }]}
          />
        );
      case 'lots':
        return (
          <CrudPage
            title="Партии"
            collection="lots"
            fields={[
              { key: 'number', label: 'Номер', required: true },
              { key: 'materialId', label: 'Материал', type: 'select', required: true, options: opt(materials) },
              {
                key: 'counterpartyId',
                label: 'Контрагент',
                type: 'select',
                options: opt(counterparties),
              },
              { key: 'productionDate', label: 'Дата производства', type: 'date', required: true },
              { key: 'expiryDate', label: 'Срок годности', type: 'date', required: true },
            ]}
            columns={[
              { key: 'number', label: 'Номер' },
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              {
                key: 'counterpartyId',
                label: 'Контрагент',
                render: (r) => (r.counterpartyId ? cpName(String(r.counterpartyId)) : '—'),
              },
              { key: 'productionDate', label: 'Произведено' },
              { key: 'expiryDate', label: 'Годен до' },
            ]}
          />
        );
      case 'series':
        return (
          <CrudPage
            title="Серии"
            collection="series"
            fields={[
              { key: 'number', label: 'Номер', required: true },
              {
                key: 'materialId',
                label: 'Материал (продукт)',
                type: 'select',
                required: true,
                options: opt(materials.filter((m) => m.type === 'продукт')),
              },
            ]}
            columns={[
              { key: 'number', label: 'Номер' },
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
            ]}
          />
        );
      case 'work_centers':
        return (
          <CrudPage
            title="Рабочие центры"
            collection="work_centers"
            fields={[{ key: 'name', label: 'Название', required: true }]}
            columns={[{ key: 'name', label: 'Название' }]}
          />
        );
      case 'stock':
        return (
          <CrudPage
            title="Запасы"
            collection="stock"
            fields={[
              { key: 'materialId', label: 'Материал', type: 'select', required: true, options: opt(materials) },
              { key: 'lotId', label: 'Партия', type: 'select', required: true, options: opt(lots.map((l) => ({ id: l.id, name: l.number }))) },
              { key: 'quantity', label: 'Количество', type: 'number', required: true },
            ]}
            columns={[
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'lotId', label: 'Партия', render: (r) => lotNum(String(r.lotId)) },
              { key: 'quantity', label: 'Кол-во' },
            ]}
          />
        );
      case 'reservations':
        return (
          <CrudPage
            title="Резервирование запасов"
            collection="reservations"
            fields={[
              { key: 'productionOrderId', label: 'План / заказ', required: true },
              { key: 'materialId', label: 'Материал', type: 'select', required: true, options: opt(materials) },
              { key: 'quantity', label: 'Количество', type: 'number', required: true },
              { key: 'lotId', label: 'Партия', type: 'select', required: true, options: opt(lots.map((l) => ({ id: l.id, name: l.number }))) },
              { key: 'seriesId', label: 'Серия', type: 'select', required: true, options: opt(series.map((s) => ({ id: s.id, name: s.number }))) },
            ]}
            columns={[
              { key: 'productionOrderId', label: 'Заказ' },
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'lotId', label: 'Партия', render: (r) => lotNum(String(r.lotId)) },
              { key: 'seriesId', label: 'Серия', render: (r) => serNum(String(r.seriesId)) },
              { key: 'quantity', label: 'Кол-во' },
            ]}
          />
        );
      case 'material_movements':
        return (
          <CrudPage
            title="Движение материалов"
            collection="material_movements"
            fields={[
              { key: 'materialId', label: 'Материал', type: 'select', required: true, options: opt(materials) },
              { key: 'lotId', label: 'Партия', type: 'select', required: true, options: opt(lots.map((l) => ({ id: l.id, name: l.number }))) },
              { key: 'seriesId', label: 'Серия', type: 'select', options: opt(series.map((s) => ({ id: s.id, name: s.number }))) },
              { key: 'quantity', label: 'Количество (+/−)', type: 'number', required: true },
              { key: 'type', label: 'Тип', type: 'select', options: [
                { value: 'issue', label: 'issue' },
                { value: 'receipt', label: 'receipt' },
              ]},
            ]}
            columns={[
              { key: 'at', label: 'Дата' },
              { key: 'type', label: 'Тип' },
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'lotId', label: 'Партия', render: (r) => lotNum(String(r.lotId)) },
              { key: 'seriesId', label: 'Серия', render: (r) => (r.seriesId ? serNum(String(r.seriesId)) : '—') },
              { key: 'quantity', label: 'Кол-во' },
            ]}
          />
        );
      case 'production_orders':
        return (
          <CrudPage
            title="Заказы на производство"
            collection="production_orders"
            fields={[
              {
                key: 'materialId',
                label: 'Материал',
                type: 'select',
                required: true,
                options: opt(materials.filter((m) => m.type === 'продукт')),
              },
              {
                key: 'seriesId',
                label: 'Серия',
                type: 'select',
                required: true,
                options: opt(series.map((s) => ({ id: s.id, name: s.number }))),
              },
              {
                key: 'workCenterId',
                label: 'Рабочий центр',
                type: 'select',
                required: true,
                options: opt(workCenters),
              },
              { key: 'startAt', label: 'Начало', type: 'datetime-local', required: true },
              { key: 'endAt', label: 'Окончание', type: 'datetime-local', required: true },
              { key: 'quantity', label: 'Количество', type: 'number', required: true },
              {
                key: 'status',
                label: 'Статус',
                type: 'select',
                options: [
                  { value: 'новый', label: 'новый' },
                  { value: 'спланирован', label: 'спланирован' },
                  { value: 'завершен', label: 'завершен' },
                  { value: 'отменен', label: 'отменен' },
                ],
              },
              {
                key: 'specificationId',
                label: 'Спецификация',
                type: 'select',
                options: opt(specs),
              },
            ]}
            columns={[
              { key: 'materialId', label: 'Продукт', render: (r) => matName(String(r.materialId)) },
              { key: 'seriesId', label: 'Серия', render: (r) => serNum(String(r.seriesId)) },
              { key: 'workCenterId', label: 'РЦ', render: (r) => wcName(String(r.workCenterId)) },
              {
                key: 'startAt',
                label: 'Начало',
                render: (r) => new Date(String(r.startAt)).toLocaleString(),
              },
              { key: 'status', label: 'Статус' },
              {
                key: 'lines',
                label: 'ТЧ',
                render: (r) => String((r.lines as unknown[])?.length ?? 0),
              },
            ]}
            transformOut={(row) => ({ ...row, lines: row.lines || [] })}
            rowActions={(row, reload) => (
              <>
                {row.status === 'спланирован' && (row.lines as unknown[])?.length ? (
                  <button
                    type="button"
                    className="link"
                    onClick={async () => {
                      await api.completeOrder(String(row.id));
                      reload();
                    }}
                  >
                    Завершить
                  </button>
                ) : null}
                {row.status !== 'завершен' && row.status !== 'отменен' ? (
                  <button
                    type="button"
                    className="link"
                    onClick={async () => {
                      await api.cancelOrder(String(row.id));
                      reload();
                    }}
                  >
                    Отменить
                  </button>
                ) : null}
              </>
            )}
          />
        );
      case 'production_plans':
        return (
          <CrudPage
            title="Планы производства"
            collection="production_orders"
            fields={[
              {
                key: 'materialId',
                label: 'Материал',
                type: 'select',
                options: opt(materials.filter((m) => m.type === 'продукт')),
              },
              { key: 'status', label: 'Статус', type: 'select', options: [
                { value: 'спланирован', label: 'спланирован' },
                { value: 'завершен', label: 'завершен' },
              ]},
            ]}
            columns={[
              { key: 'materialId', label: 'Продукт', render: (r) => matName(String(r.materialId)) },
              { key: 'seriesId', label: 'Серия', render: (r) => serNum(String(r.seriesId)) },
              { key: 'status', label: 'Статус' },
              {
                key: 'lines',
                label: 'Резерв (строк)',
                render: (r) => {
                  const lines = (r.lines as { materialId: string; lotId: string; quantity: number }[]) || [];
                  if (!lines.length) return '0';
                  return lines
                    .map((l) => `${matName(l.materialId)} / ${lotNum(l.lotId)} = ${l.quantity}`)
                    .join('; ');
                },
              },
            ]}
          />
        );
      case 'planning_desktop':
      default:
        return (
          <PlanningDesktop
            dictionaries={{
              materials,
              series: series.map((s) => ({ id: s.id, number: s.number })),
              workCenters,
              lots,
            }}
          />
        );
    }
  })();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">ВИЛАР</div>
          <div className="brand-sub">Оперативное планирование</div>
        </div>
        <nav>
          {NAV.map((g) => (
            <div key={g.id} className="nav-group">
              <button
                type="button"
                className="nav-group-title"
                onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !s[g.id] }))}
              >
                <span>{g.label}</span>
                <span>{openGroups[g.id] ? '▾' : '▸'}</span>
              </button>
              {openGroups[g.id] && (
                <ul>
                  {g.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={page === item.id ? 'nav-item active' : 'nav-item'}
                        onClick={() => setPage(item.id)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </aside>
      <main className="content">{content}</main>
    </div>
  );
}
