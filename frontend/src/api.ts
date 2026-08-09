export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export const api = {
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
  confirmMaterialsBulk: (items: { orderId: string; picks: unknown[] }[]) =>
    request('/planning/confirm-materials-bulk', { method: 'POST', body: JSON.stringify({ items }) }),
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
  completeOrder: (id: string) => request(`/planning/complete/${id}`, { method: 'POST' }),
  cancelOrder: (id: string) => request(`/planning/cancel/${id}`, { method: 'POST' }),
  saveProductionFact: (
    id: string,
    body: { actualQuantity: number; actualLines: { materialId: string; lotId: string; quantity: number }[] }
  ) =>
    request(`/planning/production-fact/${id}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminDictionaries: () => request<{ id: string; label: string }[]>('/admin/dictionaries'),
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
