import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import AdminExportDictionaries from './components/AdminExportDictionaries';
import { CrudPage, FieldDef } from './components/CrudPage';
import IconButton from './components/IconButton';
import PlanningDesktop from './components/PlanningDesktop';
import ProductionDesktop from './components/ProductionDesktop';
import SpecDetailTabs from './components/SpecDetailTabs';
import {
  ApprovedSupplier,
  Counterparty,
  Lot,
  Material,
  PlannedSeriesVolume,
  Series,
  SpecLine,
  Specification,
  Warehouse,
  WorkCenter,
} from './types';
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
      { id: 'warehouses', label: 'Склады' },
      { id: 'planned_series_volumes', label: 'Плановые объёмы серий' },
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
      { id: 'planning_desktop', label: 'Рабочий стол планирования' },
    ],
  },
  {
    id: 'production',
    label: 'Производство',
    items: [{ id: 'production_desktop', label: 'Управление заказами' }],
  },
  {
    id: 'admin',
    label: 'Администрирование',
    items: [{ id: 'admin_export_dictionaries', label: 'Экспорт справочников' }],
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
    production: true,
    admin: false,
  });
  const [page, setPage] = useState('planning_desktop');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [plannedVolumes, setPlannedVolumes] = useState<PlannedSeriesVolume[]>([]);

  const reloadDicts = async () => {
    const [m, c, l, s, w, wh, sp, pv] = await Promise.all([
      api.list<Material>('materials'),
      api.list<Counterparty>('counterparties'),
      api.list<Lot>('lots'),
      api.list<Series>('series'),
      api.list<WorkCenter>('work_centers'),
      api.list<Warehouse>('warehouses'),
      api.list<Specification>('specifications'),
      api.list<PlannedSeriesVolume>('planned_series_volumes'),
    ]);
    setMaterials(m);
    setCounterparties(c);
    setLots(l);
    setSeries(s);
    setWorkCenters(w);
    setWarehouses(wh);
    setSpecs(sp);
    setPlannedVolumes(pv);
  };

  useEffect(() => {
    reloadDicts().catch(console.error);
  }, [page]);

  const matName = (id: string) => materials.find((m) => m.id === id)?.name || id;
  const lotById = (id: string) => lots.find((l) => l.id === id);
  const lotNum = (id: string) => lotById(id)?.number || id;
  const serNum = (id: string) => series.find((s) => s.id === id)?.number || id;
  const wcName = (id: string) => workCenters.find((w) => w.id === id)?.name || id;
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || id;
  const cpName = (id: string) => counterparties.find((c) => c.id === id)?.name || '—';
  const lotCpName = (lotId: string) => {
    const lot = lotById(lotId);
    return lot?.counterpartyId ? cpName(lot.counterpartyId) : '—';
  };
  const lotDate = (lotId: string, field: 'productionDate' | 'expiryDate') =>
    lotById(lotId)?.[field] || '—';

  const plannedQtyFor = (materialId: unknown, workCenterId: unknown) => {
    const m = String(materialId || '');
    const w = String(workCenterId || '');
    if (!m || !w) return null;
    const row = plannedVolumes.find((p) => p.materialId === m && p.workCenterId === w);
    return row ? Number(row.quantity) : null;
  };

  const applyPlannedQuantity = (editing: Record<string, unknown>) => {
    const qty = plannedQtyFor(editing.materialId, editing.workCenterId);
    return qty == null ? {} : { quantity: qty };
  };

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
            wideModal
            fields={[
              { key: 'name', label: 'Название', required: true },
              {
                key: 'productMaterialId',
                label: 'Продукт',
                type: 'select',
                required: true,
                options: opt(materials.filter((m) => m.type === 'продукт')),
              },
              {
                key: 'type',
                label: 'Тип',
                type: 'select',
                required: true,
                defaultValue: 'Основная',
                options: [
                  { value: 'Основная', label: 'Основная' },
                  { value: 'Альтернативная', label: 'Альтернативная' },
                  { value: 'Испытания', label: 'Испытания' },
                ],
              },
              { key: 'batchSizeUnits', label: 'Размер серии (уп)', type: 'number' },
            ]}
            columns={[
              { key: 'name', label: 'Название' },
              { key: 'productMaterialId', label: 'Продукт', render: (r) => matName(String(r.productMaterialId)) },
              { key: 'type', label: 'Тип', render: (r) => String(r.type || 'Основная') },
              {
                key: 'lines',
                label: 'Компонентов',
                render: (r) => String((r.lines as unknown[])?.length ?? 0),
              },
              {
                key: 'approvedSuppliers',
                label: 'Поставщиков',
                render: (r) => String((r.approvedSuppliers as unknown[])?.length ?? 0),
              },
            ]}
            transformOut={(row) => ({
              ...row,
              type: row.type || 'Основная',
              qtyBasis: 'per1000',
              batchSizeUnits: Number(row.batchSizeUnits) || 0,
              lines: ((row.lines as SpecLine[]) || [])
                .filter((l) => l.materialId)
                .map((l) => ({
                  materialId: l.materialId,
                  qtyPerUnit: Number(l.qtyPerUnit) || 0,
                  qtyMgPerTablet:
                    l.qtyMgPerTablet === undefined || l.qtyMgPerTablet === null || String(l.qtyMgPerTablet) === ''
                      ? undefined
                      : Number(l.qtyMgPerTablet),
                  componentType: l.componentType || '',
                })),
              approvedSuppliers: ((row.approvedSuppliers as ApprovedSupplier[]) || [])
                .filter((s) => s.materialId && s.counterpartyId)
                .map((s) => ({
                  materialId: s.materialId,
                  counterpartyId: s.counterpartyId,
                })),
            })}
            formExtra={({ editing, setEditing }) => (
              <SpecDetailTabs
                lines={(editing.lines as SpecLine[]) || []}
                approvedSuppliers={(editing.approvedSuppliers as ApprovedSupplier[]) || []}
                materials={materials.filter((m) => m.type !== 'продукт')}
                counterparties={counterparties.map((c) => ({ id: c.id, name: c.name }))}
                onChangeLines={(lines) => setEditing({ ...editing, lines })}
                onChangeSuppliers={(approvedSuppliers) => setEditing({ ...editing, approvedSuppliers })}
              />
            )}
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
      case 'warehouses':
        return (
          <CrudPage
            title="Склады"
            collection="warehouses"
            fields={[
              { key: 'name', label: 'Название', required: true },
              {
                key: 'type',
                label: 'Тип',
                type: 'select',
                required: true,
                defaultValue: 'компоненты',
                options: [
                  { value: 'компоненты', label: 'компоненты' },
                  { value: 'ГП', label: 'ГП' },
                ],
              },
            ]}
            columns={[
              { key: 'name', label: 'Название' },
              { key: 'type', label: 'Тип' },
            ]}
          />
        );
      case 'planned_series_volumes':
        return (
          <CrudPage
            title="Плановые объёмы серий"
            collection="planned_series_volumes"
            fields={[
              {
                key: 'materialId',
                label: 'Материал (продукт)',
                type: 'select',
                required: true,
                options: opt(materials.filter((m) => m.type === 'продукт')),
              },
              {
                key: 'workCenterId',
                label: 'Рабочий центр',
                type: 'select',
                required: true,
                options: opt(workCenters),
              },
              { key: 'quantity', label: 'Количество', type: 'number', required: true },
            ]}
            columns={[
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'workCenterId', label: 'РЦ', render: (r) => wcName(String(r.workCenterId)) },
              { key: 'quantity', label: 'Количество' },
            ]}
            validate={(row) => {
              const materialId = String(row.materialId || '');
              const workCenterId = String(row.workCenterId || '');
              if (!materialId || !workCenterId) return 'Укажите материал и рабочий центр';
              const dup = plannedVolumes.find(
                (p) =>
                  p.materialId === materialId &&
                  p.workCenterId === workCenterId &&
                  p.id !== row.id
              );
              if (dup) return 'Для этой пары материал + РЦ запись уже есть';
              if (!(Number(row.quantity) > 0)) return 'Количество должно быть больше 0';
              return null;
            }}
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
              {
                key: 'warehouseId',
                label: 'Склад',
                type: 'select',
                required: true,
                options: opt(warehouses),
                defaultValue: warehouses.find((w) => w.type === 'компоненты')?.id || '',
              },
              { key: 'quantity', label: 'Количество', type: 'number', required: true },
            ]}
            columns={[
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'lotId', label: 'Партия', render: (r) => lotNum(String(r.lotId)) },
              {
                key: 'warehouseId',
                label: 'Склад',
                render: (r) => (r.warehouseId ? whName(String(r.warehouseId)) : '—'),
              },
              {
                key: 'lotCounterparty',
                label: 'Контрагент',
                render: (r) => lotCpName(String(r.lotId)),
              },
              {
                key: 'lotProductionDate',
                label: 'Дата производства',
                render: (r) => lotDate(String(r.lotId), 'productionDate'),
              },
              {
                key: 'lotExpiryDate',
                label: 'Срок годности',
                render: (r) => lotDate(String(r.lotId), 'expiryDate'),
              },
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
              { key: 'productionOrderId', label: 'Заказ', required: true },
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
                label: 'Материал (продукт)',
                type: 'select',
                required: true,
                options: opt(materials.filter((m) => m.type === 'продукт')),
                resets: ['seriesId', 'specificationId'],
                patchOnChange: (_value, editing) => applyPlannedQuantity(editing),
              },
              {
                key: 'seriesId',
                label: 'Серия',
                type: 'select',
                required: true,
                optionsFor: (row) =>
                  opt(
                    series
                      .filter((s) => !row.materialId || s.materialId === row.materialId)
                      .map((s) => ({ id: s.id, name: s.number }))
                  ),
                hint: (row) =>
                  !row.materialId
                    ? 'Сначала выберите продукт'
                    : series.some((s) => s.materialId === row.materialId)
                      ? null
                      : 'Нет серий для выбранного продукта',
              },
              {
                key: 'workCenterId',
                label: 'Рабочий центр',
                type: 'select',
                required: true,
                options: opt(workCenters),
                patchOnChange: (_value, editing) => applyPlannedQuantity(editing),
              },
              { key: 'startAt', label: 'Начало', type: 'datetime-local', required: true },
              { key: 'endAt', label: 'Окончание', type: 'datetime-local', required: true },
              {
                key: 'quantity',
                label: 'Количество',
                type: 'number',
                required: true,
                hint: (row) => {
                  const plan = plannedQtyFor(row.materialId, row.workCenterId);
                  if (plan == null) return 'Нет планового объёма для пары продукт + РЦ — укажите вручную';
                  return `Плановый объём: ${plan} (можно изменить)`;
                },
              },
              {
                key: 'status',
                label: 'Статус',
                type: 'select',
                defaultValue: 'новый',
                options: [
                  { value: 'новый', label: 'новый' },
                  { value: 'спланирован', label: 'спланирован' },
                  { value: 'завершен', label: 'завершен' },
                  { value: 'отменен', label: 'отменен' },
                ],
                hint: () =>
                  '«Завершен» — списание сырья, приход ГП и снятие резервов. «Отменен» — только снятие резервов.',
              },
              {
                key: 'specificationId',
                label: 'Спецификация',
                type: 'select',
                required: true,
                optionsFor: (row) =>
                  opt(specs.filter((sp) => !row.materialId || sp.productMaterialId === row.materialId)),
                hint: (row) =>
                  !row.materialId
                    ? 'Сначала выберите продукт'
                    : specs.some((sp) => sp.productMaterialId === row.materialId)
                      ? null
                      : 'Нет спецификаций для выбранного продукта',
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
              { key: 'quantity', label: 'План' },
              {
                key: 'actualQuantity',
                label: 'Факт',
                render: (r) => (r.actualQuantity != null ? String(r.actualQuantity) : '—'),
              },
              { key: 'status', label: 'Статус' },
              {
                key: 'lines',
                label: 'ТЧ план',
                render: (r) => String((r.lines as unknown[])?.length ?? 0),
              },
            ]}
            transformOut={(row) => ({
              ...row,
              lines: row.lines || [],
              actualLines: row.actualLines || [],
              status: row.status || 'новый',
            })}
            bulkStatusOptions={[
              { value: 'новый', label: 'новый' },
              { value: 'спланирован', label: 'спланирован' },
              { value: 'завершен', label: 'завершен' },
              { value: 'отменен', label: 'отменен' },
            ]}
            validate={(row) => {
              const materialId = String(row.materialId || '');
              const seriesId = String(row.seriesId || '');
              const specificationId = String(row.specificationId || '');
              if (!materialId) return 'Укажите продукт';
              const ser = series.find((s) => s.id === seriesId);
              if (!ser || ser.materialId !== materialId) {
                return 'Серия должна относиться к выбранному продукту';
              }
              const spec = specs.find((s) => s.id === specificationId);
              if (!spec || spec.productMaterialId !== materialId) {
                return 'Спецификация должна относиться к выбранному продукту';
              }
              return null;
            }}
            rowActions={(row, reload) => (
              <>
                {row.status === 'спланирован' && (row.lines as unknown[])?.length ? (
                  <IconButton
                    icon="complete"
                    label="Завершить"
                    tone="success"
                    onClick={async () => {
                      await api.completeOrder(String(row.id));
                      reload();
                    }}
                  />
                ) : null}
                {row.status !== 'завершен' && row.status !== 'отменен' ? (
                  <IconButton
                    icon="cancel"
                    label="Отменить"
                    tone="danger"
                    onClick={async () => {
                      await api.cancelOrder(String(row.id));
                      reload();
                    }}
                  />
                ) : null}
              </>
            )}
          />
        );
      case 'admin_export_dictionaries':
        return <AdminExportDictionaries />;
      case 'production_desktop':
        return (
          <ProductionDesktop
            dictionaries={{
              materials: materials.map((m) => ({ id: m.id, name: m.name })),
              series: series.map((s) => ({ id: s.id, number: s.number })),
              workCenters,
              lots: lots.map((l) => ({
                id: l.id,
                number: l.number,
                materialId: l.materialId,
                counterpartyId: l.counterpartyId,
              })),
              counterparties: counterparties.map((c) => ({ id: c.id, name: c.name })),
            }}
          />
        );
      case 'planning_desktop':
      default:
        return (
          <PlanningDesktop
            dictionaries={{
              materials: materials.map((m) => ({ id: m.id, name: m.name, type: m.type })),
              series: series.map((s) => ({ id: s.id, number: s.number })),
              workCenters,
              lots: lots.map((l) => ({
                id: l.id,
                number: l.number,
                materialId: l.materialId,
                counterpartyId: l.counterpartyId,
              })),
              counterparties: counterparties.map((c) => ({ id: c.id, name: c.name })),
              specifications: specs.map((s) => ({
                id: s.id,
                approvedSuppliers: s.approvedSuppliers || [],
              })),
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
