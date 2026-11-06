import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Import Komponen Background Animasi
import StarBackground from './components/StarBackground'
import ZodiacConstellations from './components/ZodiacConstellations'

// Import Halaman
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Products from './pages/Products'
import Invoices from './pages/Invoices'
import InvoiceForm from './pages/InvoiceForm'
import InvoiceDetail from './pages/InvoiceDetail'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import Expenses from './pages/Expenses'
import Team from './pages/Team'
import ActivityLog from './pages/ActivityLog'
import PublicInvoice from './pages/PublicInvoice'
import StockOpname from './pages/StockOpname'

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        
        {/* Background Animasi: Debu Bintang & Rasi Bintang */}
        <StarBackground />
        <ZodiacConstellations />

        <Routes>
          {/* Halaman Login */}
          <Route path="/login" element={<Login />} />

          {/* Halaman Publik (Tanpa Login) */}
          <Route path="/public-invoice/:invoiceNumber/:token" element={<PublicInvoice />} />

          {/* Halaman yang membutuhkan Login (Owner & Admin) */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/products" element={<Products />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/stock-opname" element={<StockOpname />} />

            {/* Halaman khusus Owner */}
            <Route element={<ProtectedRoute allowedRoles={['owner']} />}>
              <Route path="/reports" element={<Reports />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/team" element={<Team />} />
              <Route path="/activity-logs" element={<ActivityLog />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Halaman tidak ditemukan */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UIProvider>
    </AuthProvider>
  )
}