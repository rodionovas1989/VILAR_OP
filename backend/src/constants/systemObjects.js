/** Объекты системы для матрицы прав RBAC */

export const REFERENCE_OBJECTS = [
  { id: 'materials', label: 'Материалы' },
  { id: 'specifications', label: 'Спецификации' },
  { id: 'counterparties', label: 'Контрагенты' },
  { id: 'lots', label: 'Партии' },
  { id: 'series', label: 'Серии' },
  { id: 'work_centers', label: 'Рабочие центры' },
  { id: 'warehouses', label: 'Склады' },
  { id: 'planned_series_volumes', label: 'Плановые объёмы серий' },
];

export const DOCUMENT_OBJECTS = [
  { id: 'doc_receipt', label: 'Приёмка' },
  { id: 'doc_transfer', label: 'Перемещение' },
  { id: 'doc_inventory', label: 'Инвентаризация' },
  { id: 'doc_writeoff', label: 'Списание' },
  { id: 'doc_posting', label: 'Оприходование' },
  { id: 'doc_reservation', label: 'Резервирование' },
  { id: 'doc_production_issue', label: 'Списание в производство' },
  { id: 'doc_production_receipt', label: 'Выпуск из производства' },
  { id: 'doc_shipment', label: 'Отгрузка' },
];

export const PLANNING_OBJECTS = [
  { id: 'production_orders', label: 'Заказы на производство' },
  { id: 'planning_desktop', label: 'Рабочий стол планирования' },
  { id: 'production_desktop', label: 'Управление заказами' },
];

export const STOCK_OBJECTS = [
  { id: 'stock', label: 'Запасы' },
  { id: 'active_reservations', label: 'Регистр резервов' },
  { id: 'reservation_history', label: 'История резервов' },
  { id: 'material_movements', label: 'Движение материалов' },
];

export const QUALITY_OBJECTS = [
  { id: 'lot_qualities', label: 'Качества партий' },
  { id: 'quality_documents', label: 'Управление качеством' },
  { id: 'quality_register', label: 'Качества партий (состояние)' },
  { id: 'quality_history', label: 'Качества партий (история)' },
];

export const REPORT_OBJECTS = [
  { id: 'report_released_series', label: 'Выпущенные серии продукции' },
  { id: 'report_stock', label: 'Запасы' },
];

export const ADMIN_OBJECTS = [
  { id: 'admin_user_guide', label: 'Руководство пользователя' },
  { id: 'admin_users', label: 'Пользователи' },
  { id: 'admin_roles', label: 'Роли' },
  { id: 'admin_export', label: 'Экспорт справочников' },
  { id: 'admin_feedback', label: 'Обратная связь' },
  { id: 'admin_data_maintenance', label: 'Данные и резервные копии' },
  { id: 'admin_login_audit', label: 'Журнал входов' },
  { id: 'admin_changelog', label: 'Что нового' },
];

export const SYSTEM_OBJECT_GROUPS = [
  { id: 'refs', label: 'Справочники', objects: REFERENCE_OBJECTS },
  { id: 'docs', label: 'Складские документы', objects: DOCUMENT_OBJECTS },
  { id: 'planning', label: 'Планирование и производство', objects: PLANNING_OBJECTS },
  { id: 'stock', label: 'Запасы и регистры', objects: STOCK_OBJECTS },
  { id: 'quality', label: 'Качество', objects: QUALITY_OBJECTS },
  { id: 'reports', label: 'Отчеты', objects: REPORT_OBJECTS },
  { id: 'admin', label: 'Администрирование', objects: ADMIN_OBJECTS },
];

export const ALL_SYSTEM_OBJECT_IDS = SYSTEM_OBJECT_GROUPS.flatMap((g) => g.objects.map((o) => o.id));

export function emptyPermissions() {
  const out = {};
  for (const id of ALL_SYSTEM_OBJECT_IDS) {
    out[id] = { read: false, create: false, modify: false };
  }
  return out;
}

export function fullPermissions() {
  const out = {};
  for (const id of ALL_SYSTEM_OBJECT_IDS) {
    out[id] = { read: true, create: true, modify: true };
  }
  return out;
}

export function storekeeperPermissions() {
  const out = emptyPermissions();
  for (const id of REFERENCE_OBJECTS.map((o) => o.id)) {
    out[id] = { read: true, create: false, modify: false };
  }
  for (const id of DOCUMENT_OBJECTS.map((o) => o.id)) {
    out[id] = { read: true, create: true, modify: false };
  }
  for (const id of STOCK_OBJECTS.map((o) => o.id)) {
    out[id] = { read: true, create: false, modify: false };
  }
  for (const id of REPORT_OBJECTS.map((o) => o.id)) {
    out[id] = { read: true, create: false, modify: false };
  }
  out.admin_feedback = { read: true, create: true, modify: false };
  out.admin_user_guide = { read: true, create: false, modify: false };
  return out;
}

export function plannerPermissions() {
  const out = emptyPermissions();
  for (const id of REFERENCE_OBJECTS.map((o) => o.id)) {
    out[id] = { read: true, create: false, modify: false };
  }
  for (const id of DOCUMENT_OBJECTS.map((o) => o.id)) {
    out[id] = { read: true, create: false, modify: false };
  }
  for (const id of STOCK_OBJECTS.map((o) => o.id)) {
    out[id] = { read: true, create: false, modify: false };
  }
  out.production_orders = { read: true, create: true, modify: true };
  out.planning_desktop = { read: true, create: true, modify: true };
  out.production_desktop = { read: true, create: false, modify: false };
  for (const id of REPORT_OBJECTS.map((o) => o.id)) {
    out[id] = { read: true, create: false, modify: false };
  }
  out.admin_feedback = { read: true, create: true, modify: false };
  out.admin_user_guide = { read: true, create: false, modify: false };
  return out;
}

export const LEGACY_ROLE_MAP = {
  administrator: 'role-administrator',
  admin: 'role-administrator',
  storekeeper: 'role-storekeeper',
  planner: 'role-planner',
};

export const DEFAULT_ROLE_PERMISSIONS = {
  'role-administrator': fullPermissions,
  'role-storekeeper': storekeeperPermissions,
  'role-planner': plannerPermissions,
};
