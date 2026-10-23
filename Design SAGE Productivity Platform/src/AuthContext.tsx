import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react"
import {
  apiClient,
  ApiError,
  clearStoredToken,
  getStoredToken,
  isTransientErrorStatus,
  prewarmBackend,
  setStoredToken,
} from "./api/client"
import { clearUserStorage } from "./userStorage"

export type AuthUser = {
  authenticated: boolean
  id?: number
  name: string
  email: string
  picture?: string
  sub?: string
  onboardingCompleted?: boolean
}

export type AuthContextType = {
  user: AuthUser | null
  isAuthenticated: boolean
  isSubmittingLogin: boolean
  isTransientAuthError: boolean
  loginWithCredential: (credential: string) => Promise<boolean>
  loginWithUser: (user: AuthUser) => void
  signOut: () => void
  deleteAccount: () => Promise<boolean>
  error: string | null
  setError: (err: string | null) => void
  clearError: () => void
  hasCompletedOnboarding: boolean
  completeOnboarding: (profileData?: {
    name?: string
    college?: string
    course?: string
    year?: string
    timezone?: string
  }) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AUTH_STORAGE_KEY = "sage_auth_user"
export const TOKEN_STORAGE_KEY = "sage_auth_token"
export const ONBOARDING_STORAGE_KEY = "sage_onboarding_completed"

type BackendAuthResponse = {
  token: string
  user: {
    id: number
    email: string
    name?: string
    picture?: string | null
    onboardingCompleted: boolean
  }
}

type BackendUserProfile = {
  id: number
  email: string
  name?: string
  onboardingCompleted: boolean
  college?: string
  course?: string
  year?: string
  timezone?: string
}

/**
 * Pure frontend decoding helper for non-security display purposes only.
 * Authoritative authentication is performed server-side by SAGE Auth Service.
 */
export function decodeGoogleCredential(credential: string): AuthUser | null {
  try {
    const parts = credential.split(".")
    if (parts.length < 2) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    )
    const data = JSON.parse(jsonPayload) as {
      sub?: string
      email?: string
      name?: string
      picture?: string
    }

    if (!data.email) return null

    return {
      authenticated: true,
      sub: String(data.sub || ""),
      email: String(data.email),
      name: String(data.name || data.email.split("@")[0]),
      picture: data.picture ? String(data.picture) : undefined,
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const token = getStoredToken()
      if (!token) return null
      const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser
        if (parsed?.authenticated && parsed?.email) {
          return parsed
        }
      }
    } catch {}
    return null
  })

  const [hasCompletedOnboarding, setHasCompletedOnboardingState] =
    useState<boolean>(() => {
      if (typeof window === "undefined") return false
      try {
        return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true"
      } catch {}
      return false
    })

  const [error, setError] = useState<string | null>(null)
  const [isSubmittingLogin, setIsSubmittingLogin] = useState<boolean>(false)
  const isSubmittingLoginRef = useRef<boolean>(false)
  const [isTransientAuthError, setIsTransientAuthError] = useState<boolean>(false)

  // Lightweight non-blocking backend pre-warm on initial mount
  useEffect(() => {
    prewarmBackend()
  }, [])

  const clearError = useCallback(() => {
    setError(null)
    setIsTransientAuthError(false)
  }, [])

  const signOut = useCallback(() => {
    setUser(null)
    setError(null)
    setIsTransientAuthError(false)
    try {
      clearStoredToken()
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.localStorage.removeItem("sage-user-profile")
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY)
      window.sessionStorage.clear()
      const googleId = (window as unknown as {
        google?: { accounts?: { id?: { disableAutoSelect?: () => void } } }
      }).google?.accounts?.id
      if (googleId?.disableAutoSelect) {
        googleId.disableAutoSelect()
      }
    } catch {}
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      try {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      } catch {}
      return
    }

    try {
      const profile = await apiClient.get<BackendUserProfile>("/auth/me")
      if (profile && profile.email) {
        let prevPicture: string | undefined
        try {
          const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
          if (stored) {
            const parsed = JSON.parse(stored)
            prevPicture = parsed.picture
          }
        } catch {}

        const restoredUser: AuthUser = {
          authenticated: true,
          id: profile.id,
          email: profile.email,
          name: profile.name || profile.email.split("@")[0],
          picture: prevPicture,
          sub: String(profile.id),
          onboardingCompleted: Boolean(profile.onboardingCompleted),
        }

        setUser(restoredUser)
        setHasCompletedOnboardingState(Boolean(profile.onboardingCompleted))
        try {
          window.localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify(restoredUser),
          )
          window.localStorage.setItem(
            ONBOARDING_STORAGE_KEY,
            String(Boolean(profile.onboardingCompleted)),
          )
        } catch {}
      }
    } catch {
      // If token is invalid or expired, clear session
      clearStoredToken()
      try {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      } catch {}
      setUser(null)
    }
  }, [])

  // Validate and restore session from backend on mount
  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      try {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      } catch {}
      setUser(null)
      return
    }
    refreshUser()
  }, [refreshUser])

  // Wire sage:unauthorized lifecycle event
  useEffect(() => {
    const handleUnauthorized = () => {
      signOut()
      setError("Your session has expired. Please sign in again.")
    }
    window.addEventListener("sage:unauthorized", handleUnauthorized)
    return () => {
      window.removeEventListener("sage:unauthorized", handleUnauthorized)
    }
  }, [signOut])

  const loginWithCredential = useCallback(
    async (credential: string): Promise<boolean> => {
      if (!credential || !credential.trim()) {
        setError("Google sign-in wasn't completed. Please try again.")
        setIsTransientAuthError(false)
        return false
      }

      // Prevent duplicate simultaneous login submissions
      if (isSubmittingLoginRef.current) {
        return false
      }
      isSubmittingLoginRef.current = true
      setIsSubmittingLogin(true)
      setIsTransientAuthError(false)

      try {
        const response = await apiClient.post<BackendAuthResponse>(
          "/auth/google",
          {
            credential: credential.trim(),
          },
          { timeoutMs: 15000 },
        )

        if (!response || !response.token || !response.user) {
          clearStoredToken()
          setError(
            "We couldn't verify your account with SAGE. Please try again.",
          )
          setIsTransientAuthError(false)
          if (import.meta.env.DEV) {
            console.error(
              "[SAGE Auth] Backend response missing token or user object",
            )
          }
          return false
        }

        setStoredToken(response.token)

        const authUser: AuthUser = {
          authenticated: true,
          id: response.user.id,
          email: response.user.email,
          name: response.user.name || response.user.email.split("@")[0],
          picture: response.user.picture || undefined,
          sub: String(response.user.id),
          onboardingCompleted: Boolean(response.user.onboardingCompleted),
        }

        setUser(authUser)
        setError(null)
        setIsTransientAuthError(false)

        try {
          window.localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify(authUser),
          )
          window.localStorage.setItem(
            ONBOARDING_STORAGE_KEY,
            String(Boolean(response.user.onboardingCompleted)),
          )

          const existingProfileStr =
            window.localStorage.getItem("sage-user-profile")
          let existingProfile = {}
          if (existingProfileStr) {
            try {
              existingProfile = JSON.parse(existingProfileStr)
            } catch {}
          }
          window.localStorage.setItem(
            "sage-user-profile",
            JSON.stringify({
              ...existingProfile,
              email: authUser.email,
              name: authUser.name,
            }),
          )
        } catch {}

        setHasCompletedOnboardingState(
          Boolean(response.user.onboardingCompleted),
        )
        return true
      } catch (err: unknown) {
        clearStoredToken()
        try {
          window.localStorage.removeItem(AUTH_STORAGE_KEY)
        } catch {}
        setUser(null)

        const isTransient =
          err instanceof ApiError &&
          isTransientErrorStatus(err.status, err.message)
        setIsTransientAuthError(isTransient)

        const userMessage =
          err instanceof ApiError
            ? err.message
            : "Google sign-in wasn't completed. Please try again."
        setError(userMessage)
        if (import.meta.env.DEV) {
          console.error(
            "[SAGE Auth] Login failed:",
            err instanceof Error ? err.message : err,
          )
        }
        return false
      } finally {
        isSubmittingLoginRef.current = false
        setIsSubmittingLogin(false)
      }
    },
    [],
  )

  const loginWithUser = useCallback((authUser: AuthUser) => {
    setUser(authUser)
    setError(null)
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
      const existingProfileStr =
        window.localStorage.getItem("sage-user-profile")
      let existingProfile = {}
      if (existingProfileStr) {
        try {
          existingProfile = JSON.parse(existingProfileStr)
        } catch {}
      }
      window.localStorage.setItem(
        "sage-user-profile",
        JSON.stringify({
          ...existingProfile,
          email: authUser.email,
          name: authUser.name,
        }),
      )
    } catch {}
  }, [])

  const completeOnboarding = async (profileData?: {
    name?: string
    college?: string
    course?: string
    year?: string
    timezone?: string
  }) => {
    setHasCompletedOnboardingState(true)
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true")
    } catch {}

    const token = getStoredToken()
    if (token) {
      try {
        await apiClient.post("/auth/onboarding", {
          name: profileData?.name || user?.name || "",
          college: profileData?.college || "",
          course: profileData?.course || "",
          year: profileData?.year || "",
          timezone: profileData?.timezone || "",
        })
      } catch {}
    }
  }

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    try {
      // 1. Call server-side permanent deletion endpoint
      await apiClient.delete("/auth/account")

      // 2. Identify active user identity before clearing
      const currentUser = user

      // 3. Purge user-scoped storage for this user and active session keys
      clearUserStorage(currentUser)
      clearStoredToken()

      // 4. Reset React authentication state
      setUser(null)
      setError(null)
      setHasCompletedOnboardingState(false)

      // 5. Disable Google auto-select
      const googleId = (window as unknown as {
        google?: { accounts?: { id?: { disableAutoSelect?: () => void } } }
      }).google?.accounts?.id
      if (googleId?.disableAutoSelect) {
        googleId.disableAutoSelect()
      }

      return true
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to permanently delete account. Please try again."
      setError(msg)
      return false
    }
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user?.authenticated,
        isSubmittingLogin,
        isTransientAuthError,
        loginWithCredential,
        loginWithUser,
        signOut,
        deleteAccount,
        error,
        setError,
        clearError,
        hasCompletedOnboarding,
        completeOnboarding,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
