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
  completeOrder: (id: string) => request(`/planning/complete/${id}`, { method: 'POST' }),
  cancelOrder: (id: string) => request(`/planning/cancel/${id}`, { method: 'POST' }),
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
