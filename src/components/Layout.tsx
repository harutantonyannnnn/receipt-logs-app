import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { ReceiptModalProvider, useOpenReceipt } from './NewReceiptModal'
import { useAuth } from '../auth/AuthContext'
import { IconBox, IconChart, IconLogout, IconPlus, IconStore, IconTag } from './Icons'

const NAV = [
  { to: '/markets', label: 'Магазины', icon: IconStore },
  { to: '/reports', label: 'Отчёты', icon: IconChart },
  { to: '/products', label: 'Продукты', icon: IconBox },
  { to: '/categories', label: 'Категории', icon: IconTag },
]

export function Layout() {
  return (
    <ReceiptModalProvider>
      <Shell />
    </ReceiptModalProvider>
  )
}

function Shell() {
  const { admin, logout } = useAuth()
  const openReceipt = useOpenReceipt()
  // На странице магазина окно прихода открывается сразу с этим магазином
  const marketMatch = useMatch('/markets/:id/*')
  const currentMarketId = Number(marketMatch?.params.id) || undefined

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img className="brand-mark" src="/favicon.svg" alt="" width={30} height={30} />
            <span className="brand-text">Журнал прихода</span>
          </div>
          <nav className="nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to}>{n.label}</NavLink>
            ))}
          </nav>
          <button className="btn btn-accent desktop-only" onClick={() => openReceipt(currentMarketId)}>
            <IconPlus width={18} height={18} /> Новый приход
          </button>
          <div className="user">
            <span className="user-name">{admin?.name || admin?.email}</span>
            <button className="icon-btn-light" onClick={logout} title="Выйти" aria-label="Выйти">
              <IconLogout />
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>

      {/* Нижнее меню для телефона */}
      <nav className="bottom-nav" aria-label="Разделы">
        {NAV.slice(0, 2).map((n) => (
          <NavLink key={n.to} to={n.to}><n.icon /><span>{n.label}</span></NavLink>
        ))}
        <button className="fab" onClick={() => openReceipt(currentMarketId)} aria-label="Новый приход">
          <IconPlus width={28} height={28} strokeWidth={2.4} />
        </button>
        {NAV.slice(2).map((n) => (
          <NavLink key={n.to} to={n.to}><n.icon /><span>{n.label}</span></NavLink>
        ))}
      </nav>
    </div>
  )
}
