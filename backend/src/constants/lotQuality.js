/** Разрешения качества партии — единый словарь для справочника и регистров */
export const LOT_QUALITY_PERMISSIONS = {
  fit: { id: 'fit', label: 'Годен' },
  conditional: { id: 'conditional', label: 'Условно годен' },
  unfit: { id: 'unfit', label: 'Не годен' },
};

export const LOT_QUALITY_PERMISSION_IDS = Object.keys(LOT_QUALITY_PERMISSIONS);

export function assertLotQualityPermission(permission) {
  if (!LOT_QUALITY_PERMISSIONS[permission]) {
    throw new Error('Укажите разрешение: Годен / Условно годен / Не годен');
  }
  return permission;
}

export function labelLotQualityPermission(permission) {
  return LOT_QUALITY_PERMISSIONS[permission]?.label || permission || 'Годен';
}

/** Единый документ качества (без отдельных видов QIN/QRL/QBL) */
export const QUALITY_MANAGEMENT_TYPE = {
  id: 'quality_management',
  code: 'QCM',
  label: 'Управление качеством',
  collection: 'quality_documents',
};

export const QUALITY_DOCUMENT_STATUS = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
};

/** @deprecated legacy aliases — API meta */
export const QUALITY_DOCUMENT_TYPES = {
  quality_management: {
    code: QUALITY_MANAGEMENT_TYPE.code,
    label: QUALITY_MANAGEMENT_TYPE.label,
  },
};

export function assertQualityDocumentType(type) {
  if (type !== QUALITY_MANAGEMENT_TYPE.id && type !== 'quality_management') {
    throw new Error(`Неизвестный тип документа качества: ${type}`);
  }
  return QUALITY_MANAGEMENT_TYPE.id;
}
