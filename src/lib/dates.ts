// Все даты — локальные календарные дни в формате 'YYYY-MM-DD'

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => toISO(new Date())
export const addDays = (iso: string, n: number) => {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export const currentMonth = () => today().slice(0, 7)
export const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

export const monthTitle = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export const formatDate = (iso: string) => {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`
}
export const formatDateShort = (iso: string) => {
  const d = fromISO(iso)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

export const formatBucket = (iso: string, groupBy: 'day' | 'week' | 'month') => {
  const d = fromISO(iso)
  if (groupBy === 'month') return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
  if (groupBy === 'week') {
    const end = fromISO(addDays(iso, 6))
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`
  }
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export const formatBucketTick = (iso: string, groupBy: 'day' | 'week' | 'month') => {
  const d = fromISO(iso)
  if (groupBy === 'month') return MONTHS_SHORT[d.getMonth()]
  return `${d.getDate()}.${pad(d.getMonth() + 1)}`
}

// Неделя начинается с понедельника
export const startOfWeek = (iso: string) => {
  const d = fromISO(iso)
  const shift = (d.getDay() + 6) % 7
  return addDays(iso, -shift)
}

export type PresetKey = 'today' | 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | '30days' | 'year' | 'custom'

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'yesterday', label: 'Вчера' },
  { key: 'week', label: 'Эта неделя' },
  { key: 'lastWeek', label: 'Прошлая неделя' },
  { key: 'month', label: 'Этот месяц' },
  { key: 'lastMonth', label: 'Прошлый месяц' },
  { key: '30days', label: '30 дней' },
  { key: 'year', label: 'Этот год' },
  { key: 'custom', label: 'Свой период' },
]

export function presetRange(key: Exclude<PresetKey, 'custom'>): { from: string; to: string } {
  const t = today()
  switch (key) {
    case 'today':
      return { from: t, to: t }
    case 'yesterday':
      return { from: addDays(t, -1), to: addDays(t, -1) }
    case 'week':
      return { from: startOfWeek(t), to: t }
    case 'lastWeek': {
      const from = addDays(startOfWeek(t), -7)
      return { from, to: addDays(from, 6) }
    }
    case 'month':
      return { from: `${t.slice(0, 7)}-01`, to: t }
    case 'lastMonth': {
      const m = shiftMonth(t.slice(0, 7), -1)
      return { from: `${m}-01`, to: addDays(`${t.slice(0, 7)}-01`, -1) }
    }
    case '30days':
      return { from: addDays(t, -29), to: t }
    case 'year':
      return { from: `${t.slice(0, 4)}-01-01`, to: t }
  }
}

export const daysBetween = (from: string, to: string) =>
  Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86_400_000) + 1
