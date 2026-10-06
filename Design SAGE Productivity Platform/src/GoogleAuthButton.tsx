import { useEffect, useRef, useState } from "react"
import { Text } from "@fluentui/react-text"
import { useAuth, type AuthUser } from "./AuthContext"
import { getGoogleClientId, loadGoogleIdentity } from "./googleCalendar"

type GoogleAuthButtonProps = {
  onSuccess?: (user: AuthUser) => void
  onError?: (errorMessage: string) => void
  width?: number
}

export default function GoogleAuthButton({
  onSuccess,
  onError,
  width = 320,
}: GoogleAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { loginWithCredential, error, setError, clearError } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const handleCredential = (credential: string) => {
      if (!credential || !active) return
      const ok = loginWithCredential(credential)
      if (ok) {
        clearError()
        try {
          const stored = window.localStorage.getItem("sage_auth_user")
          if (stored) {
            const user = JSON.parse(stored) as AuthUser
            onSuccess?.(user)
          }
        } catch {}
      } else {
        const msg = "Google sign-in wasn't completed. Please try again."
        setError(msg)
        onError?.(msg)
      }
    }

    loadGoogleIdentity()
      .then(() => {
        if (!active) return
        const accountsId = window.google?.accounts?.id
        if (!accountsId) {
          setLoading(false)
          return
        }

        try {
          const initialize = accountsId.initialize as (options: unknown) => void
          initialize({
            client_id: getGoogleClientId(),
            callback: (res: { credential?: string }) => {
              if (res.credential) {
                handleCredential(res.credential)
              } else {
                const msg = "Google sign-in wasn't completed. Please try again."
                setError(msg)
                onError?.(msg)
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            itp_support: true,
          })

          if (containerRef.current) {
            containerRef.current.innerHTML = ""
            const renderButton = accountsId.renderButton as (
              parent: HTMLElement,
              options: unknown,
            ) => void
            renderButton(containerRef.current, {
              type: "standard",
              theme: "outline",
              size: "large",
              text: "continue_with",
              shape: "rectangular",
              width,
              logo_alignment: "left",
            })
          }
          setLoading(false)
        } catch {
          setLoading(false)
          const msg = "Google sign-in wasn't completed. Please try again."
          setError(msg)
          onError?.(msg)
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false)
          const msg = "Google sign-in wasn't completed. Please try again."
          setError(msg)
          onError?.(msg)
        }
      })

    return () => {
      active = false
    }
  }, [loginWithCredential, onSuccess, onError, setError, clearError, width])

  return (
    <div
      className="google-auth"
      style={{
        width: "100%",
        maxWidth: `${width}px`,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {/* Official Google Identity Services Rendered Button */}
      <div
        ref={containerRef}
        style={{
          minHeight: "44px",
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      />

      {loading && (
        <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
          Loading Google Sign-In…
        </Text>
      )}

      {/* Graceful Error Display (Never exposes technical OAuth errors) */}
      {error && (
        <div
          role="alert"
          style={{
            color: "#c42b1c",
            backgroundColor: "#fde7e9",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "13px",
            textAlign: "center",
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #f99f9f",
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
