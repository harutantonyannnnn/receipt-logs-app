import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoriesApi, productsApi } from '../api/resources'
import type { Category, Product, ProductInput, Unit } from '../api/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { Empty, ErrorState, Loader } from '../components/States'
import { useToast } from '../components/Toast'
import { UNIT_LABEL, UNIT_OPTIONS } from '../lib/format'
import { IconTrash } from '../components/Icons'

export function ProductsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const categoryFilter = Number(params.get('category')) || 0
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)

  const products = useQuery({ queryKey: ['products'], queryFn: productsApi.list })
  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })

  const remove = useMutation({
    mutationFn: (id: number) => productsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['markets'] })
      toast('Продукт удалён')
      setDeleting(null)
    },
    onError: (e) => {
      toast(e.message, 'error')
      setDeleting(null)
    },
  })

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (products.data ?? []).filter(
      (p) => (!categoryFilter || p.categoryId === categoryFilter) && (!q || p.name.toLowerCase().includes(q)),
    )
    return (categories.data ?? [])
      .map((c) => ({ category: c, items: list.filter((p) => p.categoryId === c.id) }))
      .filter((g) => g.items.length > 0)
  }, [products.data, categories.data, search, categoryFilter])

  const isLoading = products.isLoading || categories.isLoading
  const error = products.error || categories.error
  const noCategories = categories.data && categories.data.length === 0

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Продукты</h1>
          <p className="muted">{products.data ? `Всего: ${products.data.length}` : ' '}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={noCategories}>
          + Продукт
        </button>
      </div>

      <div className="toolbar">
        <input className="search" type="search" placeholder="Поиск продукта…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select
          value={categoryFilter}
          onChange={(e) => {
            const v = Number(e.target.value)
            setParams(v ? { category: String(v) } : {})
          }}
        >
          <option value={0}>Все категории</option>
          {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card">
        {isLoading ? <Loader /> : error ? <ErrorState error={error} /> : noCategories ? (
          <Empty text="Сначала создайте хотя бы одну категорию" />
        ) : !groups.length ? (
          <Empty text={search || categoryFilter ? 'Ничего не найдено' : 'Продуктов пока нет'} />
        ) : (
          <>
          <table className="table desktop-only">
            <thead>
              <tr>
                <th>Наименование продукта</th>
                <th style={{ width: 80 }}>Ед.</th>
                <th style={{ width: 130 }}>Магазинов</th>
                <th style={{ width: 120 }}>Статус</th>
                <th className="actions-col" />
              </tr>
            </thead>
            {groups.map(({ category, items }) => (
              <tbody key={category.id}>
                <tr className="group-row">
                  <td colSpan={5}>{category.name}</td>
                </tr>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="strong">{p.name}</td>
                    <td><span className={`unit unit-${p.unit}`}>{UNIT_LABEL[p.unit]}</span></td>
                    <td className="muted">{p.marketsCount}</td>
                    <td>
                      <span className={`badge ${p.isActive ? 'badge-green' : 'badge-gray'}`}>
                        {p.isActive ? 'Активен' : 'Скрыт'}
                      </span>
                    </td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => setEditing(p)}>Изменить</button>
                      <button
                        className="btn btn-sm btn-danger-ghost"
                        onClick={() => setDeleting(p)}
                        disabled={p.receiptsCount > 0}
                        title={p.receiptsCount > 0 ? 'По продукту есть приход — его можно только сделать неактивным' : undefined}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>

          <div className="mobile-only">
            {groups.map(({ category, items }) => (
              <section key={category.id} className="m-group">
                <h4 className="m-group-title">{category.name} <span>{items.length}</span></h4>
                <ul className="m-rows">
                  {items.map((p) => (
                    <li key={p.id} className={p.isActive ? '' : 'inactive'}>
                      <button className="m-row-main" onClick={() => setEditing(p)}>
                        <span className="m-row-name">{p.name}</span>
                        <span className="m-row-sub">
                          {p.marketsCount ? `в ${p.marketsCount} маг.` : 'не в магазинах'}
                          {!p.isActive && ' · скрыт'}
                        </span>
                      </button>
                      <span className={`unit unit-${p.unit}`}>{UNIT_LABEL[p.unit]}</span>
                      <button
                        className="icon-action danger"
                        onClick={() => setDeleting(p)}
                        disabled={p.receiptsCount > 0}
                        aria-label="Удалить"
                      >
                        <IconTrash width={19} height={19} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          </>
        )}
      </div>

      {editing && categories.data && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          categories={categories.data}
          defaultCategoryId={categoryFilter || categories.data[0]?.id}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Удалить продукт?"
          message={
            deleting.receiptsCount > 0
              ? `По продукту «${deleting.name}» уже есть приход — удалить его нельзя. Снимите галочку «Активен», чтобы скрыть его.`
              : deleting.marketsCount > 0
              ? `Продукт «${deleting.name}» назначен ${deleting.marketsCount} магазин(ам) и будет убран из них.`
              : `Продукт «${deleting.name}» будет удалён.`
          }
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

interface FormProps {
  product: Product | null
  categories: Category[]
  defaultCategoryId?: number
  onClose: () => void
}

function ProductForm({ product, categories, defaultCategoryId, onClose }: FormProps) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? defaultCategoryId ?? 0)
  const [unit, setUnit] = useState<Unit>(product?.unit ?? 'kg')
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0))
  const [isActive, setIsActive] = useState(product?.isActive ?? true)

  const save = useMutation({
    mutationFn: (body: ProductInput) => (product ? productsApi.update(product.id, body) : productsApi.create(body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast(product ? 'Изменения сохранены' : 'Продукт добавлен')
      onClose()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({ name: name.trim(), categoryId, unit, sortOrder: Number(sortOrder) || 0, isActive })
  }

  return (
    <Modal
      title={product ? 'Редактировать продукт' : 'Новый продукт'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" form="product-form" disabled={save.isPending}>
            {save.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Наименование *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoFocus placeholder="Например: Творог" />
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
                <input type="radio" name="unit" value={o.value} checked={unit === o.value} onChange={() => setUnit(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Порядок в категории</span>
          <input type="number" min={0} step={1} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Активен (показывать в журнале)</span>
        </label>
        {save.error && <div className="form-error">{save.error.message}</div>}
      </form>
    </Modal>
  )
}
