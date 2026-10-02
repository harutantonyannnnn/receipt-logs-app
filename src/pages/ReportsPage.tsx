import { ReportsView } from '../components/reports/ReportsView'

export function ReportsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Отчёты</h1>
          <p className="muted">Какие продукты пришли больше всего — по магазину или по всей сети, за любой период.</p>
        </div>
      </div>
      <ReportsView />
    </>
  )
}
