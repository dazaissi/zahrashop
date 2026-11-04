
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let mounted = true

    async function initializeSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        setAuthError('Gagal memeriksa sesi login.')
        setLoading(false)
        return
      }

      setSession(data.session)
    }

    initializeSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    async function validateSession() {
      if (!session?.user?.id) {
        setProfile(null)
        setAuthError('')
        setLoading(false)
        return
      }

      setLoading(true)
      setAuthError('')

      try {
        const { data: existingProfile, error: profileError } =
          await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

        if (!active) return

        if (profileError) {
          throw profileError
        }

        if (existingProfile) {
          setProfile(existingProfile)
          setAuthError('')
          setLoading(false)
          return
        }

        const { data, error } = await supabase.rpc(
          'accept_team_invitation'
        )

        if (!active) return

        if (error || !data?.success || !data?.profile) {
          const message = error?.message || ''

          if (
            message.includes('Email ini belum mendapatkan undangan') ||
            message.includes('belum mendapatkan undangan')
          ) {
            setAuthError('Email ini belum mendapatkan undangan dari Owner.')
            setProfile(null)
            await supabase.auth.signOut()
          } else {
            console.error('Gagal menerima undangan:', error)
            setAuthError(
              'Gagal memverifikasi akses akun. Silakan coba lagi.'
            )
            setProfile(null)
          }

          setLoading(false)
          return
        }

        setProfile(data.profile)
        setAuthError('')
        setLoading(false)
      } catch (error) {
        if (!active) return

        console.error('Gagal memvalidasi sesi:', error)
        setProfile(null)
        setAuthError('Gagal memuat profil akun. Silakan coba lagi.')
        setLoading(false)
      }
    }

    validateSession()

    return () => {
      active = false
    }
  }, [session?.user?.id])

  async function signInWithGoogle() {
    setAuthError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/zahrashop/`,
      },
    })

    if (error) {
      setAuthError('Gagal masuk menggunakan Google. Silakan coba lagi.')
    }

    return { error }
  }

  async function signOut() {
    setProfile(null)
    setAuthError('')
    return await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        role: profile?.role || null,
        loading,
        authError,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
