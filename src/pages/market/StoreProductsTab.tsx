import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoriesApi, marketsApi, productsApi } from '../../api/resources'
import type { Category, Market, Unit } from '../../api/types'
import { Modal } from '../../components/Modal'
import { Empty, ErrorState, Loader } from '../../components/States'
import { useToast } from '../../components/Toast'
import { UNIT_LABEL, UNIT_OPTIONS, productsWord } from '../../lib/format'
import { useMarket } from './MarketLayout'

// Какие продукты получает магазин. Каталог продуктов и категорий общий,
// а набор продуктов у каждого магазина свой.
export function StoreProductsTab() {
  const market = useMarket()
  const id = market.id
  const qc = useQueryClient()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const assigned = useQuery({ queryKey: ['markets', id, 'products'], queryFn: () => marketsApi.getProducts(id) })
  const products = useQuery({ queryKey: ['products'], queryFn: productsApi.list })
  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })

  const [selected, setSelected] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (assigned.data) setSelected(new Set(assigned.data.productIds))
  }, [assigned.data])

  const dirty = useMemo(() => {
    const orig = assigned.data?.productIds ?? []
    return orig.length !== selected.size || orig.some((pid) => !selected.has(pid))
  }, [assigned.data, selected])

  // По умолчанию показываем продукты магазина; «весь каталог» — чтобы добавить из общего списка
  const groups = useMemo(() => {
    const orig = new Set(assigned.data?.productIds ?? [])
    return (categories.data ?? [])
      .map((c) => ({
        category: c,
        items: (products.data ?? []).filter((p) => p.categoryId === c.id && (showAll || orig.has(p.id) || selected.has(p.id))),
      }))
      .filter((g) => g.items.length > 0)
  }, [categories.data, products.data, showAll, assigned.data, selected])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['markets'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['journal', id] })
  }

  const save = useMutation({
    mutationFn: () => marketsApi.setProducts(id, [...selected]),
    onSuccess: (res) => {
      qc.setQueryData(['markets', id, 'products'], res)
      invalidate()
      toast('Список продуктов магазина сохранён')
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const toggle = (pid: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })

  const toggleGroup = (ids: number[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      ids.forEach((pid) => (on ? next.add(pid) : next.delete(pid)))
      return next
    })

  const isLoading = assigned.isLoading || products.isLoading || categories.isLoading
  const error = assigned.error || products.error || categories.error
  if (isLoading) return <Loader />
  if (error) return <ErrorState error={error} />

  return (
    <>
      <div className="journal-bar">
        <p className="muted">
          В магазине: <strong>{productsWord(selected.size)}</strong>. Только эти продукты показываются в журнале магазина.
        </p>
        <div className="spacer" />
        <label className="checkbox small">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          <span>Показать весь каталог</span>
        </label>
        <button className="btn" onClick={() => setCreating(true)}>+ Новый продукт</button>
        {dirty && (
          <>
            <button className="btn" disabled={save.isPending} onClick={() => setSelected(new Set(assigned.data?.productIds))}>Отменить</button>
            <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>
          </>
        )}
      </div>

      {!groups.length ? (
        <div className="card">
          <Empty text={showAll ? 'Каталог пуст — добавьте продукт.' : 'В магазине пока нет продуктов. Добавьте новый или отметьте «Показать весь каталог».'} />
        </div>
      ) : (
        <div className="assign-grid">
          {groups.map(({ category, items }) => {
            const ids = items.map((p) => p.id)
            const count = ids.filter((pid) => selected.has(pid)).length
            const all = count === ids.length
            return (
              <section key={category.id} className="card assign-card">
                <header className="assign-head">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={all}
                      ref={(el) => {
                        if (el) el.indeterminate = count > 0 && !all
                      }}
                      onChange={() => toggleGroup(ids, !all)}
                    />
                    <span>{category.name}</span>
                  </label>
                  <span className="muted small">{count} / {ids.length}</span>
                </header>
                <ul className="assign-list">
                  {items.map((p) => (
                    <li key={p.id} className={p.isActive ? '' : 'inactive'}>
                      <label className="checkbox">
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                        <span>{p.name}</span>
                      </label>
                      <span className={`unit unit-${p.unit}`}>{UNIT_LABEL[p.unit]}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {creating && categories.data && (
        <NewStoreProduct market={market} categories={categories.data} onDone={invalidate} onClose={() => setCreating(false)} />
      )}
    </>
  )
}

function NewStoreProduct({ market, categories, onDone, onClose }: {
  market: Market
  categories: Category[]
  onDone: () => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0)
  const [unit, setUnit] = useState<Unit>('kg')

  const save = useMutation({
    mutationFn: () => marketsApi.createProduct(market.id, { name: name.trim(), categoryId, unit }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['markets', market.id, 'products'] })
      onDone()
      toast(res.existed ? `«${name.trim()}» уже был в каталоге — добавлен в магазин` : `«${name.trim()}» добавлен в магазин`)
      onClose()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <Modal
      title={`Новый продукт — ${market.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" form="store-product-form" disabled={save.isPending}>
            {save.isPending ? 'Сохранение…' : 'Добавить в магазин'}
          </button>
        </>
      }
    >
      <form id="store-product-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Наименование *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoFocus placeholder="Например: Творог" />
          <small className="hint">Если такой продукт уже есть в общем каталоге, он просто добавится в этот магазин.</small>
        </label>
        <label className="field">
          <span>Категория *</span>
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} required>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="field">
          <span>Единица измерения *</span>
          <div className="segmented">
            {UNIT_OPTIONS.map((o) => (
              <label key={o.value} className={unit === o.value ? 'selected' : ''}>
                <input type="radio" name="unit" checked={unit === o.value} onChange={() => setUnit(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </div>
        {save.error && <div className="form-error">{save.error.message}</div>}
      </form>
    </Modal>
  )
}
