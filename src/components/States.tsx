export function Loader() {
  return <div className="state"><span className="spinner" /> Загрузка…</div>
}

export function ErrorState({ error }: { error: unknown }) {
  return <div className="state state-error">{error instanceof Error ? error.message : 'Ошибка загрузки'}</div>
}

export function Empty({ text }: { text: string }) {
  return <div className="state">{text}</div>
}
