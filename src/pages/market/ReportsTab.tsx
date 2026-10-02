import { ReportsView } from '../../components/reports/ReportsView'
import { useMarket } from './MarketLayout'

export function ReportsTab() {
  const market = useMarket()
  return <ReportsView fixedMarketId={market.id} />
}
