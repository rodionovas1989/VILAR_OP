import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { api } from './api';
import { canAccessPage, filterNavByPermissions } from './auth/navAccess';
import { useAuth } from './auth/AuthContext';
import AccessDenied from './components/AccessDenied';
import AdminExportDictionaries from './components/AdminExportDictionaries';
import AdminDataMaintenance from './components/AdminDataMaintenance';
import AdminLoginAuditPage from './components/AdminLoginAuditPage';
import AdminChangelogPage from './components/AdminChangelogPage';
import AppHeader from './components/AppHeader';
import AuthGate from './components/AuthGate';
import RecentObjectsStrip from './components/RecentObjectsStrip';
import PdnAcceptGate from './components/PdnAcceptGate';
import LegalDocumentsPage from './components/LegalDocumentsPage';
import HomePage from './components/HomePage';
import LoginModal from './components/LoginModal';
import QualityManagementPage from './components/QualityManagementPage';
import DocumentTypePage from './components/DocumentTypePage';
import { CrudPage, FieldDef } from './components/CrudPage';
import ProductionOrderPage from './components/ProductionOrderPage';
import ProductionDesktop from './components/ProductionDesktop';
import PlanningDesktop from './components/PlanningDesktop';
import SeriesPlanningPage from './components/SeriesPlanningPage';
import ReleasedSeriesReportPage from './components/ReleasedSeriesReportPage';
import PlanFactReportPage from './components/PlanFactReportPage';
import StockReportPage from './components/StockReportPage';
import QualityStockReportPage from './components/QualityStockReportPage';
import QualityHistoryReportPage from './components/QualityHistoryReportPage';
import QualityScenariosPage from './components/QualityScenariosPage';
import FeedbackPage from './components/FeedbackPage';
import UserGuidePage from './components/UserGuidePage';
import { ADMIN_USERS_PDN_HINT, SYSTEM_DISCLAIMER } from './content/legal';
import RolesPage from './components/RolesPage';
import { dateFromIso, displayTimeFromIso } from './utils/docDateTime';
import SpecDetailTabs from './components/SpecDetailTabs';
import SubstitutionForm from './components/SubstitutionForm';
import CharacteristicForm from './components/CharacteristicForm';
import CharacteristicManagementPage from './components/CharacteristicManagementPage';
import {
  ApprovedSupplier,
  Counterparty,
  Lot,
  LotCharacteristic,
  Manufacturer,
  Material,
  PlannedSeriesVolume,
  Series,
  SpecLine,
  Specification,
  Substitution,
  TechMap,
  Warehouse,
  WorkCenter,
} from './types';
import { StockDocumentType } from './types.documents';
import { Role } from './constants/systemObjects';
import { NAV } from './constants/navConfig';

function opt(list: { id: string; name?: string; number?: string }[]) {
  return list.map((x) => ({ value: x.id, label: x.name || x.number || x.id }));
}

