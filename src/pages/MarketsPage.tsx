import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { marketsApi } from '../api/resources'
import type { Market, MarketInput } from '../api/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { Empty, ErrorState, Loader } from '../components/States'
import { useToast } from '../components/Toast'
import { useOpenReceipt } from '../components/NewReceiptModal'
import { IconEdit, IconPlus, IconTrash } from '../components/Icons'
import { productsWord } from '../lib/format'
import { formatDateShort } from '../lib/dates'

export function MarketsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const openReceipt = useOpenReceipt()
  const { data, isLoading, error } = useQuery({ queryKey: ['markets'], queryFn: marketsApi.list })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Market | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Market | null>(null)

  const remove = useMutation({
    mutationFn: (id: number) => marketsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['markets'] })
      toast('Магазин удалён')
      setDeleting(null)
    },
    onError: (e) => {
      toast(e.message, 'error')
      setDeleting(null)
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? []).filter((m) => !q || m.name.toLowerCase().includes(q) || m.address.toLowerCase().includes(q))
  }, [data, search])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Магазины</h1>
          <p className="muted">{data ? `Всего: ${data.length}` : ' '}</p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => setEditing('new')}>+ Магазин</button>
          <button className="btn btn-primary desktop-only" onClick={() => openReceipt()}>+ Новый приход</button>
        </div>
      </div>

      <div className="toolbar">
        <input className="search" type="search" placeholder="Поиск магазина…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card">
        {isLoading ? <Loader /> : error ? <ErrorState error={error} /> : !filtered.length ? (
          <Empty text={search ? 'Ничего не найдено' : 'Магазинов пока нет. Добавьте первый.'} />
        ) : (
          <>
          <table className="table desktop-only">
            <thead>
              <tr>
                <th>Название</th>
                <th>Адрес</th>
                <th>Продукты</th>
                <th>Последний приход</th>
                <th>Статус</th>
                <th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="clickable" onClick={() => navigate(`/markets/${m.id}`)}>
                  <td className="strong">{m.name}</td>
                  <td className="muted">{m.address || '—'}</td>
                  <td>
                    <Link to={`/markets/${m.id}/products`} className="link" onClick={(e) => e.stopPropagation()}>{productsWord(m.productsCount)}</Link>
                  </td>
                  <td className="muted">{m.lastReceiptDate ? formatDateShort(m.lastReceiptDate) : '—'}</td>
                  <td>
                    <span className={`badge ${m.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {m.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/markets/${m.id}`} className="btn btn-sm btn-primary-soft">Журнал</Link>
                    <Link to={`/markets/${m.id}/reports`} className="btn btn-sm">Отчёты</Link>
                    <button className="btn btn-sm" onClick={() => setEditing(m)}>Изменить</button>
                    <button
                      className="btn btn-sm btn-danger-ghost"
                      onClick={() => setDeleting(m)}
                      disabled={Boolean(m.lastReceiptDate)}
                      title={m.lastReceiptDate ? 'У магазина есть приход — его можно только сделать неактивным' : undefined}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="m-list mobile-only">
            {filtered.map((m) => (
              <li key={m.id} className="m-card">
                <Link to={`/markets/${m.id}`} className="m-card-main">
                  <div className="m-card-title">
                    <span>{m.name}</span>
                    {!m.isActive && <span className="badge badge-gray">Неактивен</span>}
                  </div>
                  {m.address && <div className="m-card-sub">{m.address}</div>}
                  <div className="m-card-meta">
                    <span>{productsWord(m.productsCount)}</span>
                    <span>Последний приход: {m.lastReceiptDate ? formatDateShort(m.lastReceiptDate) : '—'}</span>
                  </div>
                </Link>
                <div className="m-card-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => openReceipt(m.id)}><IconPlus width={16} height={16} /> Приход</button>
                  <Link to={`/markets/${m.id}/reports`} className="btn btn-sm">Отчёты</Link>
                  <div className="spacer" />
                  <button className="icon-action" onClick={() => setEditing(m)} aria-label="Изменить"><IconEdit width={19} height={19} /></button>
                  <button
                    className="icon-action danger"
                    onClick={() => setDeleting(m)}
                    disabled={Boolean(m.lastReceiptDate)}
                    aria-label="Удалить"
                  >
                    <IconTrash width={19} height={19} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>

      {editing && <MarketForm market={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Удалить магазин?"
          message={`Магазин «${deleting.name}» будет удалён. Если по магазину уже есть приход, удалить его нельзя — сделайте его неактивным.`}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

function MarketForm({ market, onClose }: { market: Market | null; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<MarketInput>({
    name: market?.name ?? '',
    address: market?.address ?? '',
    isActive: market?.isActive ?? true,
  })

  const save = useMutation({
    mutationFn: (body: MarketInput) => (market ? marketsApi.update(market.id, body) : marketsApi.create(body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['markets'] })
      toast(market ? 'Изменения сохранены' : 'Магазин добавлен')
      onClose()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate({ ...form, name: form.name.trim(), address: form.address.trim() })
  }

  return (
    <Modal
      title={market ? 'Редактировать магазин' : 'Новый магазин'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" form="market-form" disabled={save.isPending}>
            {save.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </>
      }
    >
      <form id="market-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Название *</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} autoFocus placeholder="Например: Магазин на Абовяна" />
        </label>
        <label className="field">
          <span>Адрес</span>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={300} placeholder="Необязательно" />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          <span>Активен</span>
        </label>
        {save.error && <div className="form-error">{save.error.message}</div>}
      </form>
    </Modal>
  )
}
