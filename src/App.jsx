import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Invoices from './pages/Invoices'
import InvoiceForm from './pages/InvoiceForm'
import InvoiceDetail from './pages/InvoiceDetail'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import Expenses from './pages/Expenses'
import Team from './pages/Team'
import ActivityLog from './pages/ActivityLog'
import PublicInvoice from './pages/PublicInvoice' // <-- Import PublicInvoice
import StockOpname from './pages/StockOpname'

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* RUTE PUBLIK (Bisa diakses tanpa login) */}
          <Route path="/public-invoice/:number" element={<PublicInvoice />} />

          {/* RUTE PROTECTED (Wajib Login) */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/products" element={<Products />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/stock-opname" element={<StockOpname />} />
            <Route path="/team" element={<Team />} />
            <Route path="/activity-logs" element={<ActivityLog />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UIProvider>
    </AuthProvider>
  )
}