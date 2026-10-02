import { NavLink, Outlet, useOutletContext, useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { marketsApi } from '../../api/resources'
import type { Market } from '../../api/types'
import { ErrorState, Loader } from '../../components/States'

export interface MarketContext {
  market: Market
}

// eslint-disable-next-line react-refresh/only-export-components
export const useMarket = () => useOutletContext<MarketContext>().market

export function MarketLayout() {
  const id = Number(useParams().id)
  const { data: market, isLoading, error } = useQuery({ queryKey: ['markets', id], queryFn: () => marketsApi.get(id) })

  if (isLoading) return <Loader />
  if (error || !market) return <ErrorState error={error} />

  return (
    <>
      <Link to="/markets" className="back">← Все магазины</Link>
      <div className="market-head">
        <div>
          <h1>
            {market.name}
            {!market.isActive && <span className="badge badge-gray" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Неактивен</span>}
          </h1>
          {market.address && <p className="muted">{market.address}</p>}
        </div>
      </div>
      <nav className="tabs">
        <NavLink to="" end>Журнал прихода</NavLink>
        <NavLink to="reports">Отчёты</NavLink>
        <NavLink to="products">Продукты магазина <span className="tab-count">{market.productsCount}</span></NavLink>
      </nav>
      <Outlet context={{ market } satisfies MarketContext} />
    </>
  )
}
