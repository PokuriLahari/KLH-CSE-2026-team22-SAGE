import React, { createContext, useContext, useEffect, useState } from "react"

export type AuthUser = {
  authenticated: boolean
  name: string
  email: string
  picture?: string
  sub: string
}

export type AuthContextType = {
  user: AuthUser | null
  isAuthenticated: boolean
  loginWithCredential: (credential: string) => boolean
  loginWithUser: (user: AuthUser) => void
  signOut: () => void
  error: string | null
  setError: (err: string | null) => void
  clearError: () => void
  hasCompletedOnboarding: boolean
  completeOnboarding: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AUTH_STORAGE_KEY = "sage_auth_user"
export const ONBOARDING_STORAGE_KEY = "sage_onboarding_completed"

/**
 * Pure frontend decoding of Google Identity Services JWT credential
 * Extracts only basic profile fields without sending tokens to any server.
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

  const clearError = () => setError(null)

  const loginWithCredential = (credential: string): boolean => {
    try {
      const authUser = decodeGoogleCredential(credential)
      if (!authUser) {
        setError("Google sign-in wasn't completed. Please try again.")
        return false
      }

      setUser(authUser)
      setError(null)

      // Persist temporary frontend auth state so page reload preserves session
      try {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))

        // Sync with existing sage-user-profile structure for workspace compatibility
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

      return true
    } catch {
      setError("Google sign-in wasn't completed. Please try again.")
      return false
    }
  }

  const loginWithUser = (authUser: AuthUser) => {
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
  }

  const completeOnboarding = () => {
    setHasCompletedOnboardingState(true)
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true")
    } catch {}
  }

  const signOut = () => {
    setUser(null)
    setError(null)
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.localStorage.removeItem("sage-user-profile")
      window.sessionStorage.clear()
      const googleId = (window as unknown as {
        google?: { accounts?: { id?: { disableAutoSelect?: () => void } } }
      }).google?.accounts?.id
      if (googleId?.disableAutoSelect) {
        googleId.disableAutoSelect()
      }
    } catch {}
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user?.authenticated,
        loginWithCredential,
        loginWithUser,
        signOut,
        error,
        setError,
        clearError,
        hasCompletedOnboarding,
        completeOnboarding,
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
