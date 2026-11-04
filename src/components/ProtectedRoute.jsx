import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <p style={{ padding: 24 }}>Memuat…</p>
  if (!session) return <Navigate to="/login" replace />
  return children
}