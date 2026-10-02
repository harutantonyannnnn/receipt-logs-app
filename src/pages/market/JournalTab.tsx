import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { marketsApi } from '../../api/resources'
import type { Journal, JournalRow } from '../../api/types'
import { useOpenReceipt } from '../../components/NewReceiptModal'
import { Empty, ErrorState, Loader } from '../../components/States'
import { useToast } from '../../components/Toast'
import { addDays, currentMonth, formatBucket, formatDate, fromISO, monthTitle, shiftMonth, today, WEEKDAYS_SHORT } from '../../lib/dates'
import { useIsMobile } from '../../lib/useMediaQuery'
import { IconChevronLeft, IconChevronRight, IconSearch } from '../../components/Icons'
import { UNIT_LABEL, fmtNum, fmtQty, parseQty } from '../../lib/format'
import { useMarket } from './MarketLayout'

const pad = (n: number) => String(n).padStart(2, '0')

export function JournalTab() {
  const market = useMarket()
  const qc = useQueryClient()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const isMobile = useIsMobile()
  // Два режима: «Месяц» — таблица как бумажный журнал, «День» — список с крупными полями (удобно с телефона)
  const view: 'month' | 'day' = params.get('view') === 'month' || params.get('view') === 'day'
    ? (params.get('view') as 'month' | 'day')
    : isMobile ? 'day' : 'month'
  const rawDate = params.get('date') ?? ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate <= today() ? rawDate : today()
  const month = view === 'day'
    ? date.slice(0, 7)
    : /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month')! : currentMonth()
  const setP = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }
  const [search, setSearch] = useState('')
  const [hideEmpty, setHideEmpty] = useState(false)
  const openReceipt = useOpenReceipt()

  const key = ['journal', market.id, month]
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => marketsApi.journal(market.id, month) })

  // При открытии текущего месяца прокручиваем журнал к сегодняшнему дню
  const scrollRef = useRef<HTMLDivElement>(null)
  const loaded = Boolean(data)
  useEffect(() => {
    const box = scrollRef.current
    const th = box?.querySelector<HTMLElement>('th.today')
    const total = box?.querySelector<HTMLElement>('th.j-total')
    // сегодняшний день — у правого края, перед колонкой «Итого»
    if (box && th && total) box.scrollLeft = Math.max(0, th.offsetLeft + th.offsetWidth + total.offsetWidth + 8 - box.clientWidth)
  }, [loaded, month, view])

  const todayIso = today()
  const days = useMemo(() => {
    if (!data) return []
    return Array.from({ length: data.daysInMonth }, (_, i) => {
      const day = i + 1
      const iso = `${month}-${pad(day)}`
      const dow = fromISO(iso).getDay()
      return { day, iso, dow, weekend: dow === 0 || dow === 6, isToday: iso === todayIso, future: iso > todayIso }
    })
  }, [data, month, todayIso])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = (data?.rows ?? []).filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!hideEmpty || r.total > 0))
    const out: { id: number; name: string; rows: JournalRow[] }[] = []
    for (const r of rows) {
      const last = out[out.length - 1]
      if (last && last.id === r.categoryId) last.rows.push(r)
      else out.push({ id: r.categoryId, name: r.categoryName, rows: [r] })
    }
    return out
  }, [data, search, hideEmpty])

  const flatRows = groups.flatMap((g) => g.rows)
  const totals = useMemo(() => {
    const t = { kg: 0, pcs: 0 }
    for (const r of data?.rows ?? []) t[r.unit] += r.total
    return t
  }, [data])
  const dayNum = Number(date.slice(8, 10))
  const dayTotals = useMemo(() => {
    const t = { kg: 0, pcs: 0 }
    for (const r of data?.rows ?? []) t[r.unit] += r.values[dayNum] ?? 0
    return t
  }, [data, dayNum])

  // Сохранение ячейки: пишем в API и обновляем кэш журнала
  async function commit(row: JournalRow, day: number, value: number) {
    const date = `${month}-${pad(day)}`
    const res = await marketsApi.saveReceipt(market.id, { productId: row.id, date, quantity: value, mode: 'set' })
    qc.setQueryData<Journal>(key, (old) => {
      if (!old) return old
      return {
        ...old,
        rows: old.rows.map((r) => {
          if (r.id !== row.id) return r
          const values = { ...r.values }
          if (res.quantity > 0) values[day] = res.quantity
          else delete values[day]
          const total = Math.round(Object.values(values).reduce((s, v) => s + v, 0) * 1000) / 1000
          return { ...r, values, total }
        }),
      }
    })
    qc.invalidateQueries({ queryKey: ['reports'] })
    qc.invalidateQueries({ queryKey: ['markets'], exact: true })
  }

  return (
    <>
      <div className="journal-bar">
        <div className="seg view-toggle" role="group" aria-label="Вид журнала">
          <button className={view === 'month' ? 'active' : ''} onClick={() => setP({ view: 'month', month: month === currentMonth() ? undefined : month })}>Месяц</button>
          <button className={view === 'day' ? 'active' : ''} onClick={() => setP({ view: 'day' })}>День</button>
        </div>
        {view === 'month' ? (
          <div className="month-switch">
            <button className="btn btn-icon" onClick={() => setP({ month: shiftMonth(month, -1) })} aria-label="Предыдущий месяц"><IconChevronLeft /></button>
            <strong>{monthTitle(month)}</strong>
            <button className="btn btn-icon" onClick={() => setP({ month: shiftMonth(month, 1) })} aria-label="Следующий месяц"><IconChevronRight /></button>
            {month !== currentMonth() && (
              <button className="btn btn-sm" onClick={() => setP({ month: undefined })}>Сейчас</button>
            )}
          </div>
        ) : (
          <div className="month-switch day-switch">
            <button className="btn btn-icon" onClick={() => setP({ date: addDays(date, -1) })} aria-label="Предыдущий день"><IconChevronLeft /></button>
            <label className="day-picker">
              <strong>{formatBucket(date, 'day')}, {WEEKDAYS_SHORT[fromISO(date).getDay()]}</strong>
              <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setP({ date: e.target.value })} aria-label="Выбрать дату" />
            </label>
            <button className="btn btn-icon" onClick={() => setP({ date: addDays(date, 1) })} disabled={date >= today()} aria-label="Следующий день"><IconChevronRight /></button>
            {date !== today() && <button className="btn btn-sm" onClick={() => setP({ date: undefined })}>Сегодня</button>}
          </div>
        )}
        <div className="search-wrap">
          <IconSearch width={18} height={18} />
          <input className="search" type="search" placeholder="Поиск продукта…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="checkbox small">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
          <span>Только с приходом</span>
        </label>
        <div className="spacer" />
        <button className="btn btn-primary desktop-only" onClick={() => openReceipt(market.id)}>+ Новый приход</button>
      </div>

      {data && (
        <div className="journal-summary muted small">
          {view === 'day' ? (
            <>За день: <strong>{fmtQty(dayTotals.kg, 'kg')}</strong> · <strong>{fmtQty(dayTotals.pcs, 'pcs')}</strong></>
          ) : (
            <>За месяц: <strong>{fmtQty(totals.kg, 'kg')}</strong> · <strong>{fmtQty(totals.pcs, 'pcs')}</strong></>
          )}
          <span className="hint-inline">
            {view === 'day'
              ? 'Введите количество и нажмите Enter — сохранится сразу. Пусто или 0 — удалить.'
              : 'Введите количество в ячейку и нажмите Enter. Пустая ячейка или 0 — удалить запись.'}
          </span>
        </div>
      )}

      {view === 'day' && data && data.rows.length > 0 ? (
        !flatRows.length ? (
          <div className="card"><Empty text="Ничего не найдено" /></div>
        ) : (
          <div className="day-list">
            {groups.map((g) => (
              <section key={g.id} className="card day-group">
                <h4 className="day-group-title">{g.name}</h4>
                <ul>
                  {g.rows.map((r) => {
                    const rowIndex = flatRows.indexOf(r)
                    const v = r.values[dayNum] ?? 0
                    return (
                      <li key={r.id} className={`day-row${v ? ' filled' : ''}${r.isActive ? '' : ' inactive'}`}>
                        <div className="day-row-info">
                          <span className="day-row-name">{r.name}</span>
                          <span className="day-row-sub">
                            <span className={`unit unit-${r.unit}`}>{r.unit === 'pcs' ? 'Штучный' : 'килограмм'}</span>
                            {r.total > 0 && <> за месяц {fmtQty(r.total, r.unit)}</>}
                          </span>
                        </div>
                        <div className="input-suffix day-input">
                          <Cell
                            value={v}
                            disabled={false}
                            unit={r.unit}
                            id={`${rowIndex}-0`}
                            label={`${r.name}, ${formatDate(date)}`}
                            className="day-cell-input"
                            onCommit={(val) => commit(r, dayNum, val)}
                            onError={(m) => toast(m, 'error')}
                          />
                          <span>{UNIT_LABEL[r.unit]}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : (
      <div className="card">
        {isLoading ? <Loader /> : error ? <ErrorState error={error} /> : !data?.rows.length ? (
          <Empty text="В магазине пока нет продуктов. Нажмите «+ Новый приход» — продукт добавится в магазин автоматически." />
        ) : (
          <div className="journal-scroll" ref={scrollRef}>
            <table className="journal">
              <thead>
                <tr>
                  <th className="j-name">Наименование продукта</th>
                  <th className="j-unit">Ед.</th>
                  {days.map((d) => (
                    <th key={d.day} className={`j-day${d.weekend ? ' weekend' : ''}${d.isToday ? ' today' : ''}`} title={d.iso}>
                      <div>{d.day}</div>
                      <div className="dow">{WEEKDAYS_SHORT[d.dow]}</div>
                    </th>
                  ))}
                  <th className="j-total">Итого</th>
                </tr>
              </thead>
              <tbody>
                {!flatRows.length && (
                  <tr><td colSpan={days.length + 3}><Empty text="Ничего не найдено" /></td></tr>
                )}
                {groups.map((g) => (
                  <Group key={g.id} name={g.name} span={days.length + 3}>
                    {g.rows.map((r) => {
                      const rowIndex = flatRows.indexOf(r)
                      return (
                        <tr key={r.id} className={r.isActive ? '' : 'inactive'}>
                          <td className="j-name" title={r.assigned ? undefined : 'Продукт убран из магазина, но в этом месяце по нему был приход'}>
                            {r.name}{!r.assigned && <span className="muted"> *</span>} {r.unit === 'pcs' ? <span className="badge badge-gray" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Штучный</span>: <span className="badge badge-gray" style={{ marginLeft: 10, verticalAlign: 'middle' }}>килограмм</span>}
                          </td>
                          <td className="j-unit">{UNIT_LABEL[r.unit]}</td>
                          {days.map((d, colIndex) => (
                            <td key={d.day} className={`j-cell${d.weekend ? ' weekend' : ''}${d.isToday ? ' today' : ''}`}>
                              <Cell
                                value={r.values[d.day] ?? 0}
                                disabled={d.future}
                                unit={r.unit}
                                id={`${rowIndex}-${colIndex}`}
                                label={`${r.name}, ${d.day}`}
                                onCommit={(v) => commit(r, d.day, v)}
                                onError={(m) => toast(m, 'error')}
                              />
                            </td>
                          ))}
                          <td className="j-total">{r.total ? fmtNum(r.total) : 0}</td>
                        </tr>
                      )
                    })}
                  </Group>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
      {data && data.rows.some((r) => !r.assigned) && (
        <p className="muted small" style={{ marginTop: 8 }}>
          * продукт убран из магазина, но в этом месяце по нему есть приход. <Link className="link" to="products">Продукты магазина</Link>
        </p>
      )}

    </>
  )
}

function Group({ name, span, children }: { name: string; span: number; children: ReactNode }) {
  return (
    <>
      <tr className="group-row"><td colSpan={span}><span className="sticky-label">{name}</span></td></tr>
      {children}
    </>
  )
}

interface CellProps {
  className?: string
  value: number
  disabled: boolean
  unit: 'kg' | 'pcs'
  id: string
  label: string
  onCommit: (v: number) => Promise<void>
  onError: (msg: string) => void
}

function Cell({ className = 'cell-input', value, disabled, unit, id, label, onCommit, onError }: CellProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const shown = draft ?? (value ? String(value).replace('.', ',') : '')

  async function save() {
    if (draft === null) return
    const parsed = parseQty(draft)
    if (parsed === null) {
      setState('error')
      onError('Введите число, например 2,5')
      return
    }
    if (unit === 'pcs' && !Number.isInteger(parsed)) {
      setState('error')
      onError('Штуки — только целые числа')
      return
    }
    if (parsed === value) {
      setDraft(null)
      setState('idle')
      return
    }
    setState('saving')
    try {
      await onCommit(parsed)
      setDraft(null)
      setState('idle')
    } catch (e) {
      setState('error')
      onError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  function move(e: KeyboardEvent<HTMLInputElement>, dr: number, dc: number) {
    const [r, c] = id.split('-').map(Number)
    const next = document.querySelector<HTMLInputElement>(`[data-cell="${r + dr}-${c + dc}"]`)
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }

  return (
    <input
      className={`${className} ${state}`}
      data-cell={id}
      aria-label={label}
      inputMode="decimal"
      disabled={disabled || state === 'saving'}
      value={shown}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setDraft(e.target.value)
        if (state === 'error') setState('idle')
      }}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
          move(e, e.shiftKey ? -1 : 1, 0)
        } else if (e.key === 'Escape') {
          setDraft(null)
          setState('idle')
        } else if (e.key === 'ArrowDown') move(e, 1, 0)
        else if (e.key === 'ArrowUp') move(e, -1, 0)
      }}
    />
  )
}
