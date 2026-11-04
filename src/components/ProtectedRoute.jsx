
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({
  children,
  allowedRoles,
}) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <p style={{ padding: 24 }}>Memuat...</p>
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(profile.role?.toLowerCase())
  ) {
    return <Navigate to="/dashboard" replace />
  }

  return children || <Outlet />
}
