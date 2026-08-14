export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new Error(
      'Сервер недоступен. Запустите backend (npm run backend в корне проекта, порт 3001).'
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

async function downloadFile(path: string, filename: string, init?: RequestInit): Promise<void> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      'Сервер недоступен. Запустите backend (npm run backend в корне проекта, порт 3001).'
    );
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  authLogin: (login: string, password: string, rememberMe: boolean) =>
    request<{ token: string; user: import('./auth/AuthContext').AuthUser; expiresInMs: number }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ login, password, rememberMe }) }
    ),
  authMe: () => request<import('./auth/AuthContext').AuthUser>('/auth/me'),
  authLogout: () => request('/auth/logout', { method: 'POST' }),
  getFavorites: () =>
    request<{ items: { pageId: string; addedAt: string }[] }>('/auth/favorites'),
  saveFavorites: (items: { pageId: string; addedAt?: string }[]) =>
    request<{ items: { pageId: string; addedAt: string }[] }>('/auth/favorites', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),
  toggleFavorite: (pageId: string) =>
    request<{ items: { pageId: string; addedAt: string }[] }>('/auth/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ pageId }),
    }),

  list: <T>(collection: string) => request<T[]>(`/${collection}`),
  get: <T>(collection: string, id: string) => request<T>(`/${collection}/${id}`),
  create: <T>(collection: string, body: unknown) =>
    request<T>(`/${collection}`, { method: 'POST', body: JSON.stringify(body) }),
  update: <T>(collection: string, id: string, body: unknown) =>
    request<T>(`/${collection}/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (collection: string, id: string) =>
    request(`/${collection}/${id}`, { method: 'DELETE' }),
  bulkDelete: (collection: string, ids: string[]) =>
    request(`/${collection}/bulk-delete`, { method: 'POST', body: JSON.stringify({ ids }) }),
  selectOrders: (ids: string[]) =>
    request('/planning/select-orders', { method: 'POST', body: JSON.stringify({ ids }) }),
  suggestMaterialsBulk: (orderIds: string[], algorithm: string) =>
    request('/planning/suggest-materials-bulk', {
      method: 'POST',
      body: JSON.stringify({ orderIds, algorithm }),
    }),
  confirmMaterialsBulk: (items: { orderId: string; picks: unknown[] }[], userId?: string) =>
    request('/planning/confirm-materials-bulk', { method: 'POST', body: JSON.stringify({ items, userId }) }),
  gantt: () => request<{ workCenters: unknown[]; tasks: GanttTask[] }>('/planning/gantt'),
  lotsAvailable: (materialId: string, algorithm: string) =>
    request(`/planning/lots-available/${materialId}?algorithm=${algorithm}`),
  materialBalanceMatrix: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return request<MaterialBalanceMatrix>(`/planning/material-balance-matrix${qs ? `?${qs}` : ''}`);
  },
  completeOrder: (id: string, userId?: string) =>
    request(`/planning/complete/${id}`, { method: 'POST', body: JSON.stringify({ userId }) }),
  cancelOrder: (id: string, userId?: string) =>
    request(`/planning/cancel/${id}`, { method: 'POST', body: JSON.stringify({ userId }) }),
  saveProductionFact: (
    id: string,
    body: { actualQuantity: number; actualLines: { materialId: string; lotId: string; quantity: number }[] }
  ) =>
    request(`/planning/production-fact/${id}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminDictionaries: () => request<{ id: string; label: string }[]>('/admin/dictionaries'),
  listBackups: () =>
    request<
      {
        id: string;
        createdAt: string;
        label: string;
        reason: string;
        sizeBytes: number;
        counts?: { materials?: number; lots?: number; production_orders?: number; users?: number } | null;
      }[]
    >('/admin/backups'),
  createBackup: (label?: string) =>
    request('/admin/backups', { method: 'POST', body: JSON.stringify({ label: label || '' }) }),
  restoreBackup: (id: string, confirm: string) =>
    request(`/admin/backups/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    }),
  deleteBackup: (id: string) =>
    request(`/admin/backups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  clearAllData: (confirm: string) =>
    request('/admin/data/clear', { method: 'POST', body: JSON.stringify({ confirm }) }),
  loadDemoData: (confirm: string) =>
    request('/admin/data/demo', { method: 'POST', body: JSON.stringify({ confirm }) }),
  exportDictionariesXlsx: async (collections: string[]) => {
    const res = await fetch(`${API_BASE}/admin/export-dictionaries.xlsx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collections }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || res.statusText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dictionaries-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
  exportOrdersMaterialsXlsx: async (ids: string[]) => {
    const res = await fetch(`${API_BASE}/planning/export-orders-materials.xlsx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || res.statusText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-materials-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  documentTypes: () =>
    request<{ types: import('./types.documents').DocumentTypeMeta[]; statuses: Record<string, string> }>(
      '/documents/meta/types'
    ),
  listDocuments: (type: string, params?: { status?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<import('./types.documents').StockDocument[]>(
      `/documents/${type}${qs ? `?${qs}` : ''}`
    );
  },
  getDocument: (type: string, id: string) =>
    request<import('./types.documents').StockDocument>(`/documents/${type}/${id}`),
  createDocument: (type: string, body: unknown) =>
    request<import('./types.documents').StockDocument>(`/documents/${type}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateDocument: (type: string, id: string, body: unknown) =>
    request<import('./types.documents').StockDocument>(`/documents/${type}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteDocument: (type: string, id: string) =>
    request(`/documents/${type}/${id}`, { method: 'DELETE' }),
  postDocument: (type: string, id: string, userId: string) =>
    request<import('./types.documents').StockDocument>(`/documents/${type}/${id}/post`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  repostDocument: (type: string, id: string, userId: string, body: unknown) =>
    request<import('./types.documents').StockDocument>(`/documents/${type}/${id}/repost`, {
      method: 'POST',
      body: JSON.stringify({ userId, ...(body as object) }),
    }),
  cancelDocument: (type: string, id: string, userId: string) =>
    request<import('./types.documents').StockDocument>(`/documents/${type}/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  fulfillDocument: (
    type: string,
    id: string,
    userId: string,
    basis?: { basisDocumentId?: string; basisDocumentNumber?: string }
  ) =>
    request<import('./types.documents').StockDocument>(`/documents/${type}/${id}/fulfill`, {
      method: 'POST',
      body: JSON.stringify({ userId, ...basis }),
    }),
  getDocumentRelated: (type: string, id: string) =>
    request<import('./types.documents').DocumentTrace>(`/documents/${type}/${id}/related`),
  getOrderTrace: (id: string) =>
    request<import('./types.documents').OrderTrace>(`/planning/order-trace/${id}`),

  releasedSeriesReport: () =>
    request<import('./types').ReleasedSeriesRow[]>('/reports/released-series'),
  exportReleasedSeriesXlsx: (ids: string[]) =>
    downloadFile(`/reports/released-series.xlsx`, `released-series-${new Date().toISOString().slice(0, 10)}.xlsx`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  stockReport: () => request<import('./types').StockReportRow[]>('/reports/stock'),
  exportStockReportXlsx: (ids: string[]) =>
    downloadFile(`/reports/stock.xlsx`, `stock-${new Date().toISOString().slice(0, 10)}.xlsx`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  qualityDocumentTypes: () =>
    request<{ types: { id: string; code: string; label: string }[]; statuses: Record<string, string> }>(
      '/quality/meta/types'
    ),
  listQualityDocuments: () => request<import('./types.documents').QualityDocument[]>('/quality/documents'),
  createQualityDocument: (body: unknown) =>
    request<import('./types.documents').QualityDocument>('/quality/documents', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postQualityDocument: (id: string, userId: string) =>
    request<import('./types.documents').QualityDocument>(`/quality/documents/${id}/post`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  cancelQualityDocument: (id: string, userId: string) =>
    request<import('./types.documents').QualityDocument>(`/quality/documents/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};

export type GanttTask = {
  id: string;
  name: string;
  start: string;
  end: string;
  startAt: string;
  endAt: string;
  progress: number;
  workCenterId: string;
  workCenterName: string;
  status: string;
  product: string;
  series: string;
  reservations: { material?: string; lot?: string; counterparty?: string; quantity: number }[];
};

export type MaterialBalanceMatrix = {
  dates: string[];
  from: string | null;
  to: string | null;
  rows: {
    materialId: string;
    materialName: string;
    unit: string;
    openingBalance: number;
    cells: {
      date: string;
      balance: number;
      consumed: number;
      orders: { orderId: string; label: string; status: string; quantity: number }[];
    }[];
  }[];
};
