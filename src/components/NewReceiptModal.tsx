import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoriesApi, marketsApi, productsApi, receiptsApi, type NewReceiptItem } from '../api/resources'
import type { Product, Unit } from '../api/types'
import { formatDate, today } from '../lib/dates'
import { UNIT_LABEL, fmtQty, parseQty } from '../lib/format'
import { Modal } from './Modal'
import { useToast } from './Toast'

// ---------- Открытие окна из любого места приложения ----------

const OpenReceiptContext = createContext<(marketId?: number) => void>(() => {})

// eslint-disable-next-line react-refresh/only-export-components
export const useOpenReceipt = () => useContext(OpenReceiptContext)

export function ReceiptModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; marketId?: number }>({ open: false })
  const open = useCallback((marketId?: number) => setState({ open: true, marketId }), [])
  return (
    <OpenReceiptContext.Provider value={open}>
      {children}
      {state.open && <NewReceiptModal initialMarketId={state.marketId} onClose={() => setState({ open: false })} />}
    </OpenReceiptContext.Provider>
  )
}

// ---------- Окно «Новый приход» ----------

const LAST_MARKET_KEY = 'rl_last_market'
const readLastMarket = () => {
  try {
    return Number(localStorage.getItem(LAST_MARKET_KEY)) || 0
  } catch {
    return 0
  }
}
const saveLastMarket = (id: number) => {
  try {
    localStorage.setItem(LAST_MARKET_KEY, String(id))
  } catch {
    /* не критично */
  }
}

interface Line {
  key: number
  categoryId: number // 0 — все категории
  productId: number | 'new' | 0
  newName: string
  newUnit: Unit
  qty: string
}

let lineSeq = 1
const emptyLine = (categoryId = 0): Line => ({ key: lineSeq++, categoryId, productId: 0, newName: '', newUnit: 'kg', qty: '' })

interface LineCheck {
  unit: Unit | null
  qty: number | null
  error: string | null
  item: NewReceiptItem | null
}

function checkLine(line: Line, productsById: Map<number, Product>): LineCheck {
  const isNew = line.productId === 'new'
  const product = typeof line.productId === 'number' ? productsById.get(line.productId) : undefined
  const unit: Unit | null = isNew ? line.newUnit : product?.unit ?? null
  const parsed = parseQty(line.qty)

  let error: string | null = null
  if (!line.productId) error = 'Выберите продукт'
  else if (isNew && !line.newName.trim()) error = 'Введите название нового продукта'
  else if (isNew && !line.categoryId) error = 'Для нового продукта выберите категорию'
  else if (!line.qty.trim()) error = 'Введите количество'
  else if (parsed === null) error = 'Число, например 0,5 или 3,63'
  else if (parsed <= 0) error = 'Количество должно быть больше нуля'
  else if (unit === 'pcs' && !Number.isInteger(parsed)) error = 'Штуки — только целое число'

  const qty = parsed && parsed > 0 ? parsed : null
  const item: NewReceiptItem | null = error
    ? null
    : isNew
      ? { newProduct: { name: line.newName.trim(), categoryId: line.categoryId, unit: line.newUnit }, quantity: qty! }
      : { productId: product!.id, quantity: qty! }
  return { unit, qty, error, item }
}