export default function App() {
  const { user, loading: authLoading, needsPdnAccept } = useAuth();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [page, setPage] = useState('home');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [techMaps, setTechMaps] = useState<TechMap[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [plannedVolumes, setPlannedVolumes] = useState<PlannedSeriesVolume[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [lotCharacteristics, setLotCharacteristics] = useState<LotCharacteristic[]>([]);
  const [lotQualities, setLotQualities] = useState<
    { id: string; name: string; permission: string; active?: boolean; comment?: string }[]
  >([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const contentRef = useRef<HTMLElement>(null);

  const navigateTo = (pageId: string) => {
    setPage(pageId);
    if (pageId !== 'home') {
      const group = NAV.find((g) => g.items.some((item) => item.id === pageId));
      if (group) setOpenGroupId(group.id);
    }
    requestAnimationFrame(() => {
      contentRef.current
        ?.querySelectorAll('.table-wrap, .matrix-wrap')
        .forEach((el) => {
          el.scrollTop = 0;
        });
    });
  };

  const visibleNav = useMemo(
    () => filterNavByPermissions(NAV, user?.permissions, Boolean(user)),
    [user]
  );

  useEffect(() => {
    if (authLoading) return;
    if (canAccessPage(page, user?.permissions, Boolean(user))) return;
    const first = visibleNav.flatMap((g) => g.items)[0];
    if (first) setPage(first.id);
  }, [authLoading, user, page, visibleNav]);

  const reloadDicts = async () => {
    const listOrEmpty = <T,>(name: string) => api.list<T>(name).catch(() => [] as T[]);
    const [m, c, mf, l, s, w, tm, wh, sp, pv, rl, lq, sub, lp] = await Promise.all([
      listOrEmpty<Material>('materials'),
      listOrEmpty<Counterparty>('counterparties'),
      listOrEmpty<Manufacturer>('manufacturers'),
      listOrEmpty<Lot>('lots'),
      listOrEmpty<Series>('series'),
      listOrEmpty<WorkCenter>('work_centers'),
      listOrEmpty<TechMap>('tech_maps'),
      listOrEmpty<Warehouse>('warehouses'),
      listOrEmpty<Specification>('specifications'),
      listOrEmpty<PlannedSeriesVolume>('planned_series_volumes'),
      listOrEmpty<Role>('roles'),
      listOrEmpty<{ id: string; name: string; permission: string; active?: boolean; comment?: string }>(
        'lot_qualities'
      ),
      listOrEmpty<Substitution>('substitutions'),
      listOrEmpty<LotCharacteristic>('lot_characteristics'),
    ]);
    setMaterials(m);
    setCounterparties(c);
    setManufacturers(mf);
    setLots(l);
    setSeries(s);
    setWorkCenters(w);
    setTechMaps(tm);
    setWarehouses(wh);
    setSpecs(sp);
    setPlannedVolumes(pv);
    setSubstitutions(sub);
    setLotCharacteristics(lp);
    setRoles(rl);
    setLotQualities(lq);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    reloadDicts().catch(console.error);
  }, [page, user, authLoading]);

  const matName = (id: string) => materials.find((m) => m.id === id)?.name || id;
  const lotById = (id: string) => lots.find((l) => l.id === id);
  const lotNum = (id: string) => lotById(id)?.number || id;
  const serNum = (id: string) => series.find((s) => s.id === id)?.number || id;
  const wcName = (id: string) => workCenters.find((w) => w.id === id)?.name || id;
  const tmName = (id: string) => techMaps.find((t) => t.id === id)?.name || id;
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name || id;
  const cpName = (id: string) => counterparties.find((c) => c.id === id)?.name || '—';
  const mfrName = (id: string) => manufacturers.find((m) => m.id === id)?.name || '—';
  const lotCpName = (lotId: string) => {
    const lot = lotById(lotId);
    return lot?.counterpartyId ? cpName(lot.counterpartyId) : '—';
  };
  const lotDate = (lotId: string, field: 'productionDate' | 'expiryDate') =>
    lotById(lotId)?.[field] || '—';

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

  const pageContent = (() => {
    if (page === 'home') {
      return <HomePage onNavigate={navigateTo} />;
    }
    if (page.startsWith('doc_')) {
      const documentType = page.slice(4) as StockDocumentType;
      return (
        <DocumentTypePage
          documentType={documentType}
          materials={materials}
          lots={lots}
          warehouses={warehouses}
        />
      );
    }
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
            hideFormFields
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
              {
                key: 'techMapId',
                label: 'Техкарта',
                type: 'select',
                required: true,
                options: opt(techMaps),
              },
            ]}
            columns={[
              { key: 'name', label: 'Название' },
              { key: 'productMaterialId', label: 'Продукт', render: (r) => matName(String(r.productMaterialId)) },
              { key: 'type', label: 'Тип', render: (r) => String(r.type || 'Основная') },
              {
                key: 'techMapId',
                label: 'Техкарта',
                render: (r) => (r.techMapId ? tmName(String(r.techMapId)) : '—'),
              },
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
              techMapId: row.techMapId || null,
              qtyBasis: 'per1000',
              lines: ((row.lines as SpecLine[]) || [])
                .filter((l) => l.materialId)
                .map((l) => ({
                  id: l.id,
                  materialId: l.materialId,
                  qtyPerUnit: Number(l.qtyPerUnit) || 0,
                  qtyMgPerTablet:
                    l.qtyMgPerTablet === undefined || l.qtyMgPerTablet === null || String(l.qtyMgPerTablet) === ''
                      ? undefined
                      : Number(l.qtyMgPerTablet),
                  componentType: l.componentType || '',
                  recalcMethod: l.recalcMethod === 'assay_and_dry' ? 'assay_and_dry' : 'none',
                  recalcXLabel:
                    l.recalcMethod === 'assay_and_dry'
                      ? l.recalcXLabel == null || String(l.recalcXLabel) === ''
                        ? 100
                        : Number(l.recalcXLabel)
                      : null,
                  recalcComment: l.recalcComment || '',
                  recalcFormula: l.recalcFormula || '',
                })),
              approvedSuppliers: ((row.approvedSuppliers as ApprovedSupplier[]) || [])
                .filter((s) => s.materialId && s.counterpartyId && s.manufacturerId)
                .map((s) => ({
                  materialId: s.materialId,
                  counterpartyId: s.counterpartyId,
                  manufacturerId: s.manufacturerId,
                })),
            })}
            formExtra={({ editing, setEditing }) => (
              <SpecDetailTabs
                editing={editing}
                setEditing={setEditing}
                productMaterials={materials.filter((m) => m.type === 'продукт').map((m) => ({ id: m.id, name: m.name }))}
                materials={materials.filter((m) => m.type !== 'продукт')}
                counterparties={counterparties.map((c) => ({ id: c.id, name: c.name }))}
                manufacturers={manufacturers.map((m) => ({ id: m.id, name: m.name }))}
                techMaps={techMaps.map((t) => ({ id: t.id, name: t.name }))}
                characteristics={lotCharacteristics}
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
      case 'manufacturers':
        return (
          <CrudPage
            title="Производители"
            collection="manufacturers"
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
              {
                key: 'manufacturerId',
                label: 'Производитель',
                type: 'select',
                options: opt(manufacturers),
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
              {
                key: 'manufacturerId',
                label: 'Производитель',
                render: (r) => (r.manufacturerId ? mfrName(String(r.manufacturerId)) : '—'),
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
      case 'tech_maps':
        return (
          <CrudPage
            title="Технологические карты"
            collection="tech_maps"
            fields={[
              { key: 'name', label: 'Название', required: true },
              {
                key: 'workCenterId',
                label: 'Рабочий центр',
                type: 'select',
                required: true,
                options: opt(workCenters),
              },
            ]}
            columns={[
              { key: 'name', label: 'Название' },
              { key: 'workCenterId', label: 'РЦ', render: (r) => wcName(String(r.workCenterId)) },
            ]}
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
      case 'substitutions':
        return (
          <CrudPage
            title="Аналоги"
            collection="substitutions"
            wideModal
            hideFormFields
            fields={[
              { key: 'name', label: 'Название' },
              {
                key: 'baseMaterialId',
                label: 'Базовый материал',
                type: 'select',
                required: true,
                options: opt(materials.filter((m) => m.type !== 'продукт')),
              },
            ]}
            columns={[
              { key: 'name', label: 'Название' },
              {
                key: 'baseMaterialId',
                label: 'Базовый материал',
                render: (r) => matName(String(r.baseMaterialId)),
              },
              {
                key: 'lines',
                label: 'Аналогов',
                render: (r) => String(((r.lines as unknown[]) || []).length),
              },
              {
                key: 'specificationId',
                label: 'Спецификация',
                render: (r) => (r.specificationId ? String(specs.find((s) => s.id === r.specificationId)?.name || r.specificationId) : 'Все'),
              },
              {
                key: 'bidirectional',
                label: 'Двусторонняя',
                render: (r) => (r.bidirectional === false ? 'нет' : 'да'),
              },
              {
                key: 'active',
                label: 'Действует',
                render: (r) => (r.active === false ? 'нет' : 'да'),
              },
            ]}
            transformOut={(row) => ({
              ...row,
              name: String(row.name || '').trim(),
              baseMaterialId: row.baseMaterialId || null,
              specificationId: row.specificationId || null,
              bidirectional: row.bidirectional !== false,
              active: row.active !== false,
              lines: (((row.lines as Substitution['lines']) || []) as Substitution['lines'])
                .filter((l) => l.materialId)
                .map((l, idx) => ({
                  materialId: l.materialId,
                  factor: Number(l.factor) > 0 ? Number(l.factor) : 1,
                  priority: Number(l.priority) || idx + 1,
                })),
            })}
            formExtra={({ editing, setEditing }) => (
              <SubstitutionForm
                editing={editing}
                setEditing={setEditing}
                materials={materials.filter((m) => m.type !== 'продукт').map((m) => ({ id: m.id, name: m.name }))}
                specifications={specs.map((s) => ({ id: s.id, name: s.name }))}
              />
            )}
          />
        );
      case 'lot_characteristics':
        return (
          <CrudPage
            title="Характеристики партий"
            collection="lot_characteristics"
            wideModal
            hideFormFields
            fields={[
              { key: 'code', label: 'Код', required: true },
              { key: 'name', label: 'Название', required: true },
            ]}
            columns={[
              { key: 'code', label: 'Код' },
              { key: 'name', label: 'Название' },
              {
                key: 'kind',
                label: 'Вид',
                render: (r) => (r.kind === 'system' ? 'системная' : 'пользовательская'),
              },
              { key: 'unit', label: 'Ед.' },
              {
                key: 'required',
                label: 'Обяз.',
                render: (r) => (r.required ? 'да' : 'нет'),
              },
              {
                key: 'application',
                label: 'Применение',
                render: (r) => {
                  const ids = (r.materialIds as string[] | undefined) || [];
                  const types = (r.materialTypes as string[] | undefined) || [];
                  if (!ids.length && !types.length) return 'не назначено';
                  const bits: string[] = [];
                  if (types.length) bits.push(types.join(', '));
                  if (ids.length) bits.push(`${ids.length} мат.`);
                  return bits.join('; ');
                },
              },
            ]}
            transformOut={(row) => ({
              ...row,
              kind: row.kind === 'system' ? 'system' : 'user',
              code: String(row.code || '').trim(),
              name: String(row.name || '').trim(),
              unit: String(row.unit || '%').trim() || '%',
              required: row.required === true,
              active: row.active !== false,
              materialIds: Array.isArray(row.materialIds) ? row.materialIds : [],
              materialTypes: Array.isArray(row.materialTypes) ? row.materialTypes : [],
            })}
            formExtra={({ editing, setEditing }) => (
              <CharacteristicForm
                editing={editing}
                setEditing={setEditing}
                materials={materials.map((m) => ({ id: m.id, name: m.name, type: m.type }))}
              />
            )}
          />
        );
      case 'stock':
        return (
          <CrudPage
            title="Запасы"
            collection="stock"
            readOnly
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
      case 'active_reservations':
        return (
          <CrudPage
            title="Активные резервы (регистр)"
            collection="active_reservations"
            readOnly
            fields={[
              { key: 'documentId', label: 'Документ', required: true },
              { key: 'productionOrderId', label: 'Заказ' },
              { key: 'materialId', label: 'Материал', type: 'select', required: true, options: opt(materials) },
              { key: 'lotId', label: 'Партия', type: 'select', required: true, options: opt(lots.map((l) => ({ id: l.id, name: l.number }))) },
              { key: 'quantity', label: 'Количество', type: 'number', required: true },
            ]}
            columns={[
              { key: 'documentId', label: 'Документ' },
              { key: 'productionOrderId', label: 'Заказ' },
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'lotId', label: 'Партия', render: (r) => lotNum(String(r.lotId)) },
              { key: 'quantity', label: 'Кол-во' },
            ]}
          />
        );
      case 'reservation_history':
        return (
          <CrudPage
            title="История резервирования"
            collection="reservation_history"
            readOnly
            fields={[
              { key: 'documentNumber', label: 'Номер документа', required: true },
              { key: 'documentStatus', label: 'Статус документа', required: true },
              { key: 'action', label: 'Действие', required: true },
              { key: 'materialId', label: 'Материал', type: 'select', required: true, options: opt(materials) },
              { key: 'lotId', label: 'Партия', type: 'select', required: true, options: opt(lots.map((l) => ({ id: l.id, name: l.number }))) },
              { key: 'quantity', label: 'Количество', type: 'number', required: true },
            ]}
            columns={[
              { key: 'atDate', label: 'Дата', render: (r) => dateFromIso(String(r.at || '')) },
              { key: 'atTime', label: 'Время', render: (r) => displayTimeFromIso(String(r.at || '')) },
              { key: 'documentNumber', label: 'Документ' },
              { key: 'documentStatus', label: 'Статус' },
              { key: 'action', label: 'Действие' },
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'lotId', label: 'Партия', render: (r) => lotNum(String(r.lotId)) },
              { key: 'quantity', label: 'Кол-во' },
            ]}
          />
        );
      case 'material_movements':
        return (
          <CrudPage
            title="Движение материалов"
            collection="material_movements"
            readOnly
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
              { key: 'atDate', label: 'Дата', render: (r) => dateFromIso(String(r.at || '')) },
              { key: 'atTime', label: 'Время', render: (r) => displayTimeFromIso(String(r.at || '')) },
              { key: 'type', label: 'Тип' },
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'lotId', label: 'Партия', render: (r) => lotNum(String(r.lotId)) },
              { key: 'seriesId', label: 'Серия', render: (r) => (r.seriesId ? serNum(String(r.seriesId)) : '—') },
              { key: 'quantity', label: 'Кол-во' },
              { key: 'documentNumber', label: 'Документ' },
              { key: 'documentStatus', label: 'Статус док.' },
            ]}
          />
        );
      case 'lot_qualities':
        return (
          <CrudPage
            title="Качества партий"
            collection="lot_qualities"
            fields={[
              { key: 'name', label: 'Название', required: true },
              {
                key: 'permission',
                label: 'Разрешение',
                type: 'select',
                required: true,
                options: [
                  { value: 'fit', label: 'Годен' },
                  { value: 'conditional', label: 'Условно годен' },
                  { value: 'unfit', label: 'Не годен' },
                ],
              },
              { key: 'comment', label: 'Описание / сценарий' },
              {
                key: 'active',
                label: 'Активно',
                type: 'select',
                defaultValue: 'true',
                options: [
                  { value: 'true', label: 'да' },
                  { value: 'false', label: 'нет' },
                ],
              },
            ]}
            columns={[
              { key: 'name', label: 'Название' },
              {
                key: 'permission',
                label: 'Разрешение',
                render: (r) =>
                  ({ fit: 'Годен', conditional: 'Условно годен', unfit: 'Не годен' } as Record<string, string>)[
                    String(r.permission)
                  ] || String(r.permission),
              },
              { key: 'comment', label: 'Описание' },
              {
                key: 'active',
                label: 'Активно',
                render: (r) => (r.active === false || r.active === 'false' ? 'нет' : 'да'),
              },
            ]}
            transformIn={(row) => ({
              ...row,
              active: row.active === false || row.active === 'false' ? 'false' : 'true',
            })}
            transformOut={(row) => ({
              ...row,
              active: row.active !== 'false' && row.active !== false,
            })}
          />
        );
      case 'quality_documents':
        return (
          <QualityManagementPage materials={materials} lots={lots} lotQualities={lotQualities} />
        );
      case 'quality_register':
        return (
          <CrudPage
            title="Качества партий (состояние)"
            collection="quality_register"
            readOnly
            fields={[
              { key: 'lotId', label: 'Партия', type: 'select', required: true, options: opt(lots.map((l) => ({ id: l.id, name: l.number }))) },
              { key: 'materialId', label: 'Материал', type: 'select', options: opt(materials) },
              { key: 'qualityName', label: 'Качество' },
              { key: 'permissionLabel', label: 'Разрешение' },
              { key: 'documentNumber', label: 'Документ' },
            ]}
            columns={[
              { key: 'lotId', label: 'Партия', render: (r) => lotNum(String(r.lotId)) },
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'qualityName', label: 'Качество' },
              { key: 'permissionLabel', label: 'Разрешение', render: (r) => String(r.permissionLabel || r.permission || '') },
              { key: 'documentNumber', label: 'Документ' },
              { key: 'updatedAt', label: 'Обновлено' },
            ]}
          />
        );
      case 'quality_history':
        return (
          <CrudPage
            title="Качества партий (история)"
            collection="quality_history"
            readOnly
            fields={[
              { key: 'documentNumber', label: 'Документ', required: true },
              { key: 'action', label: 'Действие' },
              { key: 'lotId', label: 'Партия' },
              { key: 'qualityName', label: 'Качество' },
              { key: 'permissionLabel', label: 'Разрешение' },
            ]}
            columns={[
              { key: 'at', label: 'Когда' },
              { key: 'action', label: 'Действие' },
              { key: 'documentNumber', label: 'Документ' },
              { key: 'lotId', label: 'Партия', render: (r) => (r.lotId ? lotNum(String(r.lotId)) : '—') },
              { key: 'qualityName', label: 'Качество' },
              { key: 'permissionLabel', label: 'Разрешение', render: (r) => String(r.permissionLabel || r.permission || '') },
            ]}
          />
        );
      case 'quality_scenarios':
        return <QualityScenariosPage />;
      case 'characteristic_documents':
        return <CharacteristicManagementPage materials={materials} lots={lots} />;
      case 'characteristic_register':
        return (
          <CrudPage
            title="Характеристики партий (состояние)"
            collection="characteristic_register"
            readOnly
            fields={[
              { key: 'lotId', label: 'Партия', type: 'select', options: opt(lots.map((l) => ({ id: l.id, name: l.number }))) },
              { key: 'materialId', label: 'Материал', type: 'select', options: opt(materials) },
              { key: 'name', label: 'Характеристика' },
              { key: 'value', label: 'Значение' },
              { key: 'documentNumber', label: 'Документ' },
            ]}
            columns={[
              { key: 'lotId', label: 'Партия', render: (r) => lotNum(String(r.lotId)) },
              { key: 'materialId', label: 'Материал', render: (r) => matName(String(r.materialId)) },
              { key: 'name', label: 'Характеристика', render: (r) => String(r.name || r.code || '') },
              { key: 'value', label: 'Значение' },
              { key: 'unit', label: 'Ед.' },
              { key: 'documentNumber', label: 'Документ' },
            ]}
          />
        );
      case 'characteristic_history':
        return (
          <CrudPage
            title="Характеристики партий (история)"
            collection="characteristic_history"
            readOnly
            fields={[
              { key: 'at', label: 'Когда' },
              { key: 'action', label: 'Действие' },
              { key: 'documentNumber', label: 'Документ' },
            ]}
            columns={[
              { key: 'at', label: 'Когда' },
              { key: 'action', label: 'Действие' },
              { key: 'documentNumber', label: 'Документ' },
              { key: 'lotId', label: 'Партия', render: (r) => (r.lotId ? lotNum(String(r.lotId)) : '—') },
              { key: 'name', label: 'Характеристика', render: (r) => String(r.name || r.code || '') },
              { key: 'value', label: 'Значение' },
            ]}
          />
        );
      case 'roles':
        return <RolesPage />;
      case 'admin_feedback':
        return <FeedbackPage />;
      case 'admin_user_guide':
        return <UserGuidePage />;
      case 'admin_legal':
        return <LegalDocumentsPage />;
      case 'users':
        return (
          <>
            <p className="hint">{ADMIN_USERS_PDN_HINT}</p>
            <CrudPage
            title="Пользователи"
            collection="users"
            transformIn={(row) => {
              const { passwordHash: _ph, ...rest } = row;
              return { ...rest, password: '' };
            }}
            transformOut={(row) => {
              const body = { ...row };
              if (!body.password) delete body.password;
              delete body.pdnAcceptedAt;
              delete body.pdnPolicyVersion;
              return body;
            }}
            validate={(row) => {
              if (!row.id && !String(row.password || '').trim()) {
                return 'Укажите пароль для нового пользователя';
              }
              return null;
            }}
            fields={[
              { key: 'name', label: 'Имя', required: true },
              { key: 'login', label: 'Логин', required: true },
              {
                key: 'roleId',
                label: 'Роль',
                type: 'select',
                required: true,
                options: roles.map((r) => ({ value: r.id, label: r.name })),
              },
              {
                key: 'password',
                label: 'Пароль',
                type: 'password',
                hint: (editing) =>
                  editing.id
                    ? 'Оставьте пустым, чтобы не менять пароль'
                    : 'Минимум 4 символа',
              },
              {
                key: 'active',
                label: 'Активен',
                type: 'select',
                defaultValue: 'true',
                options: [
                  { value: 'true', label: 'да' },
                  { value: 'false', label: 'нет' },
                ],
              },
            ]}
            columns={[
              { key: 'name', label: 'Имя' },
              { key: 'login', label: 'Логин' },
              {
                key: 'roleId',
                label: 'Роль',
                render: (row) => roles.find((r) => r.id === row.roleId)?.name || String(row.roleId || '—'),
              },
              { key: 'active', label: 'Активен' },
              {
                key: 'pdn',
                label: 'ПДн',
                filterable: false,
                render: (row) => {
                  const ver = row.pdnPolicyVersion ? String(row.pdnPolicyVersion) : '';
                  const at = row.pdnAcceptedAt ? String(row.pdnAcceptedAt).slice(0, 10) : '';
                  if (!ver || !at) return 'не принята';
                  return `${at} / ${ver}`;
                },
              },
            ]}
          />
          </>
        );
      case 'production_orders':
        return (
          <ProductionOrderPage
            materials={materials}
            series={series}
            workCenters={workCenters}
            specs={specs}
            techMaps={techMaps}
            plannedVolumes={plannedVolumes}
            lots={lots}
            warehouses={warehouses}
          />
        );
      case 'series_planning':
        return (
          <SeriesPlanningPage
            materials={materials}
            series={series}
            specs={specs}
            techMaps={techMaps}
            workCenters={workCenters}
            plannedVolumes={plannedVolumes}
            onDone={() => reloadDicts().catch(console.error)}
          />
        );
      case 'report_released_series':
        return <ReleasedSeriesReportPage />;
      case 'report_plan_fact':
        return <PlanFactReportPage />;
      case 'report_stock':
        return <StockReportPage />;
      case 'report_quality_stock':
        return <QualityStockReportPage />;
      case 'report_quality_history':
        return <QualityHistoryReportPage />;
      case 'admin_export_dictionaries':
        return <AdminExportDictionaries />;
      case 'admin_data_maintenance':
        return <AdminDataMaintenance />;
      case 'admin_login_audit':
        return <AdminLoginAuditPage />;
      case 'admin_changelog':
        return <AdminChangelogPage />;
      case 'production_desktop':
        return (
          <ProductionDesktop
            dictionaries={{
              materials: materials.map((m) => ({ id: m.id, name: m.name, type: m.type })),
              series: series.map((s) => ({ id: s.id, number: s.number })),
              workCenters,
              lots: lots.map((l) => ({
                id: l.id,
                number: l.number,
                materialId: l.materialId,
                counterpartyId: l.counterpartyId,
                manufacturerId: l.manufacturerId,
              })),
              counterparties: counterparties.map((c) => ({ id: c.id, name: c.name })),
              warehouses,
              substitutions: substitutions.map((s) => ({
                id: s.id,
                baseMaterialId: s.baseMaterialId,
                bidirectional: s.bidirectional,
                active: s.active,
                specificationId: s.specificationId,
                lines: s.lines,
              })),
              specifications: specs.map((s) => ({
                id: s.id,
                lines: (s.lines || []).map((l) => ({
                  id: l.id,
                  materialId: l.materialId,
                  recalcMethod: l.recalcMethod,
                })),
              })),
              characteristics: lotCharacteristics,
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
                manufacturerId: l.manufacturerId,
              })),
              counterparties: counterparties.map((c) => ({ id: c.id, name: c.name })),
              manufacturers: manufacturers.map((m) => ({ id: m.id, name: m.name })),
              specifications: specs.map((s) => ({
                id: s.id,
                approvedSuppliers: s.approvedSuppliers || [],
              })),
            }}
          />
        );
    }
  })();

  const content = canAccessPage(page, user?.permissions, Boolean(user)) ? (
    pageContent
  ) : (
    <AccessDenied />
  );

  useEffect(() => {
    document.title = user ? 'Вилар — оперативное планирование' : 'Вход';
  }, [user]);

  if (authLoading) {
    return <div className="auth-boot">Загрузка…</div>;
  }

  if (!user) {
    return <AuthGate />;
  }

  if (needsPdnAccept) {
    return <PdnAcceptGate />;
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <RecentObjectsStrip currentPage={page} onNavigate={navigateTo} />
      <LoginModal />
      <div className="layout">
      <aside className="sidebar">
        <nav>
          <button
            type="button"
            className={page === 'home' ? 'nav-item nav-home active' : 'nav-item nav-home'}
            onClick={() => navigateTo('home')}
          >
            Главная
          </button>
          {visibleNav.map((g) => (
            <div key={g.id} className="nav-group">
              <button
                type="button"
                className="nav-group-title"
                onClick={() => setOpenGroupId((current) => (current === g.id ? null : g.id))}
              >
                <span>{g.label}</span>
                <span>{openGroupId === g.id ? '▾' : '▸'}</span>
              </button>
              {openGroupId === g.id && (
                <ul>
                  {g.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={page === item.id ? 'nav-item active' : 'nav-item'}
                        onClick={() => navigateTo(item.id)}
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
      <main ref={contentRef} className="content">
        {content}
        <p className="app-legal-footer">{SYSTEM_DISCLAIMER}</p>
      </main>
      </div>
    </div>
  );
}
