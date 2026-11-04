import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, loading, signInWithGoogle } = useAuth()
  
  if (loading) return <div className="login-wrap"><div className="skeleton" style={{ width: 350, height: 350, borderRadius: 24 }}></div></div>
  if (session) return <Navigate to="/dashboard" replace />
  
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Zahrashop Logo" style={{ height: 80, objectFit: 'contain', margin: '0 auto 16px' }} onError={(e) => { e.target.style.display = 'none' }} />
          <h1 className="login-logo">Zahrashop</h1>
          <p className="login-subtitle">Kelola invoice, pelanggan, dan stok bisnismu dengan lebih cerdas dan efisien.</p>
        </div>

        <button onClick={signInWithGoogle} className="btn-google">
          <svg className="google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
          </svg>
          Masuk dengan Google
        </button>

        <p className="login-footer">Hanya pemilik bisnis yang diizinkan masuk.</p>
      </div>
    </div>
  )
}