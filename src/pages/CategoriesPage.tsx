import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoriesApi } from '../api/resources'
import type { Category, CategoryInput } from '../api/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { Empty, ErrorState, Loader } from '../components/States'
import { useToast } from '../components/Toast'
import { productsWord } from '../lib/format'
import { IconTrash } from '../components/Icons'

export function CategoriesPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const remove = useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast('Категория удалена')
      setDeleting(null)
    },
    onError: (e) => {
      toast(e.message, 'error')
      setDeleting(null)
    },
  })

  const nextOrder = data?.length ? Math.max(...data.map((c) => c.sortOrder)) + 10 : 10

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Категории</h1>
          <p className="muted">Группы продуктов. Порядок — как они идут в журнале.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Категория</button>
      </div>

      <div className="card">
        {isLoading ? <Loader /> : error ? <ErrorState error={error} /> : !data?.length ? (
          <Empty text="Категорий пока нет" />
        ) : (
          <>
          <table className="table desktop-only">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Порядок</th>
                <th>Название</th>
                <th>Продукты</th>
                <th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="muted">{c.sortOrder}</td>
                  <td className="strong">{c.name}</td>
                  <td>
                    <Link to={`/products?category=${c.id}`} className="link">{productsWord(c.productsCount)}</Link>
                  </td>
                  <td className="actions">
                    <button className="btn btn-sm" onClick={() => setEditing(c)}>Изменить</button>
                    <button
                      className="btn btn-sm btn-danger-ghost"
                      onClick={() => setDeleting(c)}
                      disabled={c.productsCount > 0}
                      title={c.productsCount > 0 ? 'Сначала удалите или перенесите продукты этой категории' : undefined}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="m-rows mobile-only">
            {data.map((c) => (
              <li key={c.id}>
                <button className="m-row-main" onClick={() => setEditing(c)}>
                  <span className="m-row-name">{c.name}</span>
                  <span className="m-row-sub">{productsWord(c.productsCount)} · порядок {c.sortOrder}</span>
                </button>
                <Link to={`/products?category=${c.id}`} className="btn btn-sm">Продукты</Link>
                <button
                  className="icon-action danger"
                  onClick={() => setDeleting(c)}
                  disabled={c.productsCount > 0}
                  aria-label="Удалить"
                >
                  <IconTrash width={19} height={19} />
                </button>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>

      {editing && (
        <CategoryForm category={editing === 'new' ? null : editing} defaultOrder={nextOrder} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Удалить категорию?"
          message={`Категория «${deleting.name}» будет удалена.`}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

function CategoryForm({ category, defaultOrder, onClose }: { category: Category | null; defaultOrder: number; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? defaultOrder))

  const save = useMutation({
    mutationFn: (body: CategoryInput) => (category ? categoriesApi.update(category.id, body) : categoriesApi.create(body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast(category ? 'Изменения сохранены' : 'Категория добавлена')
      onClose()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({ name: name.trim(), sortOrder: Number(sortOrder) || 0 })
  }

  return (
    <Modal
      title={category ? 'Редактировать категорию' : 'Новая категория'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" form="category-form" disabled={save.isPending}>
            {save.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Название *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoFocus placeholder="Например: Молочное и сыры" />
        </label>
        <label className="field">
          <span>Порядок сортировки</span>
          <input type="number" min={0} step={1} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          <small className="hint">Чем меньше число, тем выше категория в списке</small>
        </label>
        {save.error && <div className="form-error">{save.error.message}</div>}
      </form>
    </Modal>
  )
}
