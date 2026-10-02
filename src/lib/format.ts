import type { Unit } from '../api/types'

export const UNIT_LABEL: Record<Unit, string> = { kg: 'кг', pcs: 'шт' }
export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'kg', label: 'Килограммы (кг)' },
  { value: 'pcs', label: 'Штуки (шт)' },
]

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export const productsWord = (n: number) => `${n} ${plural(n, 'продукт', 'продукта', 'продуктов')}`

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 })
export const fmtNum = (n: number) => nf.format(n)
export const fmtQty = (n: number, unit: Unit) => `${nf.format(n)} ${UNIT_LABEL[unit]}`

// Разбор ввода: «2,5», «2.5», «,5» → число; пусто → 0; мусор → null. До 3 знаков после запятой.
export function parseQty(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return 0
  if (!/^(\d+(\.\d{0,3})?|\.\d{1,3})$/.test(s)) return null
  return Number(s)
}
