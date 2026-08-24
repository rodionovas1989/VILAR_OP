export type NavKind = 'desktop' | 'planning' | 'dictionary' | 'document' | 'register' | 'quality' | 'report' | 'admin';

export type NavItem = { id: string; label: string; kind: NavKind };
export type NavGroup = { id: string; label: string; items: NavItem[] };

export const KIND_SECTION_LABELS: Record<NavKind, string> = {
  desktop: 'Рабочие столы',
  planning: 'Планирование',
  dictionary: 'Справочники',
  document: 'Документы',
  register: 'Регистры',
  quality: 'Качество',
  report: 'Отчеты',
  admin: 'Администрирование',
};

const DOCUMENT_NAV: NavItem[] = [
  { id: 'doc_receipt', label: 'Приёмка', kind: 'document' },
  { id: 'doc_transfer', label: 'Перемещение', kind: 'document' },
  { id: 'doc_inventory', label: 'Инвентаризация', kind: 'document' },
  { id: 'doc_writeoff', label: 'Списание', kind: 'document' },
  { id: 'doc_posting', label: 'Оприходование', kind: 'document' },
  { id: 'doc_reservation', label: 'Резервирование', kind: 'document' },
  { id: 'doc_production_issue', label: 'Списание в производство', kind: 'document' },
  { id: 'doc_production_receipt', label: 'Выпуск из производства', kind: 'document' },
  { id: 'doc_shipment', label: 'Отгрузка', kind: 'document' },
];

export const NAV: NavGroup[] = [
  {
    id: 'refs',
    label: 'Справочники',
    items: [
      { id: 'materials', label: 'Материалы', kind: 'dictionary' },
      { id: 'specifications', label: 'Спецификации', kind: 'dictionary' },
      { id: 'counterparties', label: 'Контрагенты', kind: 'dictionary' },
      { id: 'manufacturers', label: 'Производители', kind: 'dictionary' },
      { id: 'lots', label: 'Партии', kind: 'dictionary' },
      { id: 'series', label: 'Серии', kind: 'dictionary' },
      { id: 'work_centers', label: 'Рабочие центры', kind: 'dictionary' },
      { id: 'tech_maps', label: 'Технологические карты', kind: 'dictionary' },
      { id: 'warehouses', label: 'Склады', kind: 'dictionary' },
      { id: 'planned_series_volumes', label: 'Плановые объёмы серий', kind: 'dictionary' },
      { id: 'substitutions', label: 'Аналоги', kind: 'dictionary' },
    ],
  },
  {
    id: 'docs',
    label: 'Документы',
    items: DOCUMENT_NAV,
  },
  {
    id: 'stock',
    label: 'Запасы',
    items: [
      { id: 'stock', label: 'Запасы', kind: 'register' },
      { id: 'active_reservations', label: 'Регистр резервов', kind: 'register' },
      { id: 'reservation_history', label: 'История резервов', kind: 'register' },
      { id: 'material_movements', label: 'Движение материалов', kind: 'register' },
    ],
  },
  {
    id: 'plan',
    label: 'Планирование',
    items: [
      { id: 'production_orders', label: 'Заказы на производство', kind: 'planning' },
      { id: 'series_planning', label: 'Планирование серий', kind: 'planning' },
      { id: 'planning_desktop', label: 'Рабочий стол планирования', kind: 'desktop' },
    ],
  },
  {
    id: 'production',
    label: 'Производство',
    items: [{ id: 'production_desktop', label: 'Управление заказами', kind: 'desktop' }],
  },
  {
    id: 'reports',
    label: 'Отчеты',
    items: [
      { id: 'report_released_series', label: 'Выпущенные серии продукции', kind: 'report' },
      { id: 'report_plan_fact', label: 'План/Факт производства', kind: 'report' },
      { id: 'report_stock', label: 'Запасы', kind: 'report' },
      { id: 'report_quality_stock', label: 'Качество запасов', kind: 'report' },
      { id: 'report_quality_history', label: 'История качеств', kind: 'report' },
    ],
  },
  {
    id: 'quality',
    label: 'Качество',
    items: [
      { id: 'lot_qualities', label: 'Качества партий', kind: 'quality' },
      { id: 'quality_documents', label: 'Управление качеством', kind: 'quality' },
      { id: 'quality_register', label: 'Качества партий (состояние)', kind: 'quality' },
      { id: 'quality_history', label: 'Качества партий (история)', kind: 'quality' },
      { id: 'quality_scenarios', label: 'Сценарии', kind: 'quality' },
      { id: 'lot_characteristics', label: 'Характеристики партий', kind: 'quality' },
      { id: 'characteristic_documents', label: 'Управление характеристиками', kind: 'quality' },
      { id: 'characteristic_register', label: 'Характеристики партий (состояние)', kind: 'quality' },
      { id: 'characteristic_history', label: 'Характеристики партий (история)', kind: 'quality' },
    ],
  },
  {
    id: 'admin',
    label: 'Администрирование',
    items: [
      { id: 'admin_user_guide', label: 'Руководство пользователя', kind: 'admin' },
      { id: 'admin_legal', label: 'Политика ПДн и правовая информация', kind: 'admin' },
      { id: 'users', label: 'Пользователи', kind: 'admin' },
      { id: 'roles', label: 'Роли', kind: 'admin' },
      { id: 'admin_export_dictionaries', label: 'Экспорт справочников', kind: 'admin' },
      { id: 'admin_data_maintenance', label: 'Данные и резервные копии', kind: 'admin' },
      { id: 'admin_login_audit', label: 'Журнал входов', kind: 'admin' },
      { id: 'admin_changelog', label: 'Что нового', kind: 'admin' },
      { id: 'admin_feedback', label: 'Обратная связь', kind: 'admin' },
    ],
  },
];

const catalogMap = new Map<string, NavItem & { groupLabel: string }>();

for (const group of NAV) {
  for (const item of group.items) {
    catalogMap.set(item.id, { ...item, groupLabel: group.label });
  }
}

export function catalogItem(pageId: string) {
  return catalogMap.get(pageId);
}

export function allCatalogItems() {
  return [...catalogMap.values()];
}
