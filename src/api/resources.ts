import { api } from './client'
import type {
  Category, CategoryInput, GroupBy, Journal, Market, MarketInput, Product, ProductInput, ReportFilter,
  ReportSummary, Timeline, Unit,
} from './types'

export const marketsApi = {
  list: () => api<Market[]>('/markets'),
  get: (id: number) => api<Market>(`/markets/${id}`),
  create: (body: MarketInput) => api<Market>('/markets', { method: 'POST', body }),
  update: (id: number, body: MarketInput) => api<Market>(`/markets/${id}`, { method: 'PUT', body }),
  remove: (id: number) => api<void>(`/markets/${id}`, { method: 'DELETE' }),
  getProducts: (id: number) => api<{ productIds: number[] }>(`/markets/${id}/products`),
  setProducts: (id: number, productIds: number[]) =>
    api<{ productIds: number[] }>(`/markets/${id}/products`, { method: 'PUT', body: { productIds } }),
  addProduct: (id: number, productId: number) =>
    api(`/markets/${id}/products`, { method: 'POST', body: { productId } }),
  removeProduct: (id: number, productId: number) =>
    api<void>(`/markets/${id}/products/${productId}`, { method: 'DELETE' }),
  createProduct: (id: number, body: { name: string; categoryId: number; unit: Unit }) =>
    api<{ productId: number; existed: boolean }>(`/markets/${id}/products/new`, { method: 'POST', body }),
  journal: (id: number, month: string) => api<Journal>(`/markets/${id}/journal?month=${month}`),
  saveReceipt: (id: number, body: { productId: number; date: string; quantity: number; mode?: 'set' | 'add' }) =>
    api<{ productId: number; date: string; quantity: number }>(`/markets/${id}/receipts`, { method: 'PUT', body }),
}

function qs(params: object) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== 0) sp.set(k, String(v))
  return sp.toString()
}

export interface NewReceiptItem {
  productId?: number
  newProduct?: { name: string; categoryId: number; unit: Unit }
  quantity: number
}

export interface NewReceiptResult {
  market: { id: number; name: string }
  date: string
  items: { productId: number; name: string; unit: Unit; added: number; dayTotal: number; created: boolean }[]
}

export const receiptsApi = {
  create: (body: { marketId: number; date: string; items: NewReceiptItem[] }) =>
    api<NewReceiptResult>('/receipts', { method: 'POST', body }),
}

export const reportsApi = {
  summary: (f: ReportFilter) => api<ReportSummary>(`/reports/summary?${qs(f)}`),
  timeline: (f: ReportFilter & { groupBy: GroupBy }) => api<Timeline>(`/reports/timeline?${qs(f)}`),
}

export const categoriesApi = {
  list: () => api<Category[]>('/categories'),
  create: (body: CategoryInput) => api<Category>('/categories', { method: 'POST', body }),
  update: (id: number, body: CategoryInput) => api<Category>(`/categories/${id}`, { method: 'PUT', body }),
  remove: (id: number) => api<void>(`/categories/${id}`, { method: 'DELETE' }),
}

export const productsApi = {
  list: () => api<Product[]>('/products'),
  create: (body: ProductInput) => api<Product>('/products', { method: 'POST', body }),
  update: (id: number, body: ProductInput) => api<Product>(`/products/${id}`, { method: 'PUT', body }),
  remove: (id: number) => api<void>(`/products/${id}`, { method: 'DELETE' }),
}
