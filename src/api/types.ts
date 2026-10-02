export type Unit = 'kg' | 'pcs'

export interface Admin {
  id: number
  email: string
  name: string
}

export interface Market {
  id: number
  name: string
  address: string
  isActive: boolean
  productsCount: number
  lastReceiptDate: string | null
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: number
  name: string
  sortOrder: number
  productsCount: number
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: number
  name: string
  unit: Unit
  sortOrder: number
  isActive: boolean
  categoryId: number
  categoryName: string
  marketsCount: number
  receiptsCount: number
  createdAt: string
  updatedAt: string
}

export type MarketInput = Pick<Market, 'name' | 'address' | 'isActive'>
export type CategoryInput = Pick<Category, 'name' | 'sortOrder'>
export type ProductInput = Pick<Product, 'name' | 'unit' | 'sortOrder' | 'isActive' | 'categoryId'>

export interface JournalRow {
  id: number
  name: string
  unit: Unit
  isActive: boolean
  categoryId: number
  categoryName: string
  assigned: boolean
  values: Record<number, number>
  total: number
}

export interface Journal {
  market: { id: number; name: string; isActive: boolean }
  month: string
  daysInMonth: number
  rows: JournalRow[]
}

export interface ReportFilter {
  from: string
  to: string
  marketId?: number
  categoryId?: number
  productId?: number
}

export interface ReportProduct {
  id: number
  name: string
  unit: Unit
  categoryId: number
  categoryName: string
  total: number
  days: number
  maxDay: number
  markets: number
}

export interface ReportSummary {
  from: string
  to: string
  periodDays: number
  totals: { kg: number; pcs: number; activeDays: number; productsCount: number; entries: number }
  products: ReportProduct[]
  categories: { id: number; name: string; kg: number; pcs: number }[]
  markets: { id: number; name: string; kg: number; pcs: number; days: number }[]
}

export type GroupBy = 'day' | 'week' | 'month'

export interface Timeline {
  groupBy: GroupBy
  from: string
  to: string
  rows: { bucket: string; kg: number; pcs: number }[]
}