function NewReceiptModal({ initialMarketId, onClose }: { initialMarketId?: number; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const markets = useQuery({ queryKey: ['markets'], queryFn: marketsApi.list })
  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const products = useQuery({ queryKey: ['products'], queryFn: productsApi.list })

  const [marketId, setMarketId] = useState(initialMarketId ?? readLastMarket())
  const [date, setDate] = useState(today())
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [showErrors, setShowErrors] = useState(false)
  const [serverError, setServerError] = useState('')
  const qtyRefs = useRef(new Map<number, HTMLInputElement>())
  const againRef = useRef(false)

  const activeMarkets = useMemo(() => (markets.data ?? []).filter((m) => m.isActive || m.id === marketId), [markets.data, marketId])
  const marketValid = activeMarkets.some((m) => m.id === marketId)
  const productsById = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data])
  const checks = lines.map((l) => checkLine(l, productsById))
  const totals = checks.reduce(
    (t, c) => {
      if (c.item && c.unit && c.qty) t[c.unit] += c.qty
      return t
    },
    { kg: 0, pcs: 0 },
  )

  const patch = (key: number, p: Partial<Line>) => {
    setServerError('')
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)))
  }

  const addLine = () => {
    const last = lines[lines.length - 1]
    const line = emptyLine(last?.categoryId ?? 0)
    setLines((ls) => [...ls, line])
    return line.key
  }

  const save = useMutation({
    mutationFn: () =>
      receiptsApi.create({ marketId, date, items: checks.map((c) => c.item!) }),
    onSuccess: (res) => {
      saveLastMarket(marketId)
      qc.invalidateQueries({ queryKey: ['journal'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['markets'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      const n = res.items.length
      const first = res.items[0]
      toast(
        n === 1
          ? `${res.market.name}: ${first.name} +${fmtQty(first.added, first.unit)} (${formatDate(res.date)})`
          : `${res.market.name}: сохранено ${n} поз. за ${formatDate(res.date)}`,
      )
      if (againRef.current) {
        setLines([emptyLine(lines[lines.length - 1]?.categoryId ?? 0)])
        setShowErrors(false)
      } else {
        onClose()
      }
    },
    onError: (e) => setServerError(e.message),
  })

  function submit(again: boolean) {
    setServerError('')
    setShowErrors(true)
    if (!marketValid) return setServerError('Выберите магазин')
    if (checks.some((c) => c.error)) return
    againRef.current = again
    save.mutate()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    submit(false)
  }

  const loading = markets.isLoading || categories.isLoading || products.isLoading

  return (
    <Modal
      title="Новый приход"
      onClose={onClose}
      width={760}
      footer={
        <div className="receipt-footer">
          <div className="muted small">
            Позиций: {lines.length}
            {totals.kg > 0 && <> · <strong>{fmtQty(totals.kg, 'kg')}</strong></>}
            {totals.pcs > 0 && <> · <strong>{fmtQty(totals.pcs, 'pcs')}</strong></>}
          </div>
          <div className="spacer" />
          <button type="button" className="btn desktop-only" onClick={onClose}>Отмена</button>
          <button type="button" className="btn" disabled={save.isPending} onClick={() => submit(true)}>
            Сохранить и добавить ещё
          </button>
          <button className="btn btn-primary" form="new-receipt-form" disabled={save.isPending}>
            {save.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="state"><span className="spinner" /> Загрузка…</div>
      ) : (
        <form id="new-receipt-form" onSubmit={onSubmit} noValidate>
          <div className="receipt-head">
            <label className="field">
              <span>Магазин *</span>
              <select
                value={marketId}
                onChange={(e) => {
                  setMarketId(Number(e.target.value))
                  setServerError('')
                }}
                className={showErrors && !marketValid ? 'invalid' : ''}
                autoFocus={!marketValid}
              >
                <option value={0} disabled>Выберите магазин…</option>
                {activeMarkets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Дата прихода</span>
              <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} />
            </label>
          </div>

          <div className="receipt-lines">
            <div className="receipt-line receipt-line-head">
              <span>Категория</span>
              <span>Продукт</span>
              <span>Количество</span>
              <span />
            </div>
            {lines.map((line, i) => {
              const c = checks[i]
              const visible = (products.data ?? []).filter(
                (p) => (p.isActive || p.id === line.productId) && (!line.categoryId || p.categoryId === line.categoryId),
              )
              const grouped = (categories.data ?? [])
                .map((cat) => ({ cat, items: visible.filter((p) => p.categoryId === cat.id) }))
                .filter((g) => g.items.length)
              const err = showErrors ? c.error : null
              return (
                <div key={line.key} className={`receipt-line${err ? ' has-error' : ''}`}>
                  <select
                    aria-label="Категория"
                    value={line.categoryId}
                    onChange={(e) => {
                      const categoryId = Number(e.target.value)
                      const keep = typeof line.productId === 'number' && productsById.get(line.productId)?.categoryId === categoryId
                      patch(line.key, { categoryId, productId: line.productId === 'new' || keep ? line.productId : 0 })
                    }}
                  >
                    <option value={0}>{line.productId === 'new' ? 'Выберите категорию…' : 'Все категории'}</option>
                    {categories.data?.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>

                  {line.productId === 'new' ? (
                    <div className="new-product">
                      <input
                        aria-label="Название нового продукта"
                        placeholder="Название нового продукта"
                        value={line.newName}
                        autoFocus
                        maxLength={200}
                        onChange={(e) => patch(line.key, { newName: e.target.value })}
                      />
                      <div className="seg">
                        {(['kg', 'pcs'] as Unit[]).map((u) => (
                          <button key={u} type="button" className={line.newUnit === u ? 'active' : ''} onClick={() => patch(line.key, { newUnit: u })}>
                            {UNIT_LABEL[u]}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="link-btn" onClick={() => patch(line.key, { productId: 0, newName: '' })}>
                        из списка
                      </button>
                    </div>
                  ) : (
                    <select
                      aria-label="Продукт"
                      value={line.productId}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === 'new') return patch(line.key, { productId: 'new' })
                        const id = Number(v)
                        patch(line.key, { productId: id, categoryId: line.categoryId || 0 })
                        requestAnimationFrame(() => qtyRefs.current.get(line.key)?.focus())
                      }}
                    >
                      <option value={0} disabled>Выберите продукт…</option>
                      {line.categoryId
                        ? visible.map((p) => <option key={p.id} value={p.id}>{p.name} ({UNIT_LABEL[p.unit]})</option>)
                        : grouped.map((g) => (
                            <optgroup key={g.cat.id} label={g.cat.name}>
                              {g.items.map((p) => <option key={p.id} value={p.id}>{p.name} ({UNIT_LABEL[p.unit]})</option>)}
                            </optgroup>
                          ))}
                      <option value="new">+ Новый продукт…</option>
                    </select>
                  )}

                  <div className="qty-cell">
                    <div className={`input-suffix${c.unit ? '' : ' no-unit'}`}>
                      <input
                        ref={(el) => {
                          if (el) qtyRefs.current.set(line.key, el)
                          else qtyRefs.current.delete(line.key)
                        }}
                        aria-label="Количество"
                        inputMode="decimal"
                        placeholder={c.unit === 'pcs' ? '2' : '0,5'}
                        value={line.qty}
                        onChange={(e) => patch(line.key, { qty: e.target.value })}
                        onKeyDown={(e) => {
                          // Enter — следующая позиция (новая строка, если это последняя)
                          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault()
                            if (i === lines.length - 1) addLine()
                            requestAnimationFrame(() => {
                              const rows = document.querySelectorAll<HTMLElement>('.receipt-line:not(.receipt-line-head)')
                              rows[i + 1]?.querySelector<HTMLElement>('select[aria-label="Продукт"], input')?.focus()
                            })
                          }
                        }}
                      />
                      <span>{c.unit ? UNIT_LABEL[c.unit] : '—'}</span>
                    </div>
                    {c.qty !== null && !c.error && (
                      <div className="qty-preview">= {fmtQty(c.qty, c.unit!)}</div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Удалить позицию"
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                  >
                    ×
                  </button>
                  {err && <div className="line-error">{err}</div>}
                </div>
              )
            })}
          </div>

          <button type="button" className="btn btn-sm add-line" onClick={addLine}>+ Ещё позиция</button>
          <p className="hint" style={{ marginTop: 10 }}>
            Количество можно писать через запятую или точку: 0,5 · 1.5 · 3,63 · 100. Если за этот день продукт уже
            вносили, количество прибавится. Новый продукт попадёт в общий каталог и в этот магазин.
          </p>
          {serverError && <div className="form-error">{serverError}</div>}
        </form>
      )}
    </Modal>
  )
}
