import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { Loader } from './components/States'
import { CategoriesPage } from './pages/CategoriesPage'
import { LoginPage } from './pages/LoginPage'
import { MarketsPage } from './pages/MarketsPage'
import { ProductsPage } from './pages/ProductsPage'
import { ReportsPage } from './pages/ReportsPage'
import { JournalTab } from './pages/market/JournalTab'
import { MarketLayout } from './pages/market/MarketLayout'
import { ReportsTab } from './pages/market/ReportsTab'
import { StoreProductsTab } from './pages/market/StoreProductsTab'

function RequireAuth() {
  const { admin, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loader />
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/markets/:id" element={<MarketLayout />}>
            <Route index element={<JournalTab />} />
            <Route path="reports" element={<ReportsTab />} />
            <Route path="products" element={<StoreProductsTab />} />
          </Route>
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/markets" replace />} />
    </Routes>
  )
}
