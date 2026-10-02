import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { categoriesApi, marketsApi, reportsApi } from '../../api/resources'
import type { GroupBy, ReportFilter, ReportProduct, Unit } from '../../api/types'
import {
  PRESETS, daysBetween, formatBucket, formatBucketTick, formatDate, presetRange, today, type PresetKey,
} from '../../lib/dates'
import { UNIT_LABEL, fmtNum, fmtQty } from '../../lib/format'
import { ErrorState, Loader } from '../States'
import { BarChart } from './BarChart'

const UNIT_COLOR: Record<Unit, string> = { kg: '#2f5aa8', pcs: '#b7791f' }

function autoGroup(days: number): GroupBy {
  if (days <= 45) return 'day'
  if (days <= 200) return 'week'
  return 'month'
}

interface Props {
  // Если задан — отчёт только по этому магазину (вкладка магазина)
  fixedMarketId?: number
}

// Отчёт «какой продукт пришёл больше всего» за день / неделю / месяц / любой период.
// Состояние фильтров хранится в URL, чтобы ссылкой можно было поделиться.
export function ReportsView({ fixedMarketId }: Props) {
  const [params, setParams] = useSearchParams()
  const rawPreset = params.get('p') as PresetKey | null
  const preset: PresetKey = rawPreset && PRESETS.some((p) => p.key === rawPreset) ? rawPreset : 'month'
  const range =
    preset === 'custom'
      ? { from: params.get('from') || presetRange('month').from, to: params.get('to') || today() }
      : presetRange(preset)
  const categoryId = Number(params.get('cat')) || undefined
  const marketId = fixedMarketId ?? (Number(params.get('m')) || undefined)
  const productId = Number(params.get('prod')) || undefined
  const periodDays = range.from <= range.to ? daysBetween(range.from, range.to) : 0
  const groupBy = (params.get('g') as GroupBy) || autoGroup(periodDays)
  const chartUnit = (params.get('u') as Unit) || 'kg'

  const update = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || v === 0) next.delete(k)
      else next.set(k, String(v))
    }
    setParams(next, { replace: true })
  }

  const filter: ReportFilter = { from: range.from, to: range.to, marketId, categoryId }
  const validRange = periodDays > 0
  const summary = useQuery({
    queryKey: ['reports', 'summary', filter],
    queryFn: () => reportsApi.summary(filter),
    enabled: validRange,
  })
  const timelineGroup: GroupBy = groupBy === 'day' && periodDays > 400 ? 'week' : groupBy
  const timeline = useQuery({
    queryKey: ['reports', 'timeline', filter, productId, timelineGroup],
    queryFn: () => reportsApi.timeline({ ...filter, productId, groupBy: timelineGroup }),
    enabled: validRange,
  })
  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const markets = useQuery({ queryKey: ['markets'], queryFn: marketsApi.list, enabled: !fixedMarketId })

  const byUnit = useMemo(() => {
    const list = summary.data?.products ?? []
    return { kg: list.filter((p) => p.unit === 'kg'), pcs: list.filter((p) => p.unit === 'pcs') }
  }, [summary.data])

  const drilled = summary.data?.products.find((p) => p.id === productId)
  const effectiveUnit: Unit = drilled?.unit ?? chartUnit

  const bars = (timeline.data?.rows ?? []).map((r) => ({
    key: r.bucket,
    tick: formatBucketTick(r.bucket, timelineGroup),
    label: formatBucket(r.bucket, timelineGroup),
    value: r[effectiveUnit],
  }))

  function exportCsv() {
    if (!summary.data) return
    const lines = [
      ['Продукт', 'Категория', 'Ед.', 'Итого', 'Дней с приходом', 'Среднее за день прихода', 'Максимум за день'],
      ...summary.data.products.map((p) => [
        p.name, p.categoryName, UNIT_LABEL[p.unit], p.total, p.days, Math.round((p.total / p.days) * 100) / 100, p.maxDay,
      ]),
    ]
    const csv = '﻿' + lines.map((l) => l.map((v) => `"${String(v).replace('.', ',').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `prihod_${range.from}_${range.to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const t = summary.data?.totals

  return (
    <div className="reports">
      <div className="filters card">
        <div className="presets" role="group" aria-label="Период">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`chip${preset === p.key ? ' active' : ''}`}
              onClick={() => update(p.key === 'custom' ? { p: 'custom', from: range.from, to: range.to, g: undefined } : { p: p.key === 'month' ? undefined : p.key, from: undefined, to: undefined, g: undefined })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="filter-row">
          {preset === 'custom' && (
            <>
              <label className="inline-field">
                <span>с</span>
                <input type="date" value={range.from} max={range.to} onChange={(e) => update({ from: e.target.value, g: undefined })} />
              </label>
              <label className="inline-field">
                <span>по</span>
                <input type="date" value={range.to} min={range.from} onChange={(e) => update({ to: e.target.value, g: undefined })} />
              </label>
            </>
          )}
          {!fixedMarketId && (
            <select value={marketId ?? 0} onChange={(e) => update({ m: Number(e.target.value), prod: undefined })} aria-label="Магазин">
              <option value={0}>Все магазины</option>
              {markets.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          <select value={categoryId ?? 0} onChange={(e) => update({ cat: Number(e.target.value), prod: undefined })} aria-label="Категория">
            <option value={0}>Все категории</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="spacer" />
          <span className="muted small">
            {validRange ? `${formatDate(range.from)} — ${formatDate(range.to)} · ${periodDays} дн.` : 'Неверный период'}
          </span>
          <button className="btn btn-sm" onClick={exportCsv} disabled={!summary.data?.products.length}>Скачать CSV</button>
        </div>
      </div>

      {summary.isLoading ? <Loader /> : summary.error ? <ErrorState error={summary.error} /> : t && (
        <>
          <div className="kpis">
            <Kpi label="Получено по весу" value={fmtQty(t.kg, 'kg')} />
            <Kpi label="Получено в штуках" value={fmtQty(t.pcs, 'pcs')} />
            <Kpi label="Дней с приходом" value={`${t.activeDays} из ${summary.data!.periodDays}`} />
            <Kpi label="Разных продуктов" value={String(t.productsCount)} />
          </div>

          <section className="card chart-card">
            <header className="chart-head">
              <div>
                <h3>Динамика прихода{drilled ? `: ${drilled.name}` : effectiveUnit === 'kg' ? ' — по весу' : ' — в штуках'}</h3>
                <p className="muted small">
                  {drilled ? 'Нажмите на другой продукт в рейтинге или сбросьте выбор' : 'Нажмите на продукт в рейтинге, чтобы увидеть его динамику'}
                </p>
              </div>
              <div className="chart-controls">
                {drilled ? (
                  <button className="btn btn-sm" onClick={() => update({ prod: undefined })}>× Все продукты</button>
                ) : (
                  <Segmented
                    value={chartUnit}
                    options={[{ value: 'kg', label: 'кг' }, { value: 'pcs', label: 'шт' }]}
                    onChange={(v) => update({ u: v === 'kg' ? undefined : v })}
                  />
                )}
                <Segmented
                  value={timelineGroup}
                  options={[
                    { value: 'day', label: 'По дням', disabled: periodDays > 400 },
                    { value: 'week', label: 'По неделям' },
                    { value: 'month', label: 'По месяцам' },
                  ]}
                  onChange={(v) => update({ g: v })}
                />
              </div>
            </header>
            {timeline.isLoading ? <Loader /> : timeline.error ? <ErrorState error={timeline.error} /> : (
              <BarChart data={bars} unit={UNIT_LABEL[effectiveUnit]} color={UNIT_COLOR[effectiveUnit]} format={fmtNum} />
            )}
          </section>

          <div className="rank-grid">
            <Ranking title="Больше всего по весу" unit="kg" items={byUnit.kg} activeId={productId} onPick={(id) => update({ prod: id === productId ? undefined : id })} />
            <Ranking title="Больше всего в штуках" unit="pcs" items={byUnit.pcs} activeId={productId} onPick={(id) => update({ prod: id === productId ? undefined : id })} />
          </div>

          <div className="rank-grid">
            {!marketId && summary.data!.markets.length > 0 && (
              <section className="card">
                <header className="card-head"><h3>По магазинам</h3></header>
                <table className="table compact">
                  <thead><tr><th>Магазин</th><th className="num">кг</th><th className="num">шт</th><th className="num hide-sm">Дней</th></tr></thead>
                  <tbody>
                    {summary.data!.markets.map((m) => (
                      <tr key={m.id}>
                        <td><Link className="link" to={`/markets/${m.id}/reports?${params.toString()}`}>{m.name}</Link></td>
                        <td className="num">{fmtNum(m.kg)}</td>
                        <td className="num">{fmtNum(m.pcs)}</td>
                        <td className="num muted hide-sm">{m.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {summary.data!.categories.length > 0 && (
              <section className="card">
                <header className="card-head"><h3>По категориям</h3></header>
                <table className="table compact">
                  <thead><tr><th>Категория</th><th className="num">кг</th><th className="num">шт</th></tr></thead>
                  <tbody>
                    {summary.data!.categories.map((c) => (
                      <tr key={c.id} className="clickable" onClick={() => update({ cat: c.id, prod: undefined })}>
                        <td>{c.name}</td>
                        <td className="num">{c.kg ? fmtNum(c.kg) : '—'}</td>
                        <td className="num">{c.pcs ? fmtNum(c.pcs) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'active' : ''} disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Ranking({ title, unit, items, activeId, onPick }: {
  title: string
  unit: Unit
  items: ReportProduct[]
  activeId?: number
  onPick: (id: number) => void
}) {
  const max = items[0]?.total ?? 0
  const sum = items.reduce((s, p) => s + p.total, 0)
  return (
    <section className="card">
      <header className="card-head">
        <h3>{title}, {UNIT_LABEL[unit]}</h3>
        <span className="muted small">{items.length ? `всего ${fmtQty(sum, unit)}` : ''}</span>
      </header>
      {!items.length ? (
        <div className="state">Нет прихода за период</div>
      ) : (
        <table className="table compact rank">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Продукт</th>
              <th className="num">Итого</th>
              <th className="num hide-sm" title="Сколько дней был приход">Дней</th>
              <th className="num hide-sm" title="Среднее количество в день, когда был приход">Сред.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={p.id} className={`clickable${activeId === p.id ? ' selected' : ''}`} onClick={() => onPick(p.id)}>
                <td className="muted">{i + 1}</td>
                <td>
                  <div className="rank-name">{p.name}</div>
                  <div className="rank-bar-track">
                    <div className="rank-bar" style={{ width: `${(p.total / max) * 100}%`, background: UNIT_COLOR[unit] }} />
                  </div>
                </td>
                <td className="num strong">
                  {fmtNum(p.total)}
                  <div className="muted small">{sum ? Math.round((p.total / sum) * 100) : 0}%</div>
                </td>
                <td className="num muted hide-sm">{p.days}</td>
                <td className="num muted hide-sm">{fmtNum(Math.round((p.total / p.days) * 10) / 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
