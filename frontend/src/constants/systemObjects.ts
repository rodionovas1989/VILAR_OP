/** Объекты системы — зеркало backend/src/constants/systemObjects.js */

export type SystemObject = { id: string; label: string };

export const REFERENCE_OBJECTS: SystemObject[] = [
  { id: 'materials', label: 'Материалы' },
  { id: 'specifications', label: 'Спецификации' },
  { id: 'counterparties', label: 'Контрагенты' },
  { id: 'manufacturers', label: 'Производители' },
  { id: 'lots', label: 'Партии' },
  { id: 'series', label: 'Серии' },
  { id: 'work_centers', label: 'Рабочие центры' },
  { id: 'tech_maps', label: 'Технологические карты' },
  { id: 'warehouses', label: 'Склады' },
  { id: 'planned_series_volumes', label: 'Плановые объёмы серий' },
  { id: 'substitutions', label: 'Аналоги' },
];

export const DOCUMENT_OBJECTS: SystemObject[] = [
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

export const PLANNING_OBJECTS: SystemObject[] = [
  { id: 'production_orders', label: 'Заказы на производство' },
  { id: 'series_planning', label: 'Планирование серий' },
  { id: 'planning_desktop', label: 'Рабочий стол планирования' },
  { id: 'production_desktop', label: 'Управление заказами' },
];

export const STOCK_OBJECTS: SystemObject[] = [
  { id: 'stock', label: 'Запасы' },
  { id: 'active_reservations', label: 'Регистр резервов' },
  { id: 'reservation_history', label: 'История резервов' },
  { id: 'material_movements', label: 'Движение материалов' },
  { id: 'production_register', label: 'Аналитика производства' },
];

export const QUALITY_OBJECTS: SystemObject[] = [
  { id: 'lot_qualities', label: 'Качества партий' },
  { id: 'quality_documents', label: 'Управление качеством' },
  { id: 'quality_register', label: 'Качества партий (состояние)' },
  { id: 'quality_history', label: 'Качества партий (история)' },
  { id: 'quality_scenarios', label: 'Сценарии' },
  { id: 'lot_characteristics', label: 'Характеристики партий' },
  { id: 'characteristic_documents', label: 'Управление характеристиками' },
  { id: 'characteristic_register', label: 'Характеристики партий (состояние)' },
  { id: 'characteristic_history', label: 'Характеристики партий (история)' },
];

export const REPORT_OBJECTS: SystemObject[] = [
  { id: 'report_released_series', label: 'Выпущенные серии продукции' },
  { id: 'report_plan_fact', label: 'План/Факт производства' },
  { id: 'report_stock', label: 'Запасы' },
  { id: 'report_quality_stock', label: 'Качество запасов' },
  { id: 'report_quality_history', label: 'История качеств' },
];

export const ADMIN_OBJECTS: SystemObject[] = [
  { id: 'admin_user_guide', label: 'Руководство пользователя' },
  { id: 'admin_legal', label: 'Политика ПДн и правовая информация' },
  { id: 'admin_users', label: 'Пользователи' },
  { id: 'admin_roles', label: 'Роли' },
  { id: 'admin_export', label: 'Экспорт справочников' },
  { id: 'admin_feedback', label: 'Обратная связь' },
  { id: 'admin_data_maintenance', label: 'Данные и резервные копии' },
  { id: 'admin_login_audit', label: 'Журнал входов' },
  { id: 'admin_document_status_log', label: 'Изменение статусов документов' },
  { id: 'admin_ops_debug_log', label: 'Операционный журнал (отладка)' },
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

export type ObjectPermissions = { read: boolean; create: boolean; modify: boolean };
export type PermissionMap = Record<string, ObjectPermissions>;

export interface Role {
  id: string;
  name: string;
  code: string;
  permissions: PermissionMap;
}

export function emptyPermissions(): PermissionMap {
  const out: PermissionMap = {};
  for (const id of ALL_SYSTEM_OBJECT_IDS) {
    out[id] = { read: false, create: false, modify: false };
  }
  return out;
}

export function normalizePermissions(raw: PermissionMap): PermissionMap {
  const out = emptyPermissions();
  for (const id of ALL_SYSTEM_OBJECT_IDS) {
    const p = raw[id] || { read: false, create: false, modify: false };
    out[id] = {
      read: Boolean(p.read),
      create: Boolean(p.create),
      modify: Boolean(p.modify),
    };
    if (out[id].modify) {
      out[id].read = true;
      out[id].create = true;
    } else if (out[id].create) {
      out[id].read = true;
    }
  }
  return out;
}
